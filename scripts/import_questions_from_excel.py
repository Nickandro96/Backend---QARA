import os
import json
import pandas as pd
import mysql.connector

EXCEL_PATH = "data/MDR_questionnaire_V7_CORRIGE.xlsx"

DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DB_PORT = int(os.getenv("DB_PORT", "3306"))

def j(v):
    if not v:
        return json.dumps([])
    return json.dumps([x.strip() for x in str(v).split(",") if x.strip()])

print("📥 Lecture Excel...")
df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
df = df.fillna("")

print("📊 Lignes détectées:", len(df))

conn = mysql.connector.connect(
    host=DB_HOST,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME,
    port=DB_PORT
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
        row["Clause MDR"],
        row["Objectif du processus"],
        row["Intitulé"],
        row["Question d’audit détaillée"],
        row["Type"],
        row["Risque en cas de NC"],
        row["Preuves attendues"],
        j(row["Fonctions interrogées"]),
        row["Criticité"]
    ))

    count += 1

conn.commit()
cursor.close()
conn.close()

print(f"✅ Import terminé : {count} questions insérées")
