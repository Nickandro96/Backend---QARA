#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import MDR questions from an Excel file into Railway MySQL.

✅ Fixes included:
- Reads Excel with pandas + openpyxl
- Connects to Railway MySQL using env vars (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME) OR DATABASE_URL
- Introspects actual DB schema (columns + types) for `processus` and `questions`
- Additive, idempotent upsert by `questionKey` (unique key, see migration 0009):
  inserts if absent, updates if present. NEVER deletes/truncates — running this
  twice, or running the ISO/FDA importers before or after, never touches
  another referential's questions.
- Ensures processId is NEVER null (creates missing processes)
- Ensures economicRole is NEVER null (defaults to "all" if DB NOT NULL)
- Detects ENUM columns (criticality/questionType/...) and maps Excel values to allowed enum values
- Avoids inserting columns that do not exist in DB (only writes `risk`; the
  legacy `risks` column was dropped by migration 0015 and is never targeted)
- Generates stable questionKey

Expected Excel headers (French):
Processus concerné | Objectif du processus | Clause MDR | Intitulé | Question d’audit détaillée |
Type | Risque en cas de NC | Preuves attendues | Fonctions interrogées | Criticité
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
DEFAULT_ECONOMIC_ROLE = os.getenv("DEFAULT_ECONOMIC_ROLE", "all")  # ✅ your DB seems NOT NULL
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

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

    # Fallback split
    parts = re.split(r"[,\n;]+", s)
    arr = [norm_str(p) for p in parts if norm_str(p)]
    return json.dumps(arr, ensure_ascii=False)


def gen_question_key(article: str, process_name: str, question_text: str, economic_role: str = "") -> str:
    # economic_role is included on purpose: this Excel has up to 3 rows per
    # (article, process, question) — one per economic role (see
    # extract_economic_role) — sharing the exact same question text. Without
    # the role in the key, upserting by questionKey would silently collapse
    # those 3 rows into 1 (confirmed by direct inspection: 135 of the 566
    # distinct (article, process, question) combos have exactly 3 role
    # variants each).
    base = f"{norm_str(article)}|{norm_str(process_name)}|{norm_str(question_text)}|{norm_str(economic_role)}"
    h = hashlib.md5(base.encode("utf-8")).hexdigest()
    return f"q_{h}"


ECONOMIC_ROLE_PREFIXES = {
    "fabricant": "fabricant",
    "importateur": "importateur",
    "distributeur": "distributeur",
    "mandataire": "mandataire",
}


def extract_economic_role(title: str, default: str) -> str:
    """
    This Excel encodes the economic role as a "[Fabricant]"/"[Importateur]"/
    "[Distributeur]" prefix on the "Intitulé" column instead of a dedicated
    column. Falls back to `default` when no recognized prefix is found.
    """
    m = re.match(r"^\s*\[([^\]]+)\]", norm_str(title))
    if not m:
        return default
    return ECONOMIC_ROLE_PREFIXES.get(m.group(1).strip().lower(), default)


def slugify(value: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower())
    return s.strip("_") or "process"


# Known drift between this Excel's "Processus concerné" wording and the 15
# canonical process names seeded by migrations 0007/0010-0014 (confirmed by
# direct comparison: 2 of the Excel's 14 distinct process names don't match
# the canonical table verbatim). Mapped here instead of silently creating a
# near-duplicate process row.
PROCESS_NAME_ALIASES = {
    "traçabilité & udi": "Traçabilité / UDI",
    "it / données / cybersécurité (si applicable)": "IT / données / cybersécurité",
}


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
    host = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST")
    port = os.getenv("DB_PORT") or os.getenv("MYSQL_PORT")
    user = os.getenv("DB_USER") or os.getenv("MYSQL_USER")
    password = os.getenv("DB_PASSWORD") or os.getenv("MYSQL_PASSWORD")
    database = os.getenv("DB_NAME") or os.getenv("MYSQL_DATABASE")

    if host and user and database:
        return {
            "host": host,
            "port": int(port or 3306),
            "user": user,
            "password": password or "",
            "database": database,
        }

    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return parse_database_url(db_url)

    die("❌ Missing DB connection env vars. Provide DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME or DATABASE_URL.")


