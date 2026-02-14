import os
import json
import pandas as pd
import mysql.connector

EXCEL_PATH = os.getenv("EXCEL_PATH", "data/MDR_questionnaire_V7_CORRIGE.xlsx")
SHEET_NAME = os.getenv("SHEET_NAME", None)  # None = first sheet
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DB_PORT = int(os.getenv("DB_PORT", "3306"))

# If you use DATABASE_URL instead of split vars, you can parse it here if needed.
DATABASE_URL = os.getenv("DATABASE_URL")


def die(msg: str):
    raise SystemExit(f"[IMPORT] {msg}")


def norm_str(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s != "" and s.lower() != "nan" else None


def norm_int(v):
    if v is None:
        return None
    try:
        if str(v).strip() == "" or str(v).lower() == "nan":
            return None
        return int(float(v))
    except Exception:
        return None


def norm_json_array(v):
    # accepts: list, "a,b,c", '["a","b"]', empty
    if v is None:
        return json.dumps([])
    if isinstance(v, list):
        return json.dumps([str(x).strip() for x in v if str(x).strip()])
    s = str(v).strip()
    if s == "" or s.lower() == "nan":
        return json.dumps([])
    # try JSON first
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("{") and s.endswith("}")):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return json.dumps(parsed)
        except Exception:
            pass
    # fallback CSV
    items = [x.strip() for x in s.replace(";", ",").split(",") if x.strip()]
    return json.dumps(items)


def read_excel():
    if not os.path.exists(EXCEL_PATH):
        die(f"Excel file not found: {EXCEL_PATH}")

    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, engine="openpyxl")
    df = df.fillna("")
    return df


def connect_mysql():
    if DATABASE_URL and (not DB_HOST):
        # optional: implement parsing DATABASE_URL if your workflow uses only DATABASE_URL
        die("DATABASE_URL provided but DB_HOST/DB_USER/DB_PASSWORD/DB_NAME not set. Either set split vars or add URL parsing.")

    if not (DB_HOST and DB_USER and DB_PASSWORD and DB_NAME):
        die("Missing MySQL env vars. Need DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and optional DB_PORT).")

    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=False,
    )


def main():
    print(f"[IMPORT] Loading Excel: {EXCEL_PATH}")
    df = read_excel()
    print(f"[IMPORT] Rows in Excel: {len(df)}")

    cnx = connect_mysql()
    cur = cnx.cursor()

    # ✅ Safety: keep schema, but replace all content
    print("[IMPORT] Truncating questions table...")
    cur.execute("DELETE FROM questions;")

    # Map columns based on your DB schema
    # You MUST ensure your Excel columns match these names OR adjust mapping below.
    # Expected columns in Excel (recommended):
    # referentialId, processId, questionKey, article, annexe, title, economicRole,
    # applicableProcesses, questionType, questionText, expectedEvidence, criticality,
    # risk, risks, interviewFunctions, actionPlan, aiPrompt, displayOrder
    insert_sql = """
        INSERT INTO questions
        (referentialId, processId, questionKey, article, annexe, title, economicRole,
         applicableProcesses, questionType, questionText, expectedEvidence, criticality,
         risk, risks, interviewFunctions, actionPlan, aiPrompt, displayOrder)
        VALUES (%s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s)
    """

    count = 0
    for _, row in df.iterrows():
        vals = (
            norm_int(row.get("referentialId")),
            norm_int(row.get("processId")),
            norm_str(row.get("questionKey")),
            norm_str(row.get("article")),
            norm_str(row.get("annexe")),
            norm_str(row.get("title")),
            norm_str(row.get("economicRole")),
            norm_json_array(row.get("applicableProcesses")),
            norm_str(row.get("questionType")),
            norm_str(row.get("questionText")),
            norm_str(row.get("expectedEvidence")),
            norm_str(row.get("criticality")),
            norm_str(row.get("risk")),
            norm_str(row.get("risks")),
            norm_json_array(row.get("interviewFunctions")),
            norm_str(row.get("actionPlan")),
            norm_str(row.get("aiPrompt")),
            norm_int(row.get("displayOrder")),
        )

        # If questionText is empty, skip (protect DB)
        if not vals[9]:
            continue

        cur.execute(insert_sql, vals)
        count += 1

        if count % 500 == 0:
            print(f"[IMPORT] Inserted {count}...")

    cnx.commit()
    cur.close()
    cnx.close()

    print(f"[IMPORT] DONE. Inserted rows: {count}")


if __name__ == "__main__":
    main()
