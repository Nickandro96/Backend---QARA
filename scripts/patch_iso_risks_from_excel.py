#!/usr/bin/env python3
"""
Patch ISO risks (and optionally expectedEvidence) WITHOUT inserting rows.
Strategy: recompute questionKey exactly like the importer and UPDATE existing rows.

- No INSERT (unless you change it)
- Safe: skips lines if process not found
- Works for ISO 9001 (referentialId=2) and ISO 13485 (referentialId=3)

Env:
  EXCEL_PATH
  DEFAULT_REFERENTIAL_ID (2 or 3)
  DRY_RUN ("1" to dry-run)
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any, Dict, Optional, Tuple, List

import mysql.connector
import pandas as pd


def getenv_str(name: str, default: str = "") -> str:
    v = os.getenv(name)
    if v is None:
        return default
    v = str(v).strip()
    return v if v else default


def getenv_int(name: str, default: int) -> int:
    v = os.getenv(name)
    if v is None or str(v).strip() == "":
        return default
    try:
        return int(str(v).strip())
    except ValueError:
        return default


def normalize_header(value: str) -> str:
    value = (value or "").strip().lower()
    value = (
        value.replace("’", "'")
        .replace("`", "'")
        .replace("é", "e")
        .replace("è", "e")
        .replace("ê", "e")
        .replace("à", "a")
        .replace("ù", "u")
        .replace("î", "i")
        .replace("ï", "i")
    )
    value = re.sub(r"\s+", " ", value)
    return value


def str_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


def resolve_sheet_value(row: pd.Series, aliases: List[str]) -> Optional[str]:
    normalized = {normalize_header(str(col)): col for col in row.index}
    for alias in aliases:
        key = normalize_header(alias)
        col = normalized.get(key)
        if col is not None:
            return str_or_none(row.get(col))
    return None


def get_required_env() -> Tuple[str, int, bool, Dict[str, Any]]:
    excel_path = getenv_str("EXCEL_PATH", "")
    referential_id = getenv_int("DEFAULT_REFERENTIAL_ID", 2)
    dry_run = getenv_str("DRY_RUN", "0") == "1"

    if not excel_path:
        raise SystemExit("EXCEL_PATH is required")
    if referential_id not in (2, 3):
        raise SystemExit("DEFAULT_REFERENTIAL_ID must be 2 (ISO9001) or 3 (ISO13485)")

    db_config = {
        "host": getenv_str("DB_HOST", "127.0.0.1"),
        "port": getenv_int("DB_PORT", 3306),
        "user": getenv_str("DB_USER", "root"),
        "password": getenv_str("DB_PASSWORD", ""),
        "database": getenv_str("DB_NAME", "railway"),
    }
    return excel_path, referential_id, dry_run, db_config


def build_sheet(path: str) -> pd.DataFrame:
    # identical to importer (header=2)
    return pd.read_excel(path, header=2)


def load_process_map(cur) -> Dict[str, int]:
    cur.execute("SELECT id, name FROM processus")
    rows = cur.fetchall()
    mp: Dict[str, int] = {}
    for r in rows:
        name = (r.get("name") or "").strip().lower()
        pid = int(r["id"])
        if name:
            mp[name] = pid
    return mp


def detect_question_columns(cur, db_name: str) -> Dict[str, str]:
    cur.execute(
        """
        SELECT COLUMN_NAME AS column_name
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=%s AND TABLE_NAME='questions'
        """,
        (db_name,),
    )
    cols = {str(r["column_name"]) for r in cur.fetchall()}

    def first_existing(cands: List[str]) -> Optional[str]:
        for c in cands:
            if c in cols:
                return c
        return None

    # We only care about these
    mapping = {
        "questionKey": first_existing(["questionKey", "question_key"]),
        "referentialId": first_existing(["referentialId", "referential_id"]),
        "risk": first_existing(["risk"]),
        "risks": first_existing(["risks"]),
        "expectedEvidence": first_existing(["expectedEvidence", "expected_evidence"]),
    }

    if not mapping["questionKey"] or not mapping["referentialId"]:
        raise SystemExit("Missing required columns in questions (questionKey/referentialId).")

    return {k: v for k, v in mapping.items() if v}


def main() -> None:
    excel_path, referential_id, dry_run, db_config = get_required_env()

    print("=== ISO PATCH RISKS START ===")
    print(f"Excel: {excel_path}")
    print(f"ReferentialId: {referential_id} (2=ISO9001, 3=ISO13485)")
    print(f"Dry-run: {dry_run}")
    print(f"DB: {db_config['host']}:{db_config['port']} / {db_config['database']} (user={db_config['user']})")

    sheet = build_sheet(excel_path)

    conn = mysql.connector.connect(**db_config)
    cur = conn.cursor(dictionary=True)

    q_cols = detect_question_columns(cur, db_config["database"])
    process_map = load_process_map(cur)

    updated = 0
    skipped = 0
    missing_process = 0
    not_found = 0

    # Prepared statement
    set_parts = []
    if q_cols.get("risk"):
        set_parts.append(f"`{q_cols['risk']}` = %s")
    if q_cols.get("risks"):
        set_parts.append(f"`{q_cols['risks']}` = %s")
    if q_cols.get("expectedEvidence"):
        set_parts.append(f"`{q_cols['expectedEvidence']}` = %s")

    if not set_parts:
        raise SystemExit("Neither risk/risks/expectedEvidence columns exist to patch.")

    sql_update = f"""
      UPDATE questions
      SET {", ".join(set_parts)}
      WHERE `{q_cols['questionKey']}` = %s AND `{q_cols['referentialId']}` = %s
    """

    for _, row in sheet.iterrows():
        process_name = resolve_sheet_value(row, ["Processus concerné", "Processus concerne"])
        article = resolve_sheet_value(row, ["Clause"]) or "N/A"
        question_text = resolve_sheet_value(
            row,
            ["Question d’audit détaillée", "Question d'audit détaillée", "Question d audit detaillee"],
        )

        if not process_name or not question_text:
            skipped += 1
            continue

        pid = process_map.get(process_name.strip().lower())
        if not pid:
            missing_process += 1
            continue

        # Values to patch
        risk = resolve_sheet_value(row, ["Risque", "Risques"])
        expected = resolve_sheet_value(row, ["Preuves attendues"])

        # Recompute questionKey EXACTLY like importer
        key_raw = f"{referential_id}|{article}|{pid}|{question_text}"
        question_key = "q_" + hashlib.md5(key_raw.encode("utf-8")).hexdigest()

        # Build params in same order as set_parts
        params: List[Any] = []
        if q_cols.get("risk"):
            params.append(risk)
        if q_cols.get("risks"):
            # store JSON array if risk exists, else NULL
            params.append(json.dumps([risk], ensure_ascii=False) if risk else None)
        if q_cols.get("expectedEvidence"):
            params.append(expected)

        # WHERE params
        params.append(question_key)
        params.append(referential_id)

        if dry_run:
            updated += 1
            continue

        cur.execute(sql_update, tuple(params))
        if cur.rowcount == 0:
            not_found += 1
        else:
            updated += 1

    if not dry_run:
        conn.commit()

    print("=== ISO PATCH RISKS RESULT ===")
    print(f"Rows in Excel: {len(sheet)}")
    print(f"Updated (or would update): {updated}")
    print(f"Skipped (missing process/question): {skipped}")
    print(f"Missing process mapping: {missing_process}")
    print(f"QuestionKey not found in DB (no update): {not_found}")
    print("=== ISO PATCH RISKS END ===")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
