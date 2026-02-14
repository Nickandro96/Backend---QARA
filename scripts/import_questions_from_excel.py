import os
import json
import hashlib
import pandas as pd
import mysql.connector
from urllib.parse import urlparse

EXCEL_PATH = "data/MDR_questionnaire_V7_CORRIGE.xlsx"
DEFAULT_REFERENTIAL_ID = 1  # MDR

def safe_str(v):
    if v is None:
        return ""
    return str(v).strip()

def normalize_process_name(raw):
    s = safe_str(raw)
    return s if s else "Non défini"

def process_token_from_name(raw):
    s = safe_str(raw).lower()
    s = s.replace("’", "'")
    s = s.replace("/", " ")
    s = " ".join(s.split())
    s = s.replace(" ", "_")
    return s

def to_json_array_from_csv(v):
    s = safe_str(v)
    if not s:
        return json.dumps([])
    arr = [x.strip() for x in s.split(",") if x.strip()]
    return json.dumps(arr)

def to_json_array_single(v):
    s = safe_str(v)
    if not s:
        return json.dumps([])
    return json.dumps([s])

def make_question_key(article, process_token, question_text):
    base = f"{safe_str(article)}|{safe_str(process_token)}|{safe_str(question_text)}"
    h = hashlib.md5(base.encode("utf-8")).hexdigest()
    return f"q_{h}"

def get_db_config():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        u = urlparse(database_url)
        host = u.hostname
        port = u.port or 3306
        user = u.username
        password = u.password
        db = (u.path or "").lstrip("/")
        if not all([host, user, password, db]):
            raise RuntimeError("DATABASE_URL is set but missing required parts (host/user/password/db).")
        return host, port, user, password, db

    host = os.getenv("DB_HOST")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    db = os.getenv("DB_NAME")
    if not all([host, user, password, db]):
        raise RuntimeError(
            "Missing DB connection env vars. Set DATABASE_URL (recommended) "
            "or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME."
        )
    return host, port, user, password, db

