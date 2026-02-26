import os
import time
import re
import hashlib
import pandas as pd
import mysql.connector
from urllib.parse import urlparse, parse_qs

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ---------------- DB CONNECT (robust) ----------------

def parse_db_url(url: str) -> dict:
    u = urlparse(url)
    qs = parse_qs(u.query)
    ssl_val = (qs.get("ssl", ["on"])[0] or "on").lower()
    ssl_required = ssl_val not in ("0", "false", "off", "no")
    return {
        "host": u.hostname,
        "port": u.port or 3306,
        "user": u.username,
        "password": u.password,
        "database": u.path.lstrip("/"),
        "ssl_required": ssl_required,
    }

def connect_with_retry(max_attempts: int = 10):
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    info = parse_db_url(DATABASE_URL)

    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            kwargs = dict(
                host=info["host"],
                port=info["port"],
                user=info["user"],
                password=info["password"],
                database=info["database"],
                connection_timeout=25,
                autocommit=False,
            )
            if info["ssl_required"]:
                kwargs.update(ssl_disabled=False, ssl_verify_cert=False, ssl_verify_identity=False)
            else:
                kwargs.update(ssl_disabled=True)

            conn = mysql.connector.connect(**kwargs)
            conn.ping(reconnect=True, attempts=3, delay=2)
            return conn
        except Exception as e:
            last_err = e
            wait_s = min(2 ** attempt, 20)
            print(f"[DB] connect attempt {attempt}/{max_attempts} failed: {e}")
            print(f"[DB] retrying in {wait_s}s...")
            time.sleep(wait_s)
    raise last_err

# ---------------- Helpers ----------------

def norm(v):
    if v is None:
        return None
    if pd.isna(v):
        return None
    s = str(v).strip()
    if s == "" or s.lower() == "nan":
        return None
    return s

def normalize_header(h: str) -> str:
    s = str(h).strip().lower()
    s = s.replace("’", "'")
    # strip accents (simple)
    s = (s.replace("é", "e").replace("è", "e").replace("ê", "e")
           .replace("à", "a").replace("ç", "c").replace("ù", "u").replace("ô", "o").replace("î", "i"))
    s = re.sub(r"\s+", " ", s)
    return s

def col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """
    Fuzzy match a dataframe column name.
    """
    norm_map = {normalize_header(c): c for c in df.columns}
    for cand in candidates:
        k = normalize_header(cand)
        if k in norm_map:
            return norm_map[k]
    return None