def fetch_table_schema(cursor, table_name: str):
    """
    Returns:
      - cols: list of column names
      - types: dict colName -> sqlType string (e.g., "varchar(50)", "enum('a','b')")
      - nullables: dict colName -> bool (True if NULL allowed)
    """
    cursor.execute(f"SHOW COLUMNS FROM `{table_name}`")
    cols = []
    types = {}
    nullables = {}
    for field, col_type, is_null, key, default, extra in cursor.fetchall():
        cols.append(field)
        types[field] = col_type
        nullables[field] = (str(is_null).upper() == "YES")
    return cols, types, nullables


def pick_col(cols, *candidates):
    for c in candidates:
        if c in cols:
            return c
    return None


def parse_enum_values(sql_type: str):
    """
    If sql_type like "enum('low','medium','high')" return ['low','medium','high'] else None.
    """
    if not sql_type:
        return None
    s = sql_type.strip().lower()
    if not s.startswith("enum("):
        return None
    inside = s[len("enum("):-1]  # remove enum( and trailing )
    # split by ',' while keeping quoted values
    # easiest: regex capture between single quotes
    vals = re.findall(r"'([^']*)'", inside)
    return vals if vals else None


def normalize_to_enum(value_raw: str, allowed: list, fallback: str = None):
    """
    Map arbitrary string (French/various) to one of allowed enum values.
    """
    if not allowed:
        return value_raw

    v = norm_str(value_raw).lower()
    allowed_l = [a.lower() for a in allowed]

    # exact match
    if v in allowed_l:
        return allowed[allowed_l.index(v)]

    # keyword mapping for common criticality labels
    # (works for both EN and FR)
    def pick(targets):
        for t in targets:
            if t in allowed_l:
                return allowed[allowed_l.index(t)]
        return None

    # Criticality heuristics
    if any(k in v for k in ["crit", "critical", "majeur", "major", "high", "élev", "eleve", "severe", "sévère"]):
        return pick(["critical", "high", "majeur", "major"]) or (fallback or allowed[0])

    if any(k in v for k in ["moy", "medium", "moderate", "modéré", "modere", "interm"]):
        return pick(["medium", "moderate", "moyen"]) or (fallback or allowed[0])

    if any(k in v for k in ["faible", "low", "minor", "mineur", "min"]):
        return pick(["low", "minor", "faible", "mineur"]) or (fallback or allowed[0])

    # For questionType / other enums: try partial contains
    for i, a in enumerate(allowed_l):
        if a and a in v:
            return allowed[i]

    # default
    if fallback and fallback.lower() in allowed_l:
        return allowed[allowed_l.index(fallback.lower())]
    return allowed[0]


# ----------------------------
# Main
# ----------------------------

