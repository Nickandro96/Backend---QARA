import os
import json
import hashlib
import pandas as pd
import mysql.connector
from urllib.parse import urlparse

EXCEL_PATH = "data/MDR_questionnaire_V7_CORRIGE.xlsx"
DEFAULT_REFERENTIAL_ID = 1  # MDR
DEFAULT_ECONOMIC_ROLE = None  # or "fabricant"/"importateur"/etc if you want to force
DEFAULT_ANNEXE = None

def safe_str(v):
    if v is None:
        return ""
    return str(v).strip()

def normalize_process_name(raw):
    # Keep a readable name for DB processus.name
    s = safe_str(raw)
    # fallback if empty
    return s if s else "Non défini"

def process_token_from_name(raw):
    # Token stored in applicableProcesses JSON array
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

# ---- Load / build process map ----
print("🧭 Chargement table processus...")
cursor.execute("SELECT id, name FROM processus")
rows = cursor.fetchall()

process_name_to_id = {}
for pid, pname in rows:
    if pname is None:
        continue
    process_name_to_id[str(pname).strip().lower()] = int(pid)

def get_or_create_process_id(process_name: str) -> int:
    key = process_name.strip().lower()
    if key in process_name_to_id:
        return process_name_to_id[key]

    # create
    cursor.execute(
        "INSERT INTO processus (name, createdAt, updatedAt) VALUES (%s, NOW(), NOW())",
        (process_name,)
    )
    conn.commit()
    new_id = cursor.lastrowid
    process_name_to_id[key] = int(new_id)
    print(f"➕ Processus créé: '{process_name}' -> id={new_id}")
    return int(new_id)

# ---- Clean questions ----
print("🧹 Suppression anciennes questions...")
cursor.execute("DELETE FROM questions")
conn.commit()

insert_sql = """
INSERT INTO questions (
  referentialId,
  processId,
  questionKey,
  article,
  annexe,
  title,
  economicRole,
  applicableProcesses,
  questionType,
  questionText,
  expectedEvidence,
  criticality,
  risk,
  risks,
  interviewFunctions,
  displayOrder,
  createdAt
)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
"""

count = 0
display_order = 1

for _, row in df.iterrows():
    # Excel headers:
    # Processus concerné | Objectif du processus | Clause MDR | Intitulé | Question d’audit détaillée
    # Type | Risque en cas de NC | Preuves attendues | Fonctions interrogées | Criticité

    process_raw = row.get("Processus concerné", "")
    process_name = normalize_process_name(process_raw)
    process_token = process_token_from_name(process_raw)

    objective = safe_str(row.get("Objectif du processus", ""))
    clause = safe_str(row.get("Clause MDR", ""))
    intitulé = safe_str(row.get("Intitulé", ""))
    question_text = safe_str(row.get("Question d’audit détaillée", ""))
    qtype = safe_str(row.get("Type", ""))
    risk_nc = safe_str(row.get("Risque en cas de NC", ""))
    evidence = safe_str(row.get("Preuves attendues", ""))
    functions = row.get("Fonctions interrogées", "")
    criticality = safe_str(row.get("Criticité", ""))

    # Skip empty question rows
    if not question_text:
        continue

    # processId must NOT be null
    process_id = get_or_create_process_id(process_name)

    # Build title: prefer "Intitulé", fallback objective
    title = intitulé if intitulé else (objective if objective else None)

    question_key = make_question_key(clause, process_token, question_text)

    cursor.execute(
        insert_sql,
        (
            DEFAULT_REFERENTIAL_ID,
            process_id,  # ✅ NOT NULL now
            question_key,
            clause if clause else None,
            DEFAULT_ANNEXE,
            title,
            DEFAULT_ECONOMIC_ROLE,
            to_json_array_single(process_token) if process_token else json.dumps([]),
            qtype if qtype else None,
            question_text,
            evidence if evidence else None,
            criticality if criticality else None,
            risk_nc if risk_nc else None,
            risk_nc if risk_nc else None,
            to_json_array_from_csv(functions),
            display_order,
        ),
    )

    count += 1
    display_order += 1

conn.commit()
cursor.close()
conn.close()

print(f"✅ Import terminé : {count} questions insérées")
