#!/usr/bin/env python3
"""
Patch ISO risk fields WITHOUT inserting rows.

V2 strategy:
1) Prefer UPDATE by (referentialId + code) if Excel provides "code"
2) Fallback UPDATE by (referentialId + processId + article + normalized questionText)

Fixes in this version:
- Railway/MySQL proxy often requires SSL: enable SSL (rejectUnauthorized=False equivalent)
- Add connect retry/backoff + timeouts to avoid transient handshake failures
"""

from __future__ import annotations

import os
import re
import time
from typing import Any, Dict, Optional, List

import pandas as pd
import mysql.connector


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


def get_cell(row: pd.Series, aliases: List[str]) -> Optional[str]:
    normalized = {normalize_header(str(col)): col for col in row.index}
    for alias in aliases:
        key = normalize_header(alias)
        col = normalized.get(key)
        if col is not None:
            return str_or_none(row.get(col))
    return None


def normalize_question_text(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("’", "'").replace("`", "'")
    return s


def build_sheet(path: str) -> pd.DataFrame:
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


def detect_cols(cur, db_name: str) -> Dict[str, str]:
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

    mapping = {
        "referentialId": first_existing(["referentialId", "referential_id"]),
        "code": first_existing(["code"]),
        "processId": first_existing(["processId", "process_id"]),
        "article": first_existing(["article"]),
        "questionText": first_existing(["questionText", "question_text"]),
        "risk": first_existing(["risk"]),
        "risks": first_existing(["risks"]),
        "expectedEvidence": first_existing(["expectedEvidence", "expected_evidence"]),
    }

    if not mapping["referentialId"]:
        raise SystemExit("Missing referentialId column in questions table.")
    if not (mapping["risk"] or mapping["risks"] or mapping["expectedEvidence"]):
        raise SystemExit("No patchable columns found (risk/risks/expectedEvidence).")

    return {k: v for k, v in mapping.items() if v}


def json_dump_or_none(risk: Optional[str]) -> Optional[str]:
    if not risk:
        return None
    import json
    return json.dumps([risk], ensure_ascii=False)


def connect_with_retry(db_config: Dict[str, Any], retries: int = 6) -> mysql.connector.MySQLConnection:
    """
    Railway proxy often requires SSL. We emulate mysql2 { ssl: { rejectUnauthorized:false } }.

    mysql-connector-python SSL knobs:
      - ssl_disabled: False to allow SSL
      - ssl_verify_cert/identity: False to mimic rejectUnauthorized:false
    """
    # Start with SSL enabled + no verification (like rejectUnauthorized:false)
    base_cfg = dict(db_config)
    base_cfg.update(
        {
            "connection_timeout": 15,
            "use_pure": True,
            "ssl_disabled": False,
            "ssl_verify_cert": False,
            "ssl_verify_identity": False,
        }
    )

    last_err: Exception | None = None
    for i in range(1, retries + 1):
        try:
            conn = mysql.connector.connect(**base_cfg)
            # ping to validate handshake
            conn.ping(reconnect=False, attempts=1, delay=0)
            return conn
        except Exception as e:
            last_err = e
            wait = 2 * i
            print(f"[DB] connect attempt {i}/{retries} failed: {type(e).__name__}: {e}")
            print(f"[DB] retrying in {wait}s ...")
            time.sleep(wait)

    raise SystemExit(f"DB connection failed after {retries} attempts: {last_err}")


def main() -> None:
    excel_path = getenv_str("EXCEL_PATH", "")
    referential_id = getenv_int("DEFAULT_REFERENTIAL_ID", 2)
    dry_run = getenv_str("DRY_RUN", "0") == "1"

    if not excel_path:
        raise SystemExit("EXCEL_PATH is required")
    if referential_id not in (2, 3):
        raise SystemExit("DEFAULT_REFERENTIAL_ID must be 2 or 3")

    db_config = {
        "host": getenv_str("DB_HOST", "127.0.0.1"),
        "port": getenv_int("DB_PORT", 3306),
        "user": getenv_str("DB_USER", "root"),
        "password": getenv_str("DB_PASSWORD", ""),
        "database": getenv_str("DB_NAME", "railway"),
    }

    print("=== ISO PATCH RISKS V2 START ===")
    print(f"Excel: {excel_path}")
    print(f"ReferentialId: {referential_id}")
    print(f"Dry-run: {dry_run}")
    print(f"DB: {db_config['host']}:{db_config['port']} / {db_config['database']} (user={db_config['user']})")

    sheet = build_sheet(excel_path)

    conn = connect_with_retry(db_config)
    cur = conn.cursor(dictionary=True)

    q_cols = detect_cols(cur, db_config["database"])
    process_map = load_process_map(cur)

    set_parts = []
    if q_cols.get("risk"):
        set_parts.append(f"`{q_cols['risk']}` = %s")
    if q_cols.get("risks"):
        set_parts.append(f"`{q_cols['risks']}` = %s")
    if q_cols.get("expectedEvidence"):
        set_parts.append(f"`{q_cols['expectedEvidence']}` = %s")

    update_by_code_sql = None
    if q_cols.get("code"):
        update_by_code_sql = f"""
          UPDATE questions
          SET {", ".join(set_parts)}
          WHERE `{q_cols['referentialId']}` = %s AND `{q_cols['code']}` = %s
        """

    select_fallback_sql = None
    update_by_id_sql = None
    if q_cols.get("processId") and q_cols.get("article") and q_cols.get("questionText"):
        select_fallback_sql = f"""
          SELECT id
          FROM questions
          WHERE `{q_cols['referentialId']}` = %s
            AND `{q_cols['processId']}` = %s
            AND `{q_cols['article']}` = %s
            AND `{q_cols['questionText']}` = %s
          LIMIT 1
        """
        update_by_id_sql = f"""
          UPDATE questions
          SET {", ".join(set_parts)}
          WHERE id = %s
        """

    updated = 0
    updated_by_code = 0
    updated_by_fallback = 0
    skipped = 0
    missing_process = 0
    not_found = 0

    for _, row in sheet.iterrows():
        process_name = get_cell(row, ["Processus concerné", "Processus concerne"])
        article = get_cell(row, ["Clause"]) or "N/A"
        question_text = get_cell(row, ["Question d’audit détaillée", "Question d'audit détaillée"])
        code = get_cell(row, ["code", "Code", "CODE"])

        if not process_name or not question_text:
            skipped += 1
            continue

        pid = process_map.get(process_name.strip().lower())
        if not pid:
            missing_process += 1
            continue

        # ✅ accept both headers
        risk = get_cell(row, ["Risque", "Risques"])
        expected = get_cell(row, ["Preuves attendues"])

        params_set: List[Any] = []
        if q_cols.get("risk"):
            params_set.append(risk)
        if q_cols.get("risks"):
            params_set.append(json_dump_or_none(risk))
        if q_cols.get("expectedEvidence"):
            params_set.append(expected)

        if dry_run:
            updated += 1
            continue

        did_update = False
        if update_by_code_sql and code:
            cur.execute(update_by_code_sql, tuple(params_set + [referential_id, code]))
            if cur.rowcount > 0:
                updated += 1
                updated_by_code += 1
                did_update = True

        if did_update:
            continue

        if select_fallback_sql and update_by_id_sql:
            qt = normalize_question_text(question_text)
            cur.execute(select_fallback_sql, (referential_id, pid, article, qt))
            r = cur.fetchone()
            if r and r.get("id"):
                cur.execute(update_by_id_sql, tuple(params_set + [int(r["id"])]))
                if cur.rowcount > 0:
                    updated += 1
                    updated_by_fallback += 1
                    continue

        not_found += 1

    conn.commit()

    print("=== ISO PATCH RISKS V2 RESULT ===")
    print(f"Rows in Excel: {len(sheet)}")
    print(f"Updated total: {updated}")
    print(f"Updated by code: {updated_by_code}")
    print(f"Updated by fallback: {updated_by_fallback}")
    print(f"Skipped: {skipped}")
    print(f"Missing process mapping: {missing_process}")
    print(f"Not found in DB: {not_found}")
    print("=== ISO PATCH RISKS V2 END ===")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
