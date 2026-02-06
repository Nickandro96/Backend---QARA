
import json
import uuid
import re
import os
import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "audit_user"),
        password=os.getenv("DB_PASSWORD", "audit_password"),
        database=os.getenv("DB_NAME", "audit_db")
    )

def fetch_referential_and_process_ids():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id, name FROM referentials")
        referentials = cursor.fetchall()
        referential_map = {r["name"].lower(): r["id"] for r in referentials}

        cursor.execute("SELECT id, name FROM processes")
        processes = cursor.fetchall()
        process_map = {p["name"].lower(): p["id"] for p in processes}

        return referential_map, process_map

    except mysql.connector.Error as err:
        print(f"Error fetching referential and process IDs: {err}")
        return {}, {}
    finally:
        if conn:
            conn.close()

def generate_sql_inserts(json_file_path, sql_output_path):
    with open(json_file_path, 'r', encoding='utf-8') as f:
        questions_data = json.load(f)

    referential_id_map, process_id_map = fetch_referential_and_process_ids()

    sql_statements = []

    # Function to get ID from map, or return None if not found
    def get_id_from_map(name, id_map):
        return id_map.get(name.lower().strip())

    for q in questions_data:
        # Extract base referential name and article/annexe
        full_reference = q.get('reference', '')
        base_referential_name = ''
        article = ''
        annexe = ''

        mdr_match = re.match(r'(MDR 2017/745) – (Article|Annexe) (.*)', full_reference, re.IGNORECASE)
        iso_match = re.match(r'(ISO 13485:2016) – (Clause) (.*)', full_reference, re.IGNORECASE)

        if mdr_match:
            base_referential_name = mdr_match.group(1)
            if mdr_match.group(2).lower() == 'article':
                article = f"Art. {mdr_match.group(3)}"
            elif mdr_match.group(2).lower() == 'annexe':
                annexe = f"Annexe {mdr_match.group(3)}"
        elif iso_match:
            base_referential_name = iso_match.group(1)
            if iso_match.group(2).lower() == 'clause':
                article = f"Clause {iso_match.group(3)}"
        else:
            # Fallback for other referential formats or if no specific article/annexe
            base_referential_name = full_reference.split(' – ')[0] if ' – ' in full_reference else full_reference

        referential_id = get_id_from_map(base_referential_name, referential_id_map)
        process_id = get_id_from_map(q.get('process', ''), process_id_map)

        if referential_id is None:
            print(f"[WARNING] Referential ID not found for base referential: {base_referential_name} (from '{full_reference}'). Skipping question.")
            continue
        if process_id is None:
            print(f"[WARNING] Process ID not found for: {q.get('process', '')}. Skipping question.")
            continue

        # Handle economicRole
        economic_role = "tous" # Default value
        if q.get("economic_role"):
            economic_role = q["economic_role"].lower()
        if q.get('roles') and isinstance(q['roles'], list):
            roles_from_json = [r.lower() for r in q['roles'] if r.strip()]
            if 'fabricant' in roles_from_json: economic_role = 'fabricant'
            elif 'importateur' in roles_from_json: economic_role = 'importateur'
            elif 'distributeur' in roles_from_json: economic_role = 'distributeur'
        elif q.get('title'):
            title_lower = q['title'].lower()
            if '[fabricant]' in title_lower: economic_role = 'fabricant'
            elif '[importateur]' in title_lower: economic_role = 'importateur'
            elif '[distributeur]' in title_lower: economic_role = 'distributeur'

        # Map criticality
        criticality_map = {
            "élevé": "high",
            "moyen": "medium",
            "faible": "low",
            "ultra-critique": "high"
        }
        criticality = criticality_map.get(q.get('criticality', 'medium').lower(), 'medium')

        # Prepare values for SQL insertion
        title = q.get('title', '').replace("'", "''")
        question_text = q.get('question', '').replace("'", "''")
        question_type = q.get('type', '')
        expected_evidence = json.dumps([e.strip() for e in q.get('expected_evidence', '').split(',') if e.strip()]) if q.get('expected_evidence') else "[]"
        risks = q.get('risk_if_nc', '').replace("'", "''")
        interview_functions = json.dumps([f.strip() for f in q.get('interview_functions', []) if f.strip()]) if q.get('interview_functions') else "[]"
        
        applicable_processes = json.dumps([p.strip() for p in q.get("process", "").split(",") if p.strip()]) if q.get("process") else "[]"

        sql = f"INSERT INTO questions (referentialId, processId, article, annexe, title, economicRole, applicableProcesses, questionType, questionText, expectedEvidence, criticality, risks, interviewFunctions, displayOrder, createdAt) VALUES (\n    {referential_id}, \n    {process_id}, \n    '{article}', \n    '{annexe}', \n    '{title}', \n    '{economic_role}', \n    '{applicable_processes}', \n    '{question_type}', \n    '{question_text}', \n    '{expected_evidence}', \n    '{criticality}', \n    '{risks}', \n    '{interview_functions}', \n    0, \n    NOW()\n);"
        sql_statements.append(sql)

    with open(sql_output_path, 'w', encoding='utf-8') as f:
        for statement in sql_statements:
            f.write(statement + '\n\n')

    print(f"Generated {len(sql_statements)} SQL INSERT statements to {sql_output_path}")

# Define file paths
json_input_path = "/home/ubuntu/backend-new/server/all-questions-data.json"
sql_output_path = "/home/ubuntu/backend-new/server/insert_questions.sql"

# Run the SQL generation process
generate_sql_inserts(json_input_path, sql_output_path)
