import os
import pandas as pd
import mysql.connector
from urllib.parse import urlparse

DATABASE_URL = os.environ["DATABASE_URL"]

def connect():
    u = urlparse(DATABASE_URL)
    return mysql.connector.connect(
        host=u.hostname,
        port=u.port,
        user=u.username,
        password=u.password,
        database=u.path.replace("/", ""),
        ssl_disabled=False
    )

def get_process_map(cur):
    cur.execute("SELECT id, slug FROM processes")
    return {slug: pid for pid, slug in cur.fetchall()}

def normalize(s):
    if pd.isna(s):
        return None
    return str(s).strip()

def upsert_questions(df, referential_id):

    conn = connect()
    cur = conn.cursor()

    process_map = get_process_map(cur)

    inserted = 0
    updated = 0

    for _, r in df.iterrows():

        question_key = normalize(r.get("questionKey"))

        process_name = normalize(r.get("Processus concerné"))
        process_id = process_map.get(process_name)

        article = normalize(r.get("Clause ISO 13485") or r.get("Clause ISO 9001"))

        title = normalize(r.get("Intitulé") or r.get("Intitulé de la question"))

        question_text = normalize(r.get("Question d’audit détaillée"))

        risk = normalize(r.get("Risque en cas de NC"))

        evidence = normalize(r.get("Éléments de preuve attendus") or r.get("Preuves attendues"))

        functions = normalize(r.get("Fonctions interrogées"))

        criticality = normalize(r.get("Criticité"))

        qtype = normalize(r.get("Type"))

        cur.execute("""
        SELECT id FROM questions
        WHERE questionKey=%s AND referentialId=%s
        """, (question_key, referential_id))

        existing = cur.fetchone()

        if existing:

            cur.execute("""
            UPDATE questions SET
            processId=%s,
            article=%s,
            title=%s,
            questionText=%s,
            risk=%s,
            expectedEvidence=%s,
            interviewFunctions=%s,
            criticality=%s,
            questionType=%s
            WHERE questionKey=%s AND referentialId=%s
            """, (
                process_id,
                article,
                title,
                question_text,
                risk,
                evidence,
                functions,
                criticality,
                qtype,
                question_key,
                referential_id
            ))

            updated += 1

        else:

            cur.execute("""
            INSERT INTO questions
            (questionKey, referentialId, processId, article, title, questionText,
             risk, expectedEvidence, interviewFunctions, criticality, questionType)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                question_key,
                referential_id,
                process_id,
                article,
                title,
                question_text,
                risk,
                evidence,
                functions,
                criticality,
                qtype
            ))

            inserted += 1

    conn.commit()

    print("UPDATED:", updated)
    print("INSERTED:", inserted)

    cur.close()
    conn.close()


def run():

    iso9001 = pd.read_excel("data/Questionnaires audits iso 9001.xlsx")
    iso13485 = pd.read_excel("data/Questionnaires audits iso 13485.xlsx")

    upsert_questions(iso9001, 2)
    upsert_questions(iso13485, 3)

if __name__ == "__main__":
    run()
