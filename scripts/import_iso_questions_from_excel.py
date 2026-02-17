#!/usr/bin/env python3
"""
ISO questions importer (ISO 9001 / ISO 13485) for MySQL.

Robust features:
- header=2
- purge per referential
- auto-create missing processes
- questionKey = q_ + md5(...)
- supports process table with/without slug
- supports economicRole NOT NULL (uses 'N/A')
- ensures referentialId exists in referentials (avoids FK failure)
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Tuple

import mysql.connector
import pandas as pd
from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursorDict


def getenv_str(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def getenv_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(str(raw).strip())
    except ValueError:
        print(f"[WARN] {name}='{raw}' is invalid, fallback to {default}")
        return default


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return value.strip("-")


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


def norm_criticality(value: str) -> str:
    val = (value or "").strip().lower()
    mapping = {
        "haute": "high",
        "elevee": "high",
        "élevee": "high",
        "élevée": "high",
        "high": "high",
        "moyenne": "medium",
        "medium": "medium",
        "faible": "low",
        "low": "low",
        "critique": "high",
    }
    return mapping.get(val, "medium")


def str_or_none(value: Any) -> Optional[str]:
    if pd.isna(value):
        return None
    text = str(value).strip()
    return text if text else None


def split_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [part.strip() for part in re.split(r"[,;/|]", value) if part and part.strip()]


def quote_identifier(name: str) -> str:
    return f"`{name}`"


def first_existing(candidates: Iterable[str], existing_columns: set[str]) -> Optional[str]:
    for candidate in candidates:
        if candidate in existing_columns:
            return candidate
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
        "database": getenv_str("DB_NAME", "qara"),
    }

    return excel_path, referential_id, dry_run, db_config


def build_sheet(path: str) -> pd.DataFrame:
    return pd.read_excel(path, header=2)


def resolve_sheet_value(row: pd.Series, aliases: List[str]) -> Optional[str]:
    normalized = {normalize_header(str(col)): col for col in row.index}
    for alias in aliases:
        col = normalized.get(normalize_header(alias))
        if col is not None:
            return str_or_none(row.get(col))
    return None


def _pick_field(row: Optional[Dict[str, Any]], *names: str) -> Optional[Any]:
    if not row:
        return None
    lower = {str(k).lower(): k for k in row.keys()}
    for name in names:
        k = lower.get(name.lower())
        if k is not None:
            return row.get(k)
    return None


def table_exists(cur: MySQLCursorDict, db_name: str, table: str) -> bool:
    cur.execute(
        """
        SELECT COUNT(*) AS c
        FROM information_schema.tables
        WHERE table_schema=%s AND table_name=%s
        """,
        (db_name, table),
    )
    row = cur.fetchone()
    return bool(row and int(_pick_field(row, "c", "C", "count", "COUNT") or 0) > 0)


def resolve_table_columns(cur: MySQLCursorDict, db_name: str, table_name: str) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT
          COLUMN_NAME AS column_name,
          IS_NULLABLE AS is_nullable,
          DATA_TYPE AS data_type,
          COLUMN_TYPE AS column_type
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        """,
        (db_name, table_name),
    )
    return cur.fetchall()


def resolve_process_table(cur: MySQLCursorDict, db_name: str) -> str:
    cur.execute(
        """
        SELECT table_name AS table_name
        FROM information_schema.tables
        WHERE table_schema = %s
          AND table_name IN ('processus', 'processes')
        ORDER BY CASE table_name WHEN 'processus' THEN 0 ELSE 1 END
        LIMIT 1
        """,
        (db_name,),
    )
    row = cur.fetchone()
    table_name = _pick_field(row, "table_name", "TABLE_NAME")
    if not table_name:
        raise SystemExit("Table process manquante (attendu: processus ou processes)")
    return str(table_name)


def resolve_process_columns(cur: MySQLCursorDict, db_name: str, process_table: str) -> set[str]:
    rows = resolve_table_columns(cur, db_name, process_table)
    cols: set[str] = set()
    for r in rows:
        col = _pick_field(r, "column_name", "COLUMN_NAME")
        if col:
            cols.add(str(col))
    if not cols:
        raise SystemExit(f"Impossible de lire les colonnes de la table {process_table}")
    return cols