def get_table_columns(cursor, dbname, table_name):
    cursor.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        """,
        (dbname, table_name),
    )
    return {r[0] for r in cursor.fetchall()}

print("📥 Lecture Excel...")
df = pd.read_excel(EXCEL_PATH, engine="openpyxl").fillna("")
print("📊 Lignes détectées:", len(df))

host, port, user, password, dbname = get_db_config()
print(f"🔌 Connexion MySQL -> host={host} port={port} db={dbname} user={user}")

conn = mysql.connector.connect(
    host=host,
    port=port,
    user=user,
    password=password,
    database=dbname,
    connection_timeout=30
)
cursor = conn.cursor()

# Detect real columns
process_cols = get_table_columns(cursor, dbname, "processus")
questions_cols = get_table_columns(cursor, dbname, "questions")

print("🧭 Colonnes table processus:", sorted(process_cols))
print("🧾 Colonnes table questions:", sorted(questions_cols))

# ---- Load process map ----
print("🧭 Chargement table processus...")
cursor.execute("SELECT id, name FROM processus")
rows = cursor.fetchall()

process_name_to_id = {}
for pid, pname in rows:
    if pname is None:
        continue
    process_name_to_id[str(pname).strip().lower()] = int(pid)

def insert_process(process_name: str) -> int:
    # Build insert according to existing cols
    cols = ["name"]
    vals = [process_name]
    placeholders = ["%s"]

    # createdAt if exists
    if "createdAt" in process_cols:
        cols.append("createdAt")
        placeholders.append("NOW()")
    # updatedAt if exists
    if "updatedAt" in process_cols:
        cols.append("updatedAt")
        placeholders.append("NOW()")

    sql = f"INSERT INTO processus ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
    cursor.execute(sql, tuple(vals))
    conn.commit()
    return int(cursor.lastrowid)

def get_or_create_process_id(process_name: str) -> int:
    key = process_name.strip().lower()
    if key in process_name_to_id:
        return process_name_to_id[key]

    new_id = insert_process(process_name)
    process_name_to_id[key] = new_id
    print(f"➕ Processus créé: '{process_name}' -> id={new_id}")
    return new_id

# ---- Clean questions ----
print("🧹 Suppression anciennes questions...")
cursor.execute("DELETE FROM questions")
conn.commit()

# Build INSERT for questions based on existing columns
# We will attempt to fill the most useful columns, but ONLY if present.
insert_columns = []
insert_values_sql = []  # placeholders / NOW()
param_getters = []      # lambda row -> value

def add_col(col_name, placeholder, getter=None):
    insert_columns.append(col_name)
    insert_values_sql.append(placeholder)
    if getter is not None:
        param_getters.append(getter)

# Mandatory-ish
if "referentialId" in questions_cols:
    add_col("referentialId", "%s", lambda r: DEFAULT_REFERENTIAL_ID)

if "processId" in questions_cols:
    add_col("processId", "%s", lambda r: r["_process_id"])

if "questionKey" in questions_cols:
    add_col("questionKey", "%s", lambda r: r["_question_key"])

if "article" in questions_cols:
    add_col("article", "%s", lambda r: r["_clause"] or None)

if "annexe" in questions_cols:
    add_col("annexe", "%s", lambda r: None)

if "title" in questions_cols:
    add_col("title", "%s", lambda r: r["_title"] or None)

if "economicRole" in questions_cols:
    # keep null; filtering by role remains possible later
    add_col("economicRole", "%s", lambda r: None)

if "applicableProcesses" in questions_cols:
    add_col("applicableProcesses", "%s", lambda r: r["_applicable_processes_json"])

if "questionType" in questions_cols:
    add_col("questionType", "%s", lambda r: r["_qtype"] or None)

if "questionText" in questions_cols:
    add_col("questionText", "%s", lambda r: r["_question_text"])

if "expectedEvidence" in questions_cols:
    add_col("expectedEvidence", "%s", lambda r: r["_evidence"] or None)

if "criticality" in questions_cols:
    add_col("criticality", "%s", lambda r: r["_criticality"] or None)

# risk / risks : depends what exists
if "risk" in questions_cols:
    add_col("risk", "%s", lambda r: r["_risk"] or None)
if "risks" in questions_cols:
    add_col("risks", "%s", lambda r: r["_risk"] or None)

if "interviewFunctions" in questions_cols:
    add_col("interviewFunctions", "%s", lambda r: r["_functions_json"])

if "displayOrder" in questions_cols:
    add_col("displayOrder", "%s", lambda r: r["_display_order"])

if "createdAt" in questions_cols:
    add_col("createdAt", "NOW()")  # no param

if not insert_columns:
    raise RuntimeError("No compatible columns found for table 'questions'. Check table name / schema.")

insert_sql = f"INSERT INTO questions ({', '.join(insert_columns)}) VALUES ({', '.join(insert_values_sql)})"
print("🧾 SQL INSERT questions prêt.")

count = 0
display_order = 1

for _, row in df.iterrows():
    process_raw = row.get("Processus concerné", "")
    process_name = normalize_process_name(process_raw)
    process_token = process_token_from_name(process_raw)

    clause = safe_str(row.get("Clause MDR", ""))
    intitulé = safe_str(row.get("Intitulé", ""))
    objective = safe_str(row.get("Objectif du processus", ""))
    question_text = safe_str(row.get("Question d’audit détaillée", ""))
    qtype = safe_str(row.get("Type", ""))
    risk_nc = safe_str(row.get("Risque en cas de NC", ""))
    evidence = safe_str(row.get("Preuves attendues", ""))
    functions = row.get("Fonctions interrogées", "")
    criticality = safe_str(row.get("Criticité", ""))

    if not question_text:
        continue

    process_id = get_or_create_process_id(process_name)
    title = intitulé if intitulé else (objective if objective else None)
    question_key = make_question_key(clause, process_token, question_text)

    # Make a dict to pass to getters
    ctx = {
        "_process_id": process_id,
        "_question_key": question_key,
        "_clause": clause,
        "_title": title,
        "_qtype": qtype,
        "_question_text": question_text,
        "_risk": risk_nc,
        "_evidence": evidence,
        "_criticality": criticality,
        "_functions_json": to_json_array_from_csv(functions),
        "_applicable_processes_json": to_json_array_single(process_token) if process_token else json.dumps([]),
        "_display_order": display_order,
    }

    params = []
    for getter in param_getters:
        params.append(getter(ctx))

    cursor.execute(insert_sql, tuple(params))

    count += 1
    display_order += 1

conn.commit()
cursor.close()
conn.close()

print(f"✅ Import terminé : {count} questions insérées")
