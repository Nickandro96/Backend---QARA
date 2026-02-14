import os
import json
import pandas as pd
import mysql.connector
from urllib.parse import urlparse

EXCEL_PATH = "data/MDR_questionnaire_V7_CORRIGE.xlsx"

def j(v):
    if not v:
        return json.dumps([])
    return json.dumps([x.strip() for x in str(v).split(",") if x.strip()])

def get_db_config():
    # ✅ Preferred: DATABASE_URL (same as drizzle)
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        u = urlparse(database_url)
        # mysql://user:pass@host:port/dbname
        host = u.hostname
        port = u.port or 3306
        user = u.username
        password = u.password
        db = (u.path or "").lstrip("/")
        if not all([host, user, password, db]):
            raise RuntimeError("DATABASE_URL is set but missing required parts (host/user/password/db).")
        return host, port, user, password, db

    # Fallback: split vars
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

print("🧹 Suppression anciennes questions...")
cursor.execute("DELETE FROM questions")

insert_sql = """
INSERT INTO questions (
    processId,
    article,
    title,
    referenceLabel,
    questionText,
    questionType,
    risk,
    expectedEvidence,
    interviewFunctions,
    criticality
)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""

count = 0
for _, row in df.iterrows():
    process = str(row["Processus concerné"]).strip().lower().replace(" ", "_")

    cursor.execute(insert_sql, (
        process,
        str(row["Clause MDR"]).strip(),
        str(row["Objectif du processus"]).strip(),
        str(row["Intitulé"]).strip(),
        str(row["Question d’audit détaillée"]).strip(),
        str(row["Type"]).strip(),
        str(row["Risque en cas de NC"]).strip(),
        str(row["Preuves attendues"]).strip(),
        j(row["Fonctions interrogées"]),
        str(row["Criticité"]).strip()
    ))
    count += 1

conn.commit()
cursor.close()
conn.close()

print(f"✅ Import terminé : {count} questions insérées")
