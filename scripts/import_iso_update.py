import os
import time
import pandas as pd
import mysql.connector
from urllib.parse import urlparse, parse_qs

DATABASE_URL = os.environ.get("DATABASE_URL", "")

def parse_db_url(url: str) -> dict:
    """
    Supports:
      mysql://user:pass@host:port/db?ssl=true
      mysql://... ?ssl=on/off
    """
    u = urlparse(url)
    if u.scheme not in ("mysql", "mysql2"):
        raise ValueError(f"Unsupported DATABASE_URL scheme: {u.scheme}")

    qs = parse_qs(u.query)
    ssl_val = (qs.get("ssl", ["on"])[0] or "on").lower()
    # Railway typically needs SSL; default to ON
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

            # ✅ Make SSL explicit, and avoid strict cert verification issues in CI
            if info["ssl_required"]:
                kwargs.update(
                    ssl_disabled=False,
                    ssl_verify_cert=False,
                    ssl_verify_identity=False,
                )
            else:
                kwargs.update(ssl_disabled=True)

            conn = mysql.connector.connect(**kwargs)

            # ✅ Ensure connection is alive
            conn.ping(reconnect=True, attempts=3, delay=2)
            return conn

        except Exception as e:
            last_err = e
            wait_s = min(2 ** attempt, 20)  # exponential backoff capped
            print(f"[DB] connect attempt {attempt}/{max_attempts} failed: {e}")
            print(f"[DB] retrying in {wait_s}s...")
            time.sleep(wait_s)

    raise last_err

def get_process_map(cur):
    # processes table is assumed to have (id, slug)
    cur.execute("SELECT id, slug FROM processes")
    rows = cur.fetchall()
    return {slug: pid for (pid, slug) in rows}

def norm(v):
    if v is None:
        return None
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s if s != "" and s.lower() != "nan" else None

def to_question_type(v):
    s = (norm(v) or "").lower()
    # keep as-is if you already use your own enum strings
    return norm(v)

def excel_to_rows(df: pd.DataFrame, referential_id: int):
    rows = []
    for _, r in df.iterrows():
        process_name = norm(r.get("Processus concerné"))
        clause_9001 = norm(r.get("Clause ISO 9001"))
        clause_13485 = norm(r.get("Clause ISO 13485"))
        article = clause_13485 if referential_id == 3 else clause_9001

        title = norm(r.get("Intitulé")) or norm(r.get("Intitulé de la question"))
        question_text = norm(r.get("Question d’audit détaillée"))
        qtype = to_question_type(r.get("Type"))
        risk = norm(r.get("Risque en cas de NC"))
        evidence = norm(r.get("Éléments de preuve attendus")) or norm(r.get("Preuves attendues"))
        functions = norm(r.get("Fonctions interrogées"))
        criticality = norm(r.get("Criticité"))

        # IMPORTANT: require questionKey to avoid duplicates
        question_key = norm(r.get("questionKey")) or norm(r.get("QuestionKey")) or norm(r.get("question_key"))

        if not question_key:
            # skip rows without stable key
            continue

        rows.append({
            "questionKey": question_key,
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

def upsert_questions(df: pd.DataFrame, referential_id: int):
    conn = connect_with_retry()
    cur = conn.cursor()

    process_map = get_process_map(cur)

    rows = excel_to_rows(df, referential_id)
    print(f"[IMPORT] referentialId={referential_id} excel usable rows={len(rows)}")

    inserted = 0
    updated = 0
    skipped_no_process = 0
    skipped_not_found = 0

    # ✅ Use questionKey+referentialId as the unique identity
    # If you already have a UNIQUE index on (questionKey, referentialId), this is perfect.
    for row in rows:
        process_slug = row["process"]
        process_id = process_map.get(process_slug) if process_slug else None

        if not process_id:
            # If process mapping is mandatory in your app, skip and report.
            skipped_no_process += 1
            continue

        qk = row["questionKey"]

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
            # Insert only if truly new; avoids duplicates as long as questionKey is stable
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

        # keep connection healthy during large imports
        try:
            conn.ping(reconnect=True, attempts=2, delay=1)
        except Exception:
            pass

    conn.commit()
    cur.close()
    conn.close()

    print(f"[IMPORT] referentialId={referential_id} UPDATED={updated} INSERTED={inserted} "
          f"SKIP_NO_PROCESS={skipped_no_process} SKIP_NOT_FOUND={skipped_not_found}")

def run():
    iso9001_path = "data/Questionnaires audits iso 9001.xlsx"
    iso13485_path = "data/Questionnaires audits iso 13485.xlsx"

    iso9001 = pd.read_excel(iso9001_path, engine="openpyxl")
    iso13485 = pd.read_excel(iso13485_path, engine="openpyxl")

    # ✅ ISO 9001
    upsert_questions(iso9001, 2)
    # ✅ ISO 13485
    upsert_questions(iso13485, 3)

if __name__ == "__main__":
    run()