def resolve_questions_columns(cur: MySQLCursorDict, db_name: str) -> Tuple[Dict[str, str], Dict[str, Dict[str, Any]]]:
    rows = resolve_table_columns(cur, db_name, "questions")

    q_columns: set[str] = set()
    meta: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        col = _pick_field(r, "column_name", "COLUMN_NAME")
        if not col:
            continue
        col_name = str(col)
        q_columns.add(col_name)
        meta[col_name] = {
            "is_nullable": str(_pick_field(r, "is_nullable", "IS_NULLABLE") or "").upper(),
            "data_type": str(_pick_field(r, "data_type", "DATA_TYPE") or ""),
            "column_type": str(_pick_field(r, "column_type", "COLUMN_TYPE") or ""),
        }

    if not q_columns:
        raise SystemExit("Table 'questions' introuvable dans le schéma cible")

    columns = {
        "referential": first_existing(["referentialId", "referential_id"], q_columns),
        "process": first_existing(["processId", "process_id"], q_columns),
        "article": first_existing(["article"], q_columns),
        "title": first_existing(["title"], q_columns),
        "question_text": first_existing(["questionText", "question_text"], q_columns),
        "expected": first_existing(["expectedEvidence", "expected_evidence"], q_columns),
        "interview": first_existing(["interviewFunctions", "interview_functions"], q_columns),
        "criticality": first_existing(["criticality"], q_columns),
        "risk": first_existing(["risk", "risks"], q_columns),
        "question_type": first_existing(["questionType", "question_type"], q_columns),
        "annexe": first_existing(["annexe", "annex", "notes"], q_columns),
        "question_key": first_existing(["questionKey", "question_key"], q_columns),
        "display_order": first_existing(["displayOrder", "display_order"], q_columns),
        "economic_role": first_existing(["economicRole", "economic_role"], q_columns),
        "applicable": first_existing(["applicableProcesses", "applicable_processes"], q_columns),
    }

    required = [
        ("referentialId", columns["referential"]),
        ("processId", columns["process"]),
        ("article", columns["article"]),
        ("questionText", columns["question_text"]),
        ("questionKey", columns["question_key"]),
        ("displayOrder", columns["display_order"]),
    ]
    missing = [label for label, real_col in required if real_col is None]
    if missing:
        raise SystemExit(f"Colonnes requises manquantes dans questions: {', '.join(missing)}")

    return ({k: v for k, v in columns.items() if v is not None}, meta)


def ensure_referential_exists(
    *,
    cur: MySQLCursorDict,
    db_name: str,
    referential_id: int,
    dry_run: bool,
) -> None:
    if not table_exists(cur, db_name, "referentials"):
        raise SystemExit("Table 'referentials' introuvable (FK referentialId -> referentials.id).")

    cur.execute("SELECT id FROM referentials WHERE id = %s", (referential_id,))
    row = cur.fetchone()
    if row:
        return

    # Not found -> try to create it (best effort, adapt to columns)
    ref_name = "ISO 9001" if referential_id == 2 else "ISO 13485"
    ref_code = "ISO9001" if referential_id == 2 else "ISO13485"

    cols_info = resolve_table_columns(cur, db_name, "referentials")
    cols = {str(_pick_field(r, "column_name", "COLUMN_NAME")) for r in cols_info if _pick_field(r, "column_name", "COLUMN_NAME")}
    cols_lower = {c.lower() for c in cols}

    if dry_run:
        print(f"[DRY_RUN] Would ensure referential exists: id={referential_id}, name={ref_name}, code={ref_code}")
        return

    # Build insert with available columns
    insert_cols: List[str] = []
    insert_vals: List[Any] = []

    # We prefer forcing the id to match FK expectations
    if "id" in cols_lower:
        insert_cols.append("id")
        insert_vals.append(referential_id)
    else:
        raise SystemExit("Table 'referentials' has no 'id' column? Cannot satisfy FK.")

    if "name" in cols_lower:
        insert_cols.append("name")
        insert_vals.append(ref_name)

    if "code" in cols_lower:
        insert_cols.append("code")
        insert_vals.append(ref_code)

    # Common timestamp fields
    if "createdat" in cols_lower:
        insert_cols.append("createdAt")
        insert_vals.append(None)
    if "updatedat" in cols_lower:
        insert_cols.append("updatedAt")
        insert_vals.append(None)

    if len(insert_cols) < 1:
        raise SystemExit(f"Cannot build INSERT for referentials; detected cols: {sorted(cols)}")

    cols_sql = ", ".join(quote_identifier(c) for c in insert_cols)
    placeholders = ", ".join(["%s"] * len(insert_cols))

    sql = f"INSERT INTO referentials ({cols_sql}) VALUES ({placeholders})"
    try:
        cur.execute(sql, tuple(insert_vals))
        print(f"Created referential: id={referential_id} name='{ref_name}' (cols used={insert_cols})")
    except Exception as e:
        raise SystemExit(
            "Failed to create referential automatically. "
            f"Please create row in 'referentials' with id={referential_id} manually. "
            f"Detected columns: {sorted(cols)}. Error: {e}"
        )


