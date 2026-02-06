
import json
import pandas as pd
import re

def normalize_text(text):
    if pd.isna(text):
        return ''
    return text.replace('’', '’').replace('\xa0', ' ').strip().lower()

def enrich_questions_from_excel(json_file_path, excel_file_path, output_json_file_path):
    # Load existing questions from JSON
    with open(json_file_path, 'r', encoding='utf-8') as f:
        questions_data = json.load(f)

    # Load data from Excel
    excel_df = pd.read_excel(excel_file_path)

    # Create a dictionary for faster lookup from Excel data
    excel_lookup = {}
    for index, row in excel_df.iterrows():
        excel_reference = normalize_text(row['Clause ISO 9001'])
        excel_process_raw = normalize_text(row['Processus concerné'])
        excel_title = normalize_text(row['Intitulé'])
        excel_question = normalize_text(row['Question d’audit détaillée'])
        
        processes_in_excel = [p.strip() for p in excel_process_raw.split('/') if p.strip()]
        if not processes_in_excel:
            processes_in_excel = [excel_process_raw] # Use original if no '/' found or empty

        for proc in processes_in_excel:
            key = (excel_reference, normalize_text(proc), excel_title, excel_question)
            excel_lookup[key] = {
                'type': row['Type'] if pd.notna(row['Type']) else None,
                'risk_if_nc': row['Risque en cas de NC'] if pd.notna(row['Risque en cas de NC']) else None,
                'expected_evidence': row['Preuves attendues'] if pd.notna(row['Preuves attendues']) else None,
                'interview_functions': row['Fonctions interrogées'] if pd.notna(row['Fonctions interrogées']) else None
            }

    # Enrich questions_data
    enriched_questions = []
    for q in questions_data:
        q_reference = normalize_text(q['reference'])
        q_process = normalize_text(q['process'])
        q_title = normalize_text(q['title'])
        q_question = normalize_text(q['question'])

        # Adjust reference format to match Excel
        q_reference_excel_format = q_reference
        if 'mdr – article' in q_reference:
            # Example: 'mdr – article 10 – obligations du fabricant' -> 'mdr 2017/745 – article 10'
            match = re.search(r'mdr – article (\d+)', q_reference)
            if match:
                article_num = match.group(1)
                q_reference_excel_format = f'mdr 2017/745 – article {article_num}'
        elif 'iso 13485 – clause' in q_reference:
            # Example: 'iso 13485 – clause 7.4 (achats)' -> 'iso 13485:2016 – clause 7.4'
            match = re.search(r'iso 13485 – clause ([\d\.]+)', q_reference)
            if match:
                clause_num = match.group(1)
                q_reference_excel_format = f'iso 13485:2016 – clause {clause_num}'

        # Try to find a match in the Excel lookup
        match_key = (q_reference_excel_format, q_process, q_title, q_question)
        
        if match_key in excel_lookup:
            matched_data = excel_lookup[match_key]
            q['type'] = matched_data['type']
            q['risk_if_nc'] = matched_data['risk_if_nc']
            q['expected_evidence'] = matched_data['expected_evidence']
            q['interview_functions'] = matched_data['interview_functions']
        else:
            # If no direct match, try with a more flexible approach for process
            # For questions with multiple processes in JSON, try matching each process
            processes_in_json = [p.strip() for p in q['process'].split('/') if p.strip()]
            found_match = False
            for proc_json in processes_in_json:
                flexible_match_key = (q_reference_excel_format, normalize_text(proc_json), q_title, q_question)
                if flexible_match_key in excel_lookup:
                    matched_data = excel_lookup[flexible_match_key]
                    q['type'] = matched_data['type']
                    q['risk_if_nc'] = matched_data['risk_if_nc']
                    q['expected_evidence'] = matched_data['expected_evidence']
                    q['interview_functions'] = matched_data['interview_functions']
                    found_match = True
                    break
            if not found_match:
                print(f"No exact match found for question: {q['question']} (Ref: {q['reference']}, Proc: {q['process']}, Title: {q['title']})")

        enriched_questions.append(q)

    # Save enriched questions to a new JSON file
    with open(output_json_file_path, 'w', encoding='utf-8') as f:
        json.dump(enriched_questions, f, ensure_ascii=False, indent=2)

    print(f"Successfully enriched {len(enriched_questions)} questions and saved to {output_json_file_path}")

# Define file paths
json_input_path = "/home/ubuntu/backend-new/server/all-questions-data.json"
excel_input_path = "/home/ubuntu/upload/MDR_questionnaire_V4_intelligente.xlsx"
json_output_path = "/home/ubuntu/backend-new/server/enriched-questions-data.json"

# Run the enrichment process
enrich_questions_from_excel(json_input_path, excel_input_path, json_output_path)
