#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import MDR questions from an Excel file into Railway MySQL.

✅ Features / fixes included:
- Reads Excel with pandas + openpyxl
- Connects to Railway MySQL using env vars (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME) OR DATABASE_URL
- Detects actual DB columns for `processus` and `questions` and adapts queries
- Deletes existing questions before importing (full replace)
- Ensures processId is NEVER null (creates missing processes)
- Ensures economicRole is NEVER null (DB NOT NULL on Railway) => defaults to "all"
- Avoids inserting columns that do not exist in DB (e.g. referenceLabel, updatedAt)
- Cleans/normalizes input values and skips empty rows safely
- Generates stable questionKey when missing

Expected Excel headers (French):
- "Processus concerné"
- "Objectif du processus"
- "Clause MDR"
- "Intitulé"
- "Question d’audit détaillée"
- "Type"
- "Risque en cas de NC"
- "Preuves attendues"
- "Fonctions interrogées"
- "Criticité"
"""

import os
import sys
import json
import hashlib
import re
from urllib.parse import urlparse

import pandas as pd
import mysql.connector


# ----------------------------
# Config
# ----------------------------

EXCEL_PATH = os.getenv("EXCEL_PATH", "data/MDR_questionnaire_V7_CORRIGE.xlsx")
DEFAULT_REFERENTIAL_ID = int(os.getenv("DEFAULT_REFERENTIAL_ID", "1"))
DEFAULT_ECONOMIC_ROLE = os.getenv("DEFAULT_ECONOMIC_ROLE", "all")  # ✅ NOT NULL on Railway
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

# Mapping helpers for DB column names (some DBs use different casing)
PROCESS_TABLE = os.getenv("PROCESS_TABLE", "processus")
QUESTIONS_TABLE = os.getenv("QUESTIONS_TABLE", "questions")


# ----------------------------
# Utils
# ----------------------------

def log(msg: str):
    print(msg, flush=True)


def die(msg: str, code: int = 1):
    log(msg)
    sys.exit(code)


def norm_str(v):
    if v is None:
        return ""
    s = str(v).strip()
    # normalize weird non-breaking spaces etc.
    s = s.replace("\u00a0", " ").strip()
    return s


def safe_json_array(v):
    """
    Convert "a, b, c" OR "['a','b']" OR '["a","b"]' into a JSON string array.
    """
    if v is None:
        return json.dumps([])
    if isinstance(v, (list, tuple)):
        arr = [norm_str(x) for x in v if norm_str(x)]
        return json.dumps(arr, ensure_ascii=False)
    s = norm_str(v)
    if not s:
        return json.dumps([])
    # Try parse JSON
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("{") and s.endswith("}")):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                arr = [norm_str(x) for x in parsed if norm_str(x)]
                return json.dumps(arr, ensure_ascii=False)
        except Exception:
            pass
    # Fallback: split by comma / newline / semicolon
    parts = re.split(r"[,\n;]+", s)
    arr = [norm_str(p) for p in parts if norm_str(p)]
    return json.dumps(arr, ensure_ascii=False)


def gen_question_key(article: str, process_name: str, question_text: str) -> str:
    base = f"{norm_str(article)}|{norm_str(process_name)}|{norm_str(question_text)}"
    h = hashlib.md5(base.encode("utf-8")).hexdigest()
    return f"q_{h}"


def parse_database_url(url: str):
    """
    Parses DATABASE_URL like:
    mysql://user:pass@host:port/dbname
    """
    u = urlparse(url)
    if u.scheme not in ("mysql", "mysql2"):
        raise ValueError("Unsupported DATABASE_URL scheme (expected mysql://)")
    return {
        "host": u.hostname,
        "port": u.port or 3306,
        "user": u.username,
        "password": u.password,
        "database": (u.path or "").lstrip("/"),
    }


def get_mysql_config():
    # Prefer explicit vars
    host = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST") or os.getenv("HOST")
    port = os.getenv("DB_PORT") or os.getenv("MYSQL_PORT") or os.getenv("PORT")
    user = os.getenv("DB_USER") or os.getenv("MYSQL_USER") or os.getenv("USER")
    password = os.getenv("DB_PASSWORD") or os.getenv("MYSQL_PASSWORD") or os.getenv("PASSWORD")
    database = os.getenv("DB_NAME") or os.getenv("MYSQL_DATABASE") or os.getenv("DATABASE")

    if host and user and database:
        return {
            "host": host,
            "port": int(port or 3306),
            "user": user,
            "password": password or "",
            "database": database,
        }

    # Fallback DATABASE_URL
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return parse_database_url(db_url)

    die("❌ Missing DB connection env vars. Provide DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME or DATABASE_URL.")


def fetch_table_columns(cursor, table_name: str):
    cursor.execute(f"SHOW COLUMNS FROM `{table_name}`")
    cols = [row[0] for row in cursor.fetchall()]
    return cols


def pick_col(cols, *candidates):
    """
    Return the first candidate that exists in cols.
    """
    for c in candidates:
        if c in cols:
            return c
    return None


# ----------------------------
# Main
# ----------------------------

def main():
    log("📥 Lecture Excel...")
    if not os.path.exists(EXCEL_PATH):
        die(f"❌ Excel file not found: {EXCEL_PATH}")

    # Read excel
    df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
    df = df.fillna("")

    log(f"📊 Lignes détectées: {len(df)}")

    # Connect DB
    cfg = get_mysql_config()
    log(f"🔌 Connexion MySQL -> host={cfg['host']} port={cfg['port']} db={cfg['database']} user={cfg['user']}")

    conn = mysql.connector.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        database=cfg["database"],
        connection_timeout=30,
        autocommit=False,
    )
    cursor = conn.cursor()

    # Introspect columns
    process_cols = fetch_table_columns(cursor, PROCESS_TABLE)
    questions_cols = fetch_table_columns(cursor, QUESTIONS_TABLE)
    log(f"🧭 Colonnes table processus: {process_cols}")
    log(f"🧾 Colonnes table questions: {questions_cols}")

    # Determine process table columns
    process_id_col = pick_col(process_cols, "id")
    process_name_col = pick_col(process_cols, "name")
    process_created_col = pick_col(process_cols, "createdAt", "created_at", "created_at_ts")
    # updatedAt might not exist on Railway in your case; we won't use it.
    process_updated_col = pick_col(process_cols, "updatedAt", "updated_at")

    if not process_id_col or not process_name_col:
        die("❌ process table must have at least columns: id, name")

    # Preload processes into map: name_lower -> id
    log("🧭 Chargement table processus...")
    cursor.execute(f"SELECT `{process_id_col}`, `{process_name_col}` FROM `{PROCESS_TABLE}`")
    process_map = {}
    for pid, pname in cursor.fetchall():
        if pname is None:
            continue
        process_map[norm_str(pname).lower()] = int(pid)

    # Helper to create process if missing
    def get_or_create_process_id(process_name: str) -> int:
        pname = norm_str(process_name)
        if not pname:
            # last resort (shouldn't happen because processId NOT NULL)
            pname = "Non défini"
        key = pname.lower()

        if key in process_map:
            return process_map[key]

        if DRY_RUN:
            fake_id = max(process_map.values(), default=0) + 1
            process_map[key] = fake_id
            log(f"🧪 DRY_RUN: Processus créé: '{pname}' -> id={fake_id}")
            return fake_id

        # Build insert dynamically based on existing columns
        cols = [process_name_col]
        placeholders = ["%s"]
        params = [pname]

        if process_created_col in process_cols:
            cols.append(process_created_col)
            placeholders.append("NOW()")
        # don't add updatedAt if not present
        insert_sql = f"INSERT INTO `{PROCESS_TABLE}` ({', '.join([f'`{c}`' for c in cols])}) VALUES ({', '.join(placeholders)})"
        cursor.execute(insert_sql, tuple(params))
        new_id = cursor.lastrowid
        process_map[key] = int(new_id)
        log(f"➕ Processus créé: '{pname}' -> id={new_id}")
        return int(new_id)

    # Wipe questions
    log("🧹 Suppression anciennes questions...")
    if not DRY_RUN:
        cursor.execute(f"DELETE FROM `{QUESTIONS_TABLE}`")

    # Excel header helpers (French)
    COL_PROCESS = "Processus concerné"
    COL_OBJECTIF = "Objectif du processus"
    COL_CLAUSE = "Clause MDR"
    COL_INTITULE = "Intitulé"
    COL_QTEXT = "Question d’audit détaillée"
    COL_TYPE = "Type"
    COL_RISK = "Risque en cas de NC"
    COL_EVID = "Preuves attendues"
    COL_FUNCS = "Fonctions interrogées"
    COL_CRIT = "Criticité"

    # DB insert column builder:
    insert_cols = []
    insert_placeholders = []
    extractors = []

    def add_col(db_col: str, placeholder: str, extractor):
        insert_cols.append(db_col)
        insert_placeholders.append(placeholder)
        extractors.append(extractor)

    # Required-ish / common columns
    if "referentialId" in questions_cols:
        add_col("referentialId", "%s", lambda r: DEFAULT_REFERENTIAL_ID)

    # processId must not be null on Railway for your table
    if "processId" in questions_cols:
        add_col("processId", "%s", lambda r: get_or_create_process_id(r.get(COL_PROCESS, "")))

    # questionKey
    if "questionKey" in questions_cols:
        def _qkey(r):
            article = r.get(COL_CLAUSE, "")
            proc = r.get(COL_PROCESS, "")
            qtext = r.get(COL_QTEXT, "")
            key = gen_question_key(article, proc, qtext)
            # trim to 255 just in case (varchar(255))
            return key[:255]
        add_col("questionKey", "%s", _qkey)

    # article
    if "article" in questions_cols:
        add_col("article", "%s", lambda r: norm_str(r.get(COL_CLAUSE, ""))[:255] or None)

    # title
    if "title" in questions_cols:
        add_col("title", "%s", lambda r: norm_str(r.get(COL_INTITULE, ""))[:255] or None)

    # questionText
    if "questionText" in questions_cols:
        add_col("questionText", "%s", lambda r: norm_str(r.get(COL_QTEXT, "")) or None)

    # questionType
    if "questionType" in questions_cols:
        add_col("questionType", "%s", lambda r: norm_str(r.get(COL_TYPE, ""))[:50] or None)

    # expectedEvidence
    if "expectedEvidence" in questions_cols:
        add_col("expectedEvidence", "%s", lambda r: norm_str(r.get(COL_EVID, "")) or None)

    # criticality
    if "criticality" in questions_cols:
        add_col("criticality", "%s", lambda r: norm_str(r.get(COL_CRIT, ""))[:50] or None)

    # risk / risks
    # Your DB has both risk and risks (text). We'll put Excel risk into `risk`, and also mirror in `risks`.
    excel_risk_extractor = lambda r: norm_str(r.get(COL_RISK, "")) or None
    if "risk" in questions_cols:
        add_col("risk", "%s", excel_risk_extractor)
    if "risks" in questions_cols:
        add_col("risks", "%s", excel_risk_extractor)

    # interviewFunctions JSON
    if "interviewFunctions" in questions_cols:
        add_col("interviewFunctions", "%s", lambda r: safe_json_array(r.get(COL_FUNCS, "")))

    # applicableProcesses JSON: store the process name as an applicable process
    if "applicableProcesses" in questions_cols:
        add_col("applicableProcesses", "%s", lambda r: json.dumps([norm_str(r.get(COL_PROCESS, ""))], ensure_ascii=False))

    # economicRole NOT NULL on Railway (your error)
    if "economicRole" in questions_cols:
        add_col("economicRole", "%s", lambda r: DEFAULT_ECONOMIC_ROLE)

    # displayOrder: optional, we can generate sequential ordering
    if "displayOrder" in questions_cols:
        # will be overwritten per row using index
        add_col("displayOrder", "%s", lambda r: int(r.get("__row_index__", 0)) + 1)

    # createdAt: let DB default, but if column exists and NOT defaulted, we can set NOW()
    # We'll only set it if it exists AND has no default? Hard to know. We keep it simple:
    if "createdAt" in questions_cols:
        # Use NOW() to be safe if your DB column doesn't default
        insert_cols.append("createdAt")
        insert_placeholders.append("NOW()")
        extractors.append(lambda r: None)  # ignored

    if not insert_cols:
        die("❌ No compatible columns found to insert into questions table.")

    # Build INSERT statement (skip NOW() params)
    cols_sql = ", ".join([f"`{c}`" for c in insert_cols])
    placeholders_sql = ", ".join(insert_placeholders)
    insert_sql = f"INSERT INTO `{QUESTIONS_TABLE}` ({cols_sql}) VALUES ({placeholders_sql})"
    log("🧾 SQL INSERT questions prêt.")

    inserted = 0
    skipped = 0

    # Insert row by row (safe + clear errors)
    for idx, row in df.iterrows():
        r = {k: row[k] for k in df.columns}
        r["__row_index__"] = idx

        qtext = norm_str(r.get(COL_QTEXT, ""))
        proc = norm_str(r.get(COL_PROCESS, ""))

        # Skip rows without question text (avoid questionText null / garbage)
        if not qtext:
            skipped += 1
            continue

        # If process missing, still create "Non défini" so processId isn't null
        if not proc:
            r[COL_PROCESS] = "Non défini"

        params = []
        # Extract in same order; ignore NOW() placeholders (we put a lambda None)
        for col, ph, ex in zip(insert_cols, insert_placeholders, extractors):
            if ph.strip().upper() == "NOW()":
                continue
            val = ex(r)
            params.append(val)

        if DRY_RUN:
            inserted += 1
            continue

        try:
            cursor.execute(insert_sql, tuple(params))
            inserted += 1
        except Exception as e:
            log(f"❌ Insert failed at Excel row={idx+2} (1-based with header). Error: {e}")
            log(f"   Process='{norm_str(r.get(COL_PROCESS,''))}' Clause='{norm_str(r.get(COL_CLAUSE,''))}'")
            log(f"   Question='{qtext[:200]}'")
            conn.rollback()
            raise

        # Commit in batches
        if inserted % 200 == 0:
            conn.commit()
            log(f"✅ {inserted} questions importées...")

    if not DRY_RUN:
        conn.commit()

    log(f"✅ Import terminé. Inserted={inserted} Skipped(empty question)={skipped}")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"💥 Fatal error: {e}")
        raise
