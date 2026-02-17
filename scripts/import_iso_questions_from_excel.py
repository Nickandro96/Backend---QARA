#!/usr/bin/env python3
"""
ISO questions importer (ISO 9001 / ISO 13485) for MySQL.

Key goals:
- Header starts at row index 2 (header=2)
- Purge/reimport ONLY the targeted referential
- Resolve/create process from "Processus concerné"
- Stable questionKey = md5(referentialId|article|processId|questionText)
- Compatible with snake_case and camelCase DB schemas
- Force economicRole = NULL for ISO

Env variables:
- EXCEL_PATH (required)
- DEFAULT_REFERENTIAL_ID (2 or 3)
- DRY_RUN (0/1)
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections import defaultdict
from typing import Dict, List, Optional

import mysql.connector
import pandas as pd


def getenv_str(name: str, default: str) -> str:
    v = os.getenv(name)
    if v is None:
        return default
    v = str(v).strip()
    return v if v else default


def getenv_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(str(raw).strip())
    except ValueError:
        print(f"[WARN] {name}='{raw}' is invalid, fallback to {default}")
        return default


EXCEL_PATH = getenv_str("EXCEL_PATH", "")
DEFAULT_REFERENTIAL_ID = getenv_int("DEFAULT_REFERENTIAL_ID", 2)
DRY_RUN = getenv_str("DRY_RUN", "0") == "1"

DB_CONFIG = {
    "host": getenv_str("DB_HOST", "127.0.0.1"),
    "port": getenv_int("DB_PORT", 3306),
    "user": getenv_str("DB_USER", "root"),
    "password": getenv_str("DB_PASSWORD", ""),
    "database": getenv_str("DB_NAME", "qara"),
}


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return value.strip("-")


def norm_criticality(value: str) -> str:
    val = (value or "").strip().lower()
    mapping = {
        "haute": "high",
        "élevée": "high",
        "elevee": "high",
        "high": "high",
        "moyenne": "medium",
        "medium": "medium",
        "faible": "low",
        "low": "low",
        "critique": "high",
    }
    return mapping.get(val, "medium")


def str_or_none(v) -> Optional[str]:
    if pd.isna(v):
        return None
    text = str(v).strip()
    return text if text else None


def split_list(v: Optional[str]) -> List[str]:
    if not v:
        return []
    parts = re.split(r"[,;/|]", v)
    return [p.strip() for p in parts if p and p.strip()]


def quote_identifier(name: str) -> str:
    return f"`{name}`"


def first_existing(candidates: List[str], existing_columns: set[str]) -> Optional[str]:
    for c in candidates:
        if c in existing_columns:
            return c
    return None


if not EXCEL_PATH:
    raise SystemExit("EXCEL_PATH is required")

if DEFAULT_REFERENTIAL_ID not in (2, 3):
    raise SystemExit("DEFAULT_REFERENTIAL_ID must be 2 (ISO9001) or 3 (ISO13485)")

sheet = pd.read_excel(EXCEL_PATH, header=2)
conn = mysql.connector.connect(**DB_CONFIG)
cur = conn.cursor(dictionary=True)

# Detect questions schema columns dynamically
cur.execute(
    """
    SELECT COLUMN_NAME
    FROM information_schema.columns
    WHERE table_schema = %s AND table_name = 'questions'
    """,
    (DB_CONFIG["database"],),
)
q_columns = {r["COLUMN_NAME"] for r in cur.fetchall()}
if not q_columns:
    raise SystemExit("Table 'questions' introuvable dans le schéma cible")

col_referential = first_existing(["referentialId", "referential_id"], q_columns)
col_process = first_existing(["processId", "process_id"], q_columns)
col_article = first_existing(["article"], q_columns)
col_title = first_existing(["title"], q_columns)
col_qtext = first_existing(["questionText", "question_text"], q_columns)
col_expected = first_existing(["expectedEvidence", "expected_evidence"], q_columns)
col_interview = first_existing(["interviewFunctions", "interview_functions"], q_columns)
col_criticality = first_existing(["criticality"], q_columns)
col_risk = first_existing(["risk", "risks"], q_columns)
col_qtype = first_existing(["questionType", "question_type"], q_columns)
col_annexe = first_existing(["annexe", "annex", "notes"], q_columns)
col_qkey = first_existing(["questionKey", "question_key"], q_columns)
col_display = first_existing(["displayOrder", "display_order"], q_columns)
col_economic_role = first_existing(["economicRole", "economic_role"], q_columns)
col_applicable = first_existing(["applicableProcesses", "applicable_processes"], q_columns)

required = [
    ("referentialId", col_referential),
    ("processId", col_process),
    ("article", col_article),
    ("questionText", col_qtext),
    ("questionKey", col_qkey),
    ("displayOrder", col_display),
]
missing = [label for label, real_col in required if real_col is None]
if missing:
    raise SystemExit(f"Colonnes requises manquantes dans questions: {', '.join(missing)}")

# Load process table
cur.execute("SELECT id, name FROM processus")
process_map = {r["name"].strip().lower(): r["id"] for r in cur.fetchall()}

if not DRY_RUN:
    purge_sql = f"DELETE FROM questions WHERE {quote_identifier(col_referential)} = %s"
    cur.execute(purge_sql, (DEFAULT_REFERENTIAL_ID,))

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
    interview_functions_raw = str_or_none(row.get("Fonctions interrogées"))
    interview_functions = split_list(interview_functions_raw)
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

    values: Dict[str, object] = {
        col_referential: DEFAULT_REFERENTIAL_ID,
        col_process: process_id,
        col_article: article,
        col_qtext: question_text,
        col_qkey: question_key,
        col_display: display_order,
    }

    if col_title:
        values[col_title] = title
    if col_expected:
        values[col_expected] = expected_evidence
    if col_interview:
        values[col_interview] = json.dumps(interview_functions, ensure_ascii=False)
    if col_criticality:
        values[col_criticality] = criticality
    if col_risk:
        values[col_risk] = risk
    if col_qtype:
        values[col_qtype] = question_type
    if col_annexe:
        values[col_annexe] = annexe
    if col_economic_role:
        values[col_economic_role] = None
    if col_applicable:
        values[col_applicable] = json.dumps([process_name], ensure_ascii=False)

    inserted += 1
    if not DRY_RUN:
        cols = ", ".join(quote_identifier(c) for c in values.keys())
        placeholders = ", ".join(["%s"] * len(values))
        insert_sql = f"INSERT INTO questions ({cols}) VALUES ({placeholders})"
        cur.execute(insert_sql, tuple(values.values()))

if not DRY_RUN:
    conn.commit()

print(f"Imported questions: {inserted} (dry_run={DRY_RUN}, referential={DEFAULT_REFERENTIAL_ID})")
cur.close()
conn.close()
