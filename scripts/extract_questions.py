
import re
import json
import uuid
from docx import Document

def extract_questions_from_text(text, debug_file):
    questions = []
    current_article_clause = None
    current_referential = None
    current_processes = []
    current_actors = []
    current_criticality = None
    current_title = None
    current_type = None
    current_risk_if_nc = None
    current_expected_evidence = None
    current_interview_functions = None
    in_question_section = False

    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].replace("\xa0", " ").strip()
        debug_file.write(f"[DEBUG] Processing line {i}: {line}\n")
        debug_file.write(f"  [DEBUG] State: in_q_section={in_question_section}, ref={current_referential}, art={current_article_clause}, proc={current_processes}, act={current_actors}, crit={current_criticality}, type={current_type}, risk={current_risk_if_nc}, evidence={current_expected_evidence}, functions={current_interview_functions}\n")

        if not line:
            i += 1
            continue

        # Reset major context variables when a new top-level section starts
        if line.startswith(("📘", "📗", "🧱")):
            current_article_clause = None
            current_processes = []
            current_actors = []
            current_criticality = None
            current_title = None
            in_question_section = False
            # Do NOT reset current_type, current_risk_if_nc, etc. here, as they might apply across sub-sections

        if "📘 Règlement (UE) 2017/745 (MDR)" in line:
            current_referential = "MDR 2017/745"
            debug_file.write(f"[DEBUG] Set current_referential: {current_referential}\n")
        elif "📗 ISO 13485:2016" in line:
            current_referential = "ISO 13485"
            debug_file.write(f"[DEBUG] Set current_referential: {current_referential}\n")
        elif line.startswith("🧱 MDR – ARTICLES"):
            match = re.match(r"🧱 MDR – ARTICLES?\s*(.*)", line)
            if match:
                current_article_clause = f"Articles {match.group(1).strip()}"
                current_referential = current_referential or "MDR 2017/745"
        elif line.startswith("🧱 ISO 13485 – CLAUSES"):
            match = re.match(r"🧱 ISO 13485 – CLAUSES?\s*(.*)", line)
            if match:
                current_article_clause = f"Clauses {match.group(1).strip()}"
                current_referential = current_referential or "ISO 13485"
        elif line.startswith("🔹"):
            match = re.match(r"🔹\s*(MDR|ISO\s*13485)?\s*–\s*(Article|Clause)\s*(.*)", line, re.IGNORECASE)
            if match:
                ref_part = match.group(1)
                article_clause_full_text = match.group(3).strip()
                if ref_part:
                    current_referential = ref_part.upper().replace("ISO ", "ISO ")
                current_article_clause = f"{match.group(2).capitalize()} {article_clause_full_text}"
            # Reset specific metadata fields and in_question_section when a new Article/Clause starts
            current_type = None
            current_risk_if_nc = None
            current_expected_evidence = None
            current_interview_functions = None
            in_question_section = False 
        elif line.startswith("🔴 ANNEXE"):
            current_article_clause = line.split("–", 1)[1].strip()
            current_referential = current_referential or "MDR 2017/745"
            # Reset specific metadata fields and in_question_section when a new Annex starts
            current_type = None
            current_risk_if_nc = None
            current_expected_evidence = None
            current_interview_functions = None
            in_question_section = False 
        elif line.startswith("Processus"):
            current_processes = []
            if ":" in line:
                cleaned_line = line.split(":", 1)[1].replace("✅", "").replace("⚠️", "").strip()
                current_processes.extend([p.strip() for p in cleaned_line.split("/") if p.strip() and not "Acteur" in p])
            j = i + 1
            while j < len(lines) and lines[j].strip() and not lines[j].strip().startswith(("Acteurs", "Questions audit", "Exigence synthétisée", "🧱", "🔹", "🔴", "Type:", "Si non conforme:", "Preuves attendues:", "Fonctions à interviewer:")):
                cleaned_process = lines[j].strip().replace("✅", "").replace("⚠️", "").strip()
                current_processes.extend([p.strip() for p in cleaned_process.split("/") if p.strip() and not "Acteur" in p])
                j += 1
            i = j - 1
        elif line.startswith("Acteurs"):
            current_actors = []
            if ":" in line:
                cleaned_line = line.split(":", 1)[1].replace("concernés", "").replace("✅", "").replace("⚠️", "").strip()
                current_actors.extend([a.strip() for a in cleaned_line.split("/") if a.strip()])
            j = i + 1
            while j < len(lines) and lines[j].strip() and not lines[j].strip().startswith(("Processus", "Questions audit", "Exigence synthétisée", "🧱", "🔹", "🔴", "Type:", "Si non conforme:", "Preuves attendues:", "Fonctions à interviewer:")):
                cleaned_actor = lines[j].strip().replace("concernés", "").replace("✅", "").replace("⚠️", "").strip()
                if cleaned_actor:
                    current_actors.extend([a.strip() for a in cleaned_actor.split("/") if a.strip()])
                j += 1
            i = j - 1
        elif re.match(r"^\[.*\]\s*.*", line):
            current_title = line.strip()
        elif line.startswith("Type:"):
            current_type = line.split(":", 1)[1].strip()
        elif line.startswith("Si non conforme:"):
            current_risk_if_nc = line.split(":", 1)[1].strip()
        elif line.startswith("Preuves attendues:"):
            current_expected_evidence = line.split(":", 1)[1].strip()
        elif line.startswith("Fonctions à interviewer:"):
            current_interview_functions = line.split(":", 1)[1].strip()
        elif re.match(r"Questions audit ultra-précises", line):
            current_criticality = "Ultra-critique"
            in_question_section = True
            debug_file.write(f"[DEBUG] Entered question section: {current_criticality}\n")
        elif re.match(r"Questions audit critiques", line):
            current_criticality = "Critique"
            in_question_section = True
            debug_file.write(f"[DEBUG] Entered question section: {current_criticality}\n")
        elif re.match(r"Questions audit majeures", line):
            current_criticality = "Majeure"
            in_question_section = True
            debug_file.write(f"[DEBUG] Entered question section: {current_criticality}\n")
        elif re.match(r"Questions audit", line):
            current_criticality = "Moyenne"
            in_question_section = True
            debug_file.write(f"[DEBUG] Entered question section: {current_criticality}\n")
        
        # If we are in a question section and have context, extract the question
        elif in_question_section and current_article_clause and current_referential and not line.startswith("➡️") and line.strip():
            question_text = line.strip()
            if question_text and not question_text.startswith("Processus") and not question_text.startswith("Acteurs"):
                generated_title = current_title if current_title else current_article_clause
                if current_actors:
                    actors_str = ' + '.join(sorted(list(set(current_actors))))
                    generated_title = f"[{actors_str}] {generated_title}"

                if not current_processes:
                    questions.append({
                        "id": str(uuid.uuid4()),
                        "reference": f"{current_referential} – {current_article_clause}",
                        "process": "Non spécifié",
                        "roles": sorted(list(set(current_actors))),
                        "title": generated_title,
                        "question": question_text,
                        "type": current_type,
                        "risk_if_nc": current_risk_if_nc,
                        "expected_evidence": current_expected_evidence,
                        "interview_functions": current_interview_functions,
                        "criticality": current_criticality or "Faible"
                    })
                else:
                    for process in sorted(list(set(current_processes))):
                        questions.append({
                            "id": str(uuid.uuid4()),
                            "reference": f"{current_referential} – {current_article_clause}",
                            "process": process,
                            "roles": sorted(list(set(current_actors))),
                            "title": generated_title,
                            "question": question_text,
                            "type": current_type,
                            "risk_if_nc": current_risk_if_nc,
                            "expected_evidence": current_expected_evidence,
                            "interview_functions": current_interview_functions,
                            "criticality": current_criticality or "Faible"
                        })
        i += 1
    
    return questions

def read_docx(file_path, debug_file):
    try:
        document = Document(file_path)
        full_text = [para.text for para in document.paragraphs]
        return "\n".join(full_text)
    except Exception as e:
        return f"Error reading DOCX file: {e}"

docx_file_path = "/home/ubuntu/upload/questionsexigencesMDR.docx"
debug_output_path = "/home/ubuntu/backend-new/server/debug_extraction.txt"

with open(debug_output_path, "w", encoding="utf-8") as debug_file:
    full_document_content = read_docx(docx_file_path, debug_file)
    if "Error" not in full_document_content:
        questions_data = extract_questions_from_text(full_document_content, debug_file)
        with open("/home/ubuntu/backend-new/server/all-questions-data.json", "w", encoding="utf-8") as f:
            json.dump(questions_data, f, ensure_ascii=False, indent=2)
        debug_file.write(f"Successfully extracted {len(questions_data)} questions.\n")
        print(f"Successfully extracted {len(questions_data)} questions.")
    else:
        debug_file.write(full_document_content + "\n")
        print(full_document_content)
