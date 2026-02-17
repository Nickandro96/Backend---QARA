#!/usr/bin/env python3
import hashlib
import json
import os
import re
from collections import defaultdict

import mysql.connector
import pandas as pd

EXCEL_PATH = os.getenv("EXCEL_PATH", "")
DEFAULT_REFERENTIAL_ID = int(os.getenv("DEFAULT_REFERENTIAL_ID", "2"))
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "qara"),
}


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return value.strip("-")


def norm_criticality(value: str) -> str:
    val = (value or "").strip().lower()
    mapping = {"haute": "high", "élevée": "high", "high": "high", "moyenne": "medium", "medium": "medium", "faible": "low", "low": "low"}
    return mapping.get(val, "medium")


def str_or_none(v):
    if pd.isna(v):
        return None
    text = str(v).strip()
    return text if text else None


if not EXCEL_PATH:
    raise SystemExit("EXCEL_PATH is required")

sheet = pd.read_excel(EXCEL_PATH, header=2)
conn = mysql.connector.connect(**DB_CONFIG)
cur = conn.cursor(dictionary=True)

cur.execute("SELECT id, name FROM processus")
process_map = {r["name"].strip().lower(): r["id"] for r in cur.fetchall()}

if not DRY_RUN:
    cur.execute("DELETE FROM questions WHERE referential_id = %s", (DEFAULT_REFERENTIAL_ID,))

orders = defaultdict(int)
inserted = 0
for _, row in sheet.iterrows():
    process_name = str_or_none(row.get("Processus concerné"))
    article = str_or_none(row.get("Clause")) or "N/A"
    title = str_or_none(row.get("Intitulé")) or ""
    question_text = str_or_none(row.get("Question d’audit détaillée")) or ""
    if not process_name or not question_text:
        continue

    process_key = process_name.lower()
    process_id = process_map.get(process_key)
    if not process_id:
        slug = slugify(process_name)
        if not DRY_RUN:
            cur.execute("INSERT INTO processus(name, slug) VALUES (%s, %s)", (process_name, slug))
            process_id = cur.lastrowid
        else:
            process_id = 0
        process_map[process_key] = process_id

    expected_evidence = str_or_none(row.get("Preuves attendues"))
    interview_functions = str_or_none(row.get("Fonctions interrogées"))
    interview_json = json.dumps([x.strip() for x in interview_functions.split(",")]) if interview_functions else json.dumps([])
    criticality = norm_criticality(str_or_none(row.get("Criticité")) or "")
    risk = str_or_none(row.get("Risque"))
    question_type = str_or_none(row.get("Type")) or "check"
    iso14971 = str_or_none(row.get("ISO14971"))
    mdr = str_or_none(row.get("MDR"))
    annexe = " | ".join([x for x in [iso14971, mdr] if x]) or None

    key_raw = f"{DEFAULT_REFERENTIAL_ID}|{article}|{process_id}|{question_text}"
    question_key = hashlib.md5(key_raw.encode("utf-8")).hexdigest()
    orders[(process_id, article)] += 1
    display_order = orders[(process_id, article)]

    inserted += 1
    if not DRY_RUN:
      cur.execute(
          """
          INSERT INTO questions
            (referential_id, process_id, article, title, question_text, expected_evidence, interview_functions, criticality, risk, question_type, annexe, question_key, display_order)
          VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
          """,
          (DEFAULT_REFERENTIAL_ID, process_id, article, title, question_text, expected_evidence, interview_json, criticality, risk, question_type, annexe, question_key, display_order),
      )

if not DRY_RUN:
    conn.commit()

print(f"Imported questions: {inserted} (dry_run={DRY_RUN})")
cur.close()
conn.close()