def load_process_map(cur: MySQLCursorDict, process_table: str) -> Dict[str, int]:
    cur.execute(f"SELECT id, name FROM {quote_identifier(process_table)}")
    return {str(r["name"]).strip().lower(): int(r["id"]) for r in cur.fetchall()}


def ensure_process_id(
    *,
    cur: MySQLCursorDict,
    process_table: str,
    process_columns: set[str],
    process_map: Dict[str, int],
    process_name: str,
    dry_run: bool,
) -> int:
    key = process_name.strip().lower()
    existing = process_map.get(key)
    if existing is not None:
        return existing

    if dry_run:
        deterministic = int(hashlib.md5(key.encode("utf-8")).hexdigest()[:8], 16)
        process_map[key] = deterministic
        return deterministic

    if "slug" in process_columns:
        slug = slugify(process_name)
        cur.execute(
            f"INSERT INTO {quote_identifier(process_table)}(name, slug) VALUES (%s, %s)",
            (process_name, slug),
        )
    else:
        cur.execute(
            f"INSERT INTO {quote_identifier(process_table)}(name) VALUES (%s)",
            (process_name,),
        )

    process_id = int(cur.lastrowid)
    process_map[key] = process_id
    return process_id


def count_questions(cur: MySQLCursorDict, q_cols: Dict[str, str], referential_id: int) -> int:
    sql = f"SELECT COUNT(*) AS c FROM questions WHERE {quote_identifier(q_cols['referential'])} = %s"
    cur.execute(sql, (referential_id,))
    row = cur.fetchone()
    return int(_pick_field(row, "c", "C") or 0)


