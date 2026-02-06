
import pandas as pd
import json
import uuid

def excel_to_json(excel_file_path, json_output_path):
    df = pd.read_excel(excel_file_path)

    questions = []
    for index, row in df.iterrows():
        # Extracting data from Excel columns
        processus_concerne = row['Processus concerné'] if pd.notna(row['Processus concerné']) else ''
        objectif_processus = row['Objectif du processus'] if pd.notna(row['Objectif du processus']) else ''
        clause_iso = row['Clause ISO 9001'] if pd.notna(row['Clause ISO 9001']) else ''
        intitule = row['Intitulé'] if pd.notna(row['Intitulé']) else ''
        question_audit = row['Question d’audit détaillée'] if pd.notna(row['Question d’audit détaillée']) else ''
        type_question = row['Type'] if pd.notna(row['Type']) else None
        risque_nc = row['Risque en cas de NC'] if pd.notna(row['Risque en cas de NC']) else None
        preuves_attendues = row['Preuves attendues'] if pd.notna(row['Preuves attendues']) else None
        fonctions_interrogees = row['Fonctions interrogées'] if pd.notna(row['Fonctions interrogées']) else None
        criticite = row['Criticité'] if pd.notna(row['Criticité']) else None

        # Handle multiple processes (if any, separated by '/')
        processes = [p.strip() for p in processus_concerne.split('/') if p.strip()]
        if not processes:
            processes = [''] # Ensure at least one empty process if none found

        # Handle multiple interview functions (if any, separated by ',')
        interview_functions = [f.strip() for f in str(fonctions_interrogees).split(',') if f.strip()]

        # Create a question entry for each process
        for proc in processes:
            question_entry = {
                'id': str(uuid.uuid4()),
                'reference': clause_iso,
                'process': proc,
                'roles': [], # Roles are not explicitly in Excel, keeping as empty list
                'title': intitule,
                'question': question_audit,
                'type': type_question,
                'risk_if_nc': risque_nc,
                'expected_evidence': preuves_attendues,
                'interview_functions': interview_functions,
                'criticality': criticite
            }
            questions.append(question_entry)

    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"Successfully extracted {len(questions)} questions and saved to {json_output_path}")

# Define file paths
excel_input_path = "/home/ubuntu/upload/MDR_questionnaire_V4_intelligente.xlsx"
json_output_path = "/home/ubuntu/backend-new/server/final_questions.json"

# Run the extraction process
excel_to_json(excel_input_path, json_output_path)