def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("&", "and")
    s = re.sub(r"[’']", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s

def stable_question_key(referential_id: int, process_slug: str, article: str, title: str, question_text: str) -> str:
    base = f"{referential_id}||{process_slug or ''}||{article or ''}||{title or ''}||{question_text or ''}"
    h = hashlib.md5(base.encode("utf-8")).hexdigest()
    return f"q_{h}"

# ---------------- Process mapping ----------------

def table_exists(cur, name: str) -> bool:
    cur.execute("""
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
      LIMIT 1
    """, (name,))
    return cur.fetchone() is not None

def get_columns(cur, table: str):
    cur.execute("""
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
    """, (table,))
    return {r[0] for r in cur.fetchall()}

def detect_process_table(cur):
    candidates = ["processus", "processes", "process", "iso_processes", "mdr_processes"]
    cur.execute("""
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE '%process%'
      ORDER BY TABLE_NAME
    """)
    for (t,) in cur.fetchall():
        if t not in candidates:
            candidates.append(t)

    for t in candidates:
        if not table_exists(cur, t):
            continue
        cols = get_columns(cur, t)
        if "id" not in cols:
            continue

        slug_col = None
        for c in ["slug", "code", "key", "processKey", "process_key"]:
            if c in cols:
                slug_col = c
                break

        name_col = None
        for c in ["name", "label", "titre", "title", "intitule", "intitulé"]:
            if c in cols:
                name_col = c
                break

        if slug_col or name_col:
            print(f"[PROCESS] Using table '{t}' with id + {(slug_col or name_col)}")
            return t, "id", slug_col, name_col

    raise RuntimeError("No process table found with columns (id + slug/name).")

def build_process_map(cur) -> dict:
    t, id_col, slug_col, name_col = detect_process_table(cur)
    select_cols = [id_col]
    if slug_col:
        select_cols.append(slug_col)
    if name_col and name_col != slug_col:
        select_cols.append(name_col)

    cur.execute(f"SELECT {', '.join([f'`{c}`' for c in select_cols])} FROM `{t}`")
    rows = cur.fetchall()

    mp = {}
    for r in rows:
        pid = r[0]
        slug_val = None
        name_val = None
        if slug_col and len(select_cols) >= 2:
            slug_val = r[1]
            if name_col and name_col != slug_col and len(select_cols) >= 3:
                name_val = r[2]
        elif name_col and len(select_cols) >= 2:
            name_val = r[1]

        if slug_val:
            sv = str(slug_val).strip()
            mp[sv] = pid
            mp[sv.lower()] = pid

        if name_val:
            nv = str(name_val).strip()
            mp[nv] = pid
            mp[nv.lower()] = pid
            mp[slugify(nv)] = pid

    print(f"[PROCESS] map size={len(mp)}")
    return mp

# ---------------- Import logic (FILL ONLY) ----------------

def load_rows_from_excel(df: pd.DataFrame, referential_id: int):
    # Detect columns (fuzzy)
    c_process = col(df, ["Processus concerné", "Processus concerne", "Processus"])
    c_clause = col(df, ["Clause ISO 9001"]) if referential_id == 2 else col(df, ["Clause ISO 13485"])
    c_title = col(df, ["Intitulé", "Intitule", "Intitulé de la question"])
    c_qtext = col(df, ["Question d’audit détaillée", "Question d'audit détaillée", "Question audit détaillée"])
    c_type = col(df, ["Type"])
    c_risk = col(df, ["Risque en cas de NC", "Risque en cas de non conformite", "Risque en cas de non-conformité", "Risque"])
    c_evid = col(df, ["Éléments de preuve attendus", "Elements de preuve attendus", "Preuves attendues", "Éléments de preuve"])
    c_funcs = col(df, ["Fonctions interrogées", "Fonctions interrogees", "Fonctions"])
    c_crit = col(df, ["Criticité", "Criticite"])
    c_qk = col(df, ["questionKey", "QuestionKey", "question_key"])

    missing = [("Processus", c_process), ("Clause", c_clause), ("QuestionText", c_qtext), ("questionKey", c_qk)]
    for name, v in missing:
        if not v:
            print(f"[WARN] Missing column in Excel for referentialId={referential_id}: {name}")

    rows = []
    for _, r in df.iterrows():
        qk = norm(r.get(c_qk)) if c_qk else None
        process_name = norm(r.get(c_process)) if c_process else None
        article = norm(r.get(c_clause)) if c_clause else None
        title = norm(r.get(c_title)) if c_title else None
        qtext = norm(r.get(c_qtext)) if c_qtext else None
        qtype = norm(r.get(c_type)) if c_type else None
        risk = norm(r.get(c_risk)) if c_risk else None
        evid = norm(r.get(c_evid)) if c_evid else None
        funcs = norm(r.get(c_funcs)) if c_funcs else None
        crit = norm(r.get(c_crit)) if c_crit else None

        if not qk:
            # fallback key (not recommended)
            qk = stable_question_key(referential_id, slugify(process_name or ""), article or "", title or "", qtext or "")
        rows.append({
            "questionKey": qk,
            "process": process_name,
            "article": article,
            "title": title,
            "questionText": qtext,
            "questionType": qtype,
            "risk": risk,
            "expectedEvidence": evid,
            "interviewFunctions": funcs,
            "criticality": crit,
            "referentialId": referential_id,
        })

    # Logging about Excel content
    non_empty_risk = sum(1 for x in rows if x["risk"])
    non_empty_evid = sum(1 for x in rows if x["expectedEvidence"])
    print(f"[EXCEL] referentialId={referential_id} rows={len(rows)} risk_non_empty={non_empty_risk} evid_non_empty={non_empty_evid}")
    return rows

def upsert_fill_only(df: pd.DataFrame, referential_id: int):
    conn = connect_with_retry()
    cur = conn.cursor()

    process_map = build_process_map(cur)
    rows = load_rows_from_excel(df, referential_id)

    # How many DB risks empty currently?
    cur.execute("""
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN risk IS NULL OR risk='' THEN 1 ELSE 0 END) AS risk_empty,
             SUM(CASE WHEN expectedEvidence IS NULL OR expectedEvidence='' THEN 1 ELSE 0 END) AS evid_empty
      FROM questions
      WHERE referentialId=%s
    """, (referential_id,))
    total, risk_empty, evid_empty = cur.fetchone()
    print(f"[DB] referentialId={referential_id} total={total} risk_empty={risk_empty} evid_empty={evid_empty}")

    updated_any = 0
    updated_risk = 0
    updated_evid = 0
    not_found = 0
    skip_no_process = 0

    # Fill-only: only set values when DB empty AND Excel has value
    for row in rows:
        p = row["process"]
        pid = None
        if p:
            pid = process_map.get(p) or process_map.get(p.lower()) or process_map.get(slugify(p))
        if not pid:
            skip_no_process += 1
            continue

        qk = row["questionKey"]

        cur.execute("""
          SELECT id, risk, expectedEvidence
          FROM questions
          WHERE questionKey=%s AND referentialId=%s
          LIMIT 1
        """, (qk, referential_id))
        existing = cur.fetchone()
        if not existing:
            # We do NOT insert here (avoid duplicates). You asked "sans doublons".
            not_found += 1
            continue

        _id, db_risk, db_evid = existing

        set_risk = (db_risk is None or str(db_risk).strip() == "") and (row["risk"] is not None and row["risk"] != "")
        set_evid = (db_evid is None or str(db_evid).strip() == "") and (row["expectedEvidence"] is not None and row["expectedEvidence"] != "")

        if not (set_risk or set_evid):
            continue

        # Build update dynamically
        updates = []
        params = []

        # Always keep processId/article/title/questionText/questionType aligned (safe)
        updates += ["processId=%s", "article=%s", "title=%s", "questionText=%s", "questionType=%s",
                    "interviewFunctions=%s", "criticality=%s"]
        params += [pid, row["article"], row["title"], row["questionText"], row["questionType"],
                   row["interviewFunctions"], row["criticality"]]

        if set_risk:
            updates.append("risk=%s")
            params.append(row["risk"])
        if set_evid:
            updates.append("expectedEvidence=%s")
            params.append(row["expectedEvidence"])

        params += [qk, referential_id]

        cur.execute(
            f"UPDATE questions SET {', '.join(updates)} WHERE questionKey=%s AND referentialId=%s",
            tuple(params),
        )

        updated_any += 1
        if set_risk:
            updated_risk += 1
        if set_evid:
            updated_evid += 1

        try:
            conn.ping(reconnect=True, attempts=2, delay=1)
        except Exception:
            pass

    conn.commit()
    cur.close()
    conn.close()

    print(f"[RESULT] referentialId={referential_id} updated_any={updated_any} updated_risk={updated_risk} updated_evid={updated_evid} "
          f"not_found_in_db={not_found} skip_no_process={skip_no_process}")

def run():
    iso9001_path = "data/Questionnaires audits iso 9001.xlsx"
    iso13485_path = "data/Questionnaires audits iso 13485.xlsx"

    iso9001 = pd.read_excel(iso9001_path, engine="openpyxl")
    iso13485 = pd.read_excel(iso13485_path, engine="openpyxl")

    upsert_fill_only(iso9001, 2)
    upsert_fill_only(iso13485, 3)

if __name__ == "__main__":
    run()
