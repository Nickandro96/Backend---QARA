import os
import time
import re
import hashlib
import pandas as pd
import mysql.connector
from urllib.parse import urlparse, parse_qs

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ---------- DB CONNECT (robust) ----------

def parse_db_url(url: str) -> dict:
    u = urlparse(url)
    if u.scheme not in ("mysql", "mysql2"):
        raise ValueError(f"Unsupported DATABASE_URL scheme: {u.scheme}")

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

            # Railway often requires SSL; in CI we disable strict checks
            if info["ssl_required"]:
                kwargs.update(
                    ssl_disabled=False,
                    ssl_verify_cert=False,
                    ssl_verify_identity=False,
                )
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

# ---------- Helpers ----------

def norm(v):
    if v is None:
        return None
    if pd.isna(v):
        return None
    s = str(v).strip()
    if s == "" or s.lower() == "nan":
        return None
    return s

def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("&", "and")
    s = re.sub(r"[’']", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s

def stable_question_key(referential_id: int, process_slug: str, article: str, title: str, question_text: str) -> str:
    """
    Fallback if Excel has no questionKey.
    WARNING: If you change title/question_text later, key will change => duplicates.
    Prefer providing questionKey in Excel.
    """
    base = f"{referential_id}||{process_slug or ''}||{article or ''}||{title or ''}||{question_text or ''}"
    h = hashlib.md5(base.encode("utf-8")).hexdigest()
    return f"q_{h}"

# ---------- Process table detection ----------

def table_exists(cur, table_name: str) -> bool:
    cur.execute("""
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
      LIMIT 1
    """, (table_name,))
    return cur.fetchone() is not None

def get_columns(cur, table_name: str):
    cur.execute("""
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
    """, (table_name,))
    return {r[0] for r in cur.fetchall()}

def detect_process_table(cur) -> tuple[str, str | None, str | None]:
    """
    Try to find a table that looks like a processes table.
    Returns (table_name, id_col, slug_or_name_col).
    """
    # candidates by common naming in FR/EN projects
    candidates = [
        "processes", "processus", "process", "iso_processes", "mdr_processes",
        "qms_processes", "audit_processes", "process_list"
    ]

    # add any tables containing 'process' in name
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
        # must have id
        if "id" not in cols:
            continue
        # prefer slug, else name/label/code
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
            return (t, "id", slug_col, name_col)

    # Nothing found
    raise RuntimeError(
        "No process table found. Expected a table like 'processus' or similar with columns (id, slug/name)."
    )

def build_process_map(cur) -> dict:
    """
    Returns a dict mapping multiple keys to processId:
      - slug
      - name
      - slugified(name)
    """
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
            mp[str(slug_val).strip()] = pid
            mp[str(slug_val).strip().lower()] = pid

        if name_val:
            nv = str(name_val).strip()
            mp[nv] = pid
            mp[nv.lower()] = pid
            mp[slugify(nv)] = pid

    print(f"[PROCESS] map size={len(mp)}")
    return mp

# ---------- Excel → rows ----------

def excel_to_rows(df: pd.DataFrame, referential_id: int):
    rows = []
    for _, r in df.iterrows():
        process_name = norm(r.get("Processus concerné"))

        article = None
        if referential_id == 3:
            article = norm(r.get("Clause ISO 13485"))
        else:
            article = norm(r.get("Clause ISO 9001"))

        title = norm(r.get("Intitulé")) or norm(r.get("Intitulé de la question"))
        question_text = norm(r.get("Question d’audit détaillée")) or norm(r.get("Question d'audit détaillée"))
        qtype = norm(r.get("Type"))

        risk = norm(r.get("Risque en cas de NC"))
        evidence = norm(r.get("Éléments de preuve attendus")) or norm(r.get("Preuves attendues"))
        functions = norm(r.get("Fonctions interrogées"))
        criticality = norm(r.get("Criticité"))

        # Prefer Excel-provided questionKey
        qk = norm(r.get("questionKey")) or norm(r.get("QuestionKey")) or norm(r.get("question_key"))

        rows.append({
            "questionKey": qk,
            "process": process_name,
            "article": article,
            "title": title,
            "questionText": question_text,
            "questionType": qtype,
            "risk": risk,
            "expectedEvidence": evidence,
            "interviewFunctions": functions,
            "criticality": criticality,
            "referentialId": referential_id,
        })
    return rows

# ---------- UPSERT ----------

def upsert_questions(df: pd.DataFrame, referential_id: int):
    conn = connect_with_retry()
    cur = conn.cursor()

    process_map = build_process_map(cur)

    rows = excel_to_rows(df, referential_id)
    print(f"[IMPORT] referentialId={referential_id} excel rows={len(rows)}")

    inserted = 0
    updated = 0
    skipped_no_key = 0
    skipped_no_process = 0

    for row in rows:
        # Resolve processId
        p = row["process"]
        process_id = None
        if p:
            process_id = process_map.get(p) or process_map.get(p.lower()) or process_map.get(slugify(p))

        if not process_id:
            skipped_no_process += 1
            continue

        # Resolve questionKey
        qk = row["questionKey"]
        if not qk:
            # fallback key (WARNING)
            qk = stable_question_key(
                referential_id,
                slugify(p or ""),
                row["article"] or "",
                row["title"] or "",
                row["questionText"] or "",
            )

        # Existence check
        cur.execute(
            "SELECT id FROM questions WHERE questionKey=%s AND referentialId=%s LIMIT 1",
            (qk, referential_id),
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                """
                UPDATE questions
                SET
                  processId=%s,
                  article=%s,
                  title=%s,
                  questionText=%s,
                  questionType=%s,
                  risk=%s,
                  expectedEvidence=%s,
                  interviewFunctions=%s,
                  criticality=%s
                WHERE questionKey=%s AND referentialId=%s
                """,
                (
                    process_id,
                    row["article"],
                    row["title"],
                    row["questionText"],
                    row["questionType"],
                    row["risk"],
                    row["expectedEvidence"],
                    row["interviewFunctions"],
                    row["criticality"],
                    qk,
                    referential_id,
                ),
            )
            updated += 1
        else:
            cur.execute(
                """
                INSERT INTO questions
                  (questionKey, referentialId, processId, article, title, questionText,
                   questionType, risk, expectedEvidence, interviewFunctions, criticality, createdAt)
                VALUES
                  (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, NOW())
                """,
                (
                    qk,
                    referential_id,
                    process_id,
                    row["article"],
                    row["title"],
                    row["questionText"],
                    row["questionType"],
                    row["risk"],
                    row["expectedEvidence"],
                    row["interviewFunctions"],
                    row["criticality"],
                ),
            )
            inserted += 1

        # keep alive
        try:
            conn.ping(reconnect=True, attempts=2, delay=1)
        except Exception:
            pass

    conn.commit()
    cur.close()
    conn.close()

    print(f"[IMPORT] referentialId={referential_id} UPDATED={updated} INSERTED={inserted} "
          f"SKIP_NO_PROCESS={skipped_no_process} SKIP_NO_KEY={skipped_no_key}")

def run():
    iso9001_path = "data/Questionnaires audits iso 9001.xlsx"
    iso13485_path = "data/Questionnaires audits iso 13485.xlsx"

    iso9001 = pd.read_excel(iso9001_path, engine="openpyxl")
    iso13485 = pd.read_excel(iso13485_path, engine="openpyxl")

    # ISO 9001
    upsert_questions(iso9001, 2)
    # ISO 13485
    upsert_questions(iso13485, 3)

if __name__ == "__main__":
    run()