def main() -> None:
    excel_path, referential_id, dry_run, db_config = get_required_env()
    sheet = build_sheet(excel_path)

    conn: Optional[MySQLConnection] = None
    cur: Optional[MySQLCursorDict] = None

    try:
        print("=== ISO IMPORT START ===")
        print(f"Excel: {excel_path}")
        print(f"Referential: {referential_id} (2=ISO9001, 3=ISO13485)")
        print(f"Dry-run: {dry_run}")
        print(f"DB: {db_config['host']}:{db_config['port']} / {db_config['database']} (user={db_config['user']})")

        conn = mysql.connector.connect(**db_config)
        cur = conn.cursor(dictionary=True)

        # Ensure FK referential exists
        ensure_referential_exists(cur=cur, db_name=db_config["database"], referential_id=referential_id, dry_run=dry_run)

        process_table = resolve_process_table(cur, db_config["database"])
        process_columns = resolve_process_columns(cur, db_config["database"], process_table)
        q_cols, q_meta = resolve_questions_columns(cur, db_config["database"])
        process_map = load_process_map(cur, process_table)

        before = count_questions(cur, q_cols, referential_id)
        print(f"Questions already in DB for referential {referential_id}: {before}")
        print(f"Process table detected: {process_table} (cols: {sorted(process_columns)})")

        economic_role_col = q_cols.get("economic_role")
        economic_role_is_nullable = None
        if economic_role_col and economic_role_col in q_meta:
            economic_role_is_nullable = q_meta[economic_role_col]["is_nullable"]  # YES/NO
        print(f"EconomicRole column: {economic_role_col} (nullable={economic_role_is_nullable})")

        if not dry_run:
            purge_sql = f"DELETE FROM questions WHERE {quote_identifier(q_cols['referential'])} = %s"
            cur.execute(purge_sql, (referential_id,))
            print(f"Purged existing questions for referential {referential_id}")

        orders: defaultdict[Tuple[int, str], int] = defaultdict(int)
        inserted = 0
        skipped = 0

        for _, row in sheet.iterrows():
            process_name = resolve_sheet_value(row, ["Processus concerné", "Processus concerne"])
            article = resolve_sheet_value(row, ["Clause"]) or "N/A"
            title = resolve_sheet_value(row, ["Intitulé", "Intitule"]) or ""
            question_text = resolve_sheet_value(
                row,
                ["Question d’audit détaillée", "Question d'audit détaillée", "Question d audit detaillee"],
            ) or ""

            if not process_name or not question_text:
                skipped += 1
                continue

            process_id = ensure_process_id(
                cur=cur,
                process_table=process_table,
                process_columns=process_columns,
                process_map=process_map,
                process_name=process_name,
                dry_run=dry_run,
            )

            expected_evidence = resolve_sheet_value(row, ["Preuves attendues"])
            interview_functions_raw = resolve_sheet_value(row, ["Fonctions interrogées", "Fonctions interrogees"])
            interview_functions = split_list(interview_functions_raw)
            criticality = norm_criticality(resolve_sheet_value(row, ["Criticité", "Criticite"]) or "")
            risk = resolve_sheet_value(row, ["Risque"])
            question_type = (resolve_sheet_value(row, ["Type"]) or "check").strip().lower()

            iso14971 = resolve_sheet_value(row, ["ISO14971"])
            mdr = resolve_sheet_value(row, ["MDR"])
            annexe = " | ".join([x for x in [iso14971, mdr] if x]) or None

            key_raw = f"{referential_id}|{article}|{process_id}|{question_text}"
            question_key = "q_" + hashlib.md5(key_raw.encode("utf-8")).hexdigest()

            orders[(process_id, article)] += 1
            display_order = orders[(process_id, article)]

            values: Dict[str, Any] = {
                q_cols["referential"]: referential_id,
                q_cols["process"]: process_id,
                q_cols["article"]: article,
                q_cols["question_text"]: question_text,
                q_cols["question_key"]: question_key,
                q_cols["display_order"]: display_order,
            }

            if "title" in q_cols:
                values[q_cols["title"]] = title
            if "expected" in q_cols:
                values[q_cols["expected"]] = expected_evidence
            if "interview" in q_cols:
                values[q_cols["interview"]] = json.dumps(interview_functions, ensure_ascii=False)
            if "criticality" in q_cols:
                values[q_cols["criticality"]] = criticality
            if "risk" in q_cols:
                values[q_cols["risk"]] = risk
            if "question_type" in q_cols:
                values[q_cols["question_type"]] = question_type
            if "annexe" in q_cols:
                values[q_cols["annexe"]] = annexe

            if economic_role_col:
                values[economic_role_col] = "N/A" if economic_role_is_nullable == "NO" else None

            if "applicable" in q_cols:
                values[q_cols["applicable"]] = json.dumps([process_name], ensure_ascii=False)

            inserted += 1
            if not dry_run:
                cols = ", ".join(quote_identifier(c) for c in values.keys())
                placeholders = ", ".join(["%s"] * len(values))
                sql = f"INSERT INTO questions ({cols}) VALUES ({placeholders})"
                cur.execute(sql, tuple(values.values()))

        if not dry_run:
            conn.commit()

        after = count_questions(cur, q_cols, referential_id)
        print("=== ISO IMPORT RESULT ===")
        print(f"Rows parsed: {len(sheet)}")
        print(f"Inserted (or would insert): {inserted}")
        print(f"Skipped (missing process/question): {skipped}")
        print(f"Questions in DB for referential {referential_id}: before={before}, after={after}")
        print("=== ISO IMPORT END ===")

    except Exception:
        if conn is not None and conn.is_connected():
            conn.rollback()
        raise
    finally:
        if cur is not None:
            cur.close()
        if conn is not None and conn.is_connected():
            conn.close()


if __name__ == "__main__":
    main()