def main():
    log("📥 Lecture Excel...")
    if not os.path.exists(EXCEL_PATH):
        die(f"❌ Excel file not found: {EXCEL_PATH}")

    df = pd.read_excel(EXCEL_PATH, engine="openpyxl").fillna("")
    log(f"📊 Lignes détectées: {len(df)}")

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
        charset="utf8mb4",
        use_unicode=True,
    )
    cursor = conn.cursor()

    # Introspect schema
    process_cols, process_types, process_nullables = fetch_table_schema(cursor, PROCESS_TABLE)
    questions_cols, questions_types, questions_nullables = fetch_table_schema(cursor, QUESTIONS_TABLE)

    log(f"🧭 Colonnes table processus: {process_cols}")
    log(f"🧾 Colonnes table questions: {questions_cols}")

    # Determine process columns
    process_id_col = pick_col(process_cols, "id")
    process_name_col = pick_col(process_cols, "name")
    process_created_col = pick_col(process_cols, "createdAt", "created_at")
    process_slug_col = pick_col(process_cols, "slug")

    if not process_id_col or not process_name_col:
        die("❌ process table must have at least columns: id, name")

    # Preload processes
    log("🧭 Chargement table processus...")
    cursor.execute(f"SELECT `{process_id_col}`, `{process_name_col}` FROM `{PROCESS_TABLE}`")
    process_map = {}
    for pid, pname in cursor.fetchall():
        if pname is None:
            continue
        process_map[norm_str(pname).lower()] = int(pid)

    existing_slugs: set = set()
    if process_slug_col:
        cursor.execute(f"SELECT `{process_slug_col}` FROM `{PROCESS_TABLE}` WHERE `{process_slug_col}` IS NOT NULL")
        existing_slugs = {row[0] for row in cursor.fetchall()}

    def get_or_create_process_id(process_name: str) -> int:
        pname = norm_str(process_name) or "Non défini"
        key = PROCESS_NAME_ALIASES.get(pname.lower(), pname).lower()
        if key in process_map:
            return process_map[key]

        if DRY_RUN:
            fake_id = max(process_map.values(), default=0) + 1
            process_map[key] = fake_id
            log(f"🧪 DRY_RUN: Processus créé: '{pname}' -> id={fake_id}")
            return fake_id

        log(f"⚠️  Processus inconnu des 15 canoniques, création d'un nouveau : '{pname}'")

        cols = [process_name_col]
        placeholders = ["%s"]
        params = [pname]

        if process_slug_col:
            base_slug = slugify(pname)
            slug = base_slug
            n = 2
            while slug in existing_slugs:
                slug = f"{base_slug}_{n}"
                n += 1
            existing_slugs.add(slug)
            cols.append(process_slug_col)
            placeholders.append("%s")
            params.append(slug)

        if process_created_col in process_cols:
            # Some schemas use defaultNow; but NOW() is safe too
            cols.append(process_created_col)
            placeholders.append("NOW()")

        insert_sql = f"INSERT INTO `{PROCESS_TABLE}` ({', '.join([f'`{c}`' for c in cols])}) VALUES ({', '.join(placeholders)})"
        cursor.execute(insert_sql, tuple(params))
        new_id = cursor.lastrowid
        process_map[key] = int(new_id)
        log(f"➕ Processus créé: '{pname}' -> id={new_id}")
        return int(new_id)

    # Detect ENUM allowed values for criticality & questionType (and any other if needed)
    criticality_enum = parse_enum_values(questions_types.get("criticality", ""))
    questiontype_enum = parse_enum_values(questions_types.get("questionType", ""))

    if criticality_enum:
        log(f"🧩 criticality ENUM détecté: {criticality_enum}")
    if questiontype_enum:
        log(f"🧩 questionType ENUM détecté: {questiontype_enum}")

    # Additive only: no purge. Rows are upserted by questionKey below.

    # Excel headers
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

    # Build insert dynamically
    insert_cols = []
    insert_placeholders = []
    extractors = []

    def add_col(db_col: str, placeholder: str, extractor):
        insert_cols.append(db_col)
        insert_placeholders.append(placeholder)
        extractors.append(extractor)

    if "referentialId" in questions_cols:
        add_col("referentialId", "%s", lambda r: DEFAULT_REFERENTIAL_ID)

    if "processId" in questions_cols:
        add_col("processId", "%s", lambda r: get_or_create_process_id(r.get(COL_PROCESS, "")))

    if "questionKey" in questions_cols:
        def _qkey(r):
            role = extract_economic_role(r.get(COL_INTITULE, ""), DEFAULT_ECONOMIC_ROLE)
            key = gen_question_key(r.get(COL_CLAUSE, ""), r.get(COL_PROCESS, ""), r.get(COL_QTEXT, ""), role)
            return key[:255]
        add_col("questionKey", "%s", _qkey)

    if "article" in questions_cols:
        add_col("article", "%s", lambda r: (norm_str(r.get(COL_CLAUSE, ""))[:255] or None))

    if "title" in questions_cols:
        add_col("title", "%s", lambda r: (norm_str(r.get(COL_INTITULE, ""))[:255] or None))

    if "questionText" in questions_cols:
        add_col("questionText", "%s", lambda r: (norm_str(r.get(COL_QTEXT, "")) or None))

    if "questionType" in questions_cols:
        def _qtype(r):
            raw = norm_str(r.get(COL_TYPE, ""))
            if questiontype_enum:
                return normalize_to_enum(raw, questiontype_enum, fallback=questiontype_enum[0])
            # fallback varchar
            return raw[:50] if raw else None
        add_col("questionType", "%s", _qtype)

    if "expectedEvidence" in questions_cols:
        add_col("expectedEvidence", "%s", lambda r: (norm_str(r.get(COL_EVID, "")) or None))

    if "criticality" in questions_cols:
        def _crit(r):
            raw = norm_str(r.get(COL_CRIT, ""))
            if criticality_enum:
                return normalize_to_enum(raw, criticality_enum, fallback=criticality_enum[0])
            # fallback varchar(50)
            return raw[:50] if raw else None
        add_col("criticality", "%s", _crit)

    # Only `risk` is ever targeted: migration 0015 dropped the legacy `risks`
    # column, current schema only has `risk` (singular).
    if "risk" in questions_cols:
        add_col("risk", "%s", lambda r: (norm_str(r.get(COL_RISK, "")) or None))

    if "interviewFunctions" in questions_cols:
        add_col("interviewFunctions", "%s", lambda r: safe_json_array(r.get(COL_FUNCS, "")))

    if "applicableProcesses" in questions_cols:
        add_col("applicableProcesses", "%s", lambda r: json.dumps([norm_str(r.get(COL_PROCESS, "")) or "Non défini"], ensure_ascii=False))

    # economicRole (NOT NULL on your DB => must always be set). Parsed from the
    # "[Fabricant]"/"[Importateur]"/"[Distributeur]" prefix on Intitulé — see
    # extract_economic_role. Falls back to DEFAULT_ECONOMIC_ROLE ("all") when
    # a row has no recognized role prefix.
    if "economicRole" in questions_cols:
        def _role(r):
            return extract_economic_role(r.get(COL_INTITULE, ""), DEFAULT_ECONOMIC_ROLE)
        add_col("economicRole", "%s", _role)

    if "displayOrder" in questions_cols:
        add_col("displayOrder", "%s", lambda r: int(r.get("__row_index__", 0)) + 1)

    # createdAt: safe set NOW()
    if "createdAt" in questions_cols:
        insert_cols.append("createdAt")
        insert_placeholders.append("NOW()")
        extractors.append(lambda r: None)

    if not insert_cols:
        die("❌ No compatible columns found to insert into questions table.")

    if "questionKey" not in insert_cols:
        die("❌ questionKey column is required for an additive/idempotent upsert.")

    # Upsert by questionKey (unique key, see migration 0009): never deletes,
    # never touches rows outside this referential's questionKeys. Running
    # this script twice, or after/before the ISO or FDA importers, is safe.
    update_cols = [c for c in insert_cols if c not in ("questionKey", "createdAt")]
    cols_sql = ", ".join([f"`{c}`" for c in insert_cols])
    placeholders_sql = ", ".join(insert_placeholders)
    update_sql = ", ".join([f"`{c}` = VALUES(`{c}`)" for c in update_cols])
    upsert_sql = (
        f"INSERT INTO `{QUESTIONS_TABLE}` ({cols_sql}) VALUES ({placeholders_sql}) "
        f"ON DUPLICATE KEY UPDATE {update_sql}"
    )
    log("🧾 SQL UPSERT (INSERT ... ON DUPLICATE KEY UPDATE) questions prêt.")

    processed = 0
    skipped = 0

    for idx, row in df.iterrows():
        r = {k: row[k] for k in df.columns}
        r["__row_index__"] = idx

        qtext = norm_str(r.get(COL_QTEXT, ""))
        if not qtext:
            skipped += 1
            continue

        if not norm_str(r.get(COL_PROCESS, "")):
            r[COL_PROCESS] = "Non défini"

        params = []
        for col, ph, ex in zip(insert_cols, insert_placeholders, extractors):
            if ph.strip().upper() == "NOW()":
                continue
            params.append(ex(r))

        if DRY_RUN:
            processed += 1
            continue

        try:
            cursor.execute(upsert_sql, tuple(params))
            processed += 1
        except Exception as e:
            log(f"❌ Upsert failed at Excel row={idx+2} (1-based with header). Error: {e}")
            log(f"   Process='{norm_str(r.get(COL_PROCESS,''))}' Clause='{norm_str(r.get(COL_CLAUSE,''))}'")
            log(f"   Criticité Excel='{norm_str(r.get(COL_CRIT,''))}' -> mapped='{_crit(r) if 'criticality' in questions_cols else None}'")
            log(f"   Question='{qtext[:200]}'")
            conn.rollback()
            raise

        if processed % 200 == 0:
            conn.commit()
            log(f"✅ {processed} questions traitées (insert ou update)...")

    if not DRY_RUN:
        conn.commit()

    log(f"✅ Import terminé. Processed(insert-or-update)={processed} Skipped(empty question)={skipped}")
    cursor.close()
    conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"💥 Fatal error: {e}")
        raise
