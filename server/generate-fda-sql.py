#!/usr/bin/env python3.11
"""
FDA Questions SQL Generator
Generates SQL INSERT statements from 8 Excel files
Output: fda-questions-insert.sql (ready to execute via webdev_execute_sql)
"""

import os
import glob
import hashlib
import json
from datetime import datetime
import openpyxl

# Framework mapping
FRAMEWORK_MAPPING = {
    'QuestionnairesauditsFDA-21CFRPart820.xlsx': 'FDA_820',
    'QuestionnairesauditsFDA-21CFRPart807.xlsx': 'FDA_807',
    'QuestionnairesauditsFDA-510(K).xlsx': 'FDA_510K',
    'QuestionnairesauditsFDA-DeNovo.xlsx': 'FDA_DENOVO',
    'QuestionnairesauditsFDA-PMA.xlsx': 'FDA_PMA',
    'QuestionnairesauditsFDA-PostMarket.xlsx': 'FDA_POSTMARKET',
    'QuestionnairesauditsFDA-Labeling.xlsx': 'FDA_LABELING',
    'QuestionnairesauditsFDA-UDI.xlsx': 'FDA_UDI',
}

# Framework applicability
FRAMEWORK_APPLICABILITY = {
    'FDA_820': ['FDA_LM', 'FDA_CMO'],
    'FDA_807': ['FDA_LM', 'FDA_CMO', 'FDA_IMP'],
    'FDA_510K': ['FDA_LM'],
    'FDA_DENOVO': ['FDA_LM'],
    'FDA_PMA': ['FDA_LM'],
    'FDA_POSTMARKET': ['FDA_LM', 'FDA_IMP', 'FDA_DIST'],
    'FDA_LABELING': ['FDA_LM', 'FDA_CMO'],
    'FDA_UDI': ['FDA_LM', 'FDA_CMO'],
}

# FDA Roles
FDA_ROLES = [
    ('FDA_LM', 'Legal Manufacturer / Specification Developer', 'Entity whose name appears on the device label'),
    ('FDA_CMO', 'Contract Manufacturer', 'Entity that manufactures for another company'),
    ('FDA_IMP', 'Initial Importer', 'Entity that imports devices into the US'),
    ('FDA_DIST', 'Distributor', 'Entity that distributes without modifying'),
    ('FDA_CONSULTANT', 'Consultant / Auditor', 'External consultant with extended access'),
]

def escape_sql(value):
    """Escape string for SQL"""
    if value is None:
        return 'NULL'
    value = str(value).replace("'", "''").replace('\\', '\\\\')
    return f"'{value}'"

def generate_external_id(framework_code, process, subprocess, reference_exact, question_short):
    """Generate stable external_id"""
    components = [
        str(framework_code or ''),
        str(process or ''),
        str(subprocess or ''),
        str(reference_exact or ''),
        str(question_short or '')[:100],
    ]
    combined = '|'.join(components)
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()[:64]

def process_excel_file(file_path, framework_code):
    """Process one Excel file and return SQL statements"""
    print(f"📄 Processing: {os.path.basename(file_path)} → {framework_code}")
    
    wb = openpyxl.load_workbook(file_path)
    ws = wb.active
    
    questions_sql = []
    applicability_sql = []
    row_count = 0
    
    # Skip header row
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not any(row):
            continue
        
        # Map columns
        process = row[0]
        subprocess = row[1]
        reference_standard = row[2]
        reference_exact = row[3]
        question_short = row[4]
        question_detailed = row[5]
        expected_evidence = row[6]
        interviews = row[7]
        field_test = row[8]
        risk_if_nc = row[9]
        criticality = row[10]
        
        # Generate external_id
        external_id = generate_external_id(framework_code, process, subprocess, reference_exact, question_short)
        
        # Generate INSERT statement
        sql = f"""INSERT INTO fda_questions (
  externalId, frameworkCode, process, subprocess, referenceStandard,
  referenceExact, questionShort, questionDetailed, expectedEvidence,
  interviews, fieldTest, riskIfNc, criticality, applicabilityType,
  sourceFile, sourceRow
) VALUES (
  {escape_sql(external_id)}, {escape_sql(framework_code)}, {escape_sql(process)}, 
  {escape_sql(subprocess)}, {escape_sql(reference_standard)}, {escape_sql(reference_exact)},
  {escape_sql(question_short)}, {escape_sql(question_detailed)}, {escape_sql(expected_evidence)},
  {escape_sql(interviews)}, {escape_sql(field_test)}, {escape_sql(risk_if_nc)},
  {escape_sql(criticality)}, 'ROLE_BASED', {escape_sql(os.path.basename(file_path))}, {row_idx}
) ON DUPLICATE KEY UPDATE
  process = VALUES(process),
  subprocess = VALUES(subprocess),
  updatedAt = CURRENT_TIMESTAMP;"""
        
        questions_sql.append(sql)
        
        # Generate applicability mappings (will be added after questions are inserted)
        applicable_roles = FRAMEWORK_APPLICABILITY.get(framework_code, [])
        for role_code in applicable_roles:
            app_sql = f"""INSERT IGNORE INTO fda_question_applicability (questionId, roleCode)
SELECT id, {escape_sql(role_code)} FROM fda_questions WHERE externalId = {escape_sql(external_id)};"""
            applicability_sql.append(app_sql)
        
        row_count += 1
    
    print(f"✅ Generated SQL for {row_count} questions from {framework_code}")
    return questions_sql, applicability_sql, row_count

def main():
    print("🚀 FDA Questions SQL Generator")
    print("="*60)
    
    # Find Excel files
    excel_dir = '/home/ubuntu/upload'
    excel_files = glob.glob(os.path.join(excel_dir, 'QuestionnairesauditsFDA-*.xlsx'))
    
    if not excel_files:
        print(f"❌ No Excel files found in {excel_dir}")
        return
    
    print(f"📁 Found {len(excel_files)} Excel files\n")
    
    # Generate SQL for FDA roles
    roles_sql = []
    for role_code, role_name, description in FDA_ROLES:
        sql = f"""INSERT INTO fda_roles (roleCode, roleName, description)
VALUES ({escape_sql(role_code)}, {escape_sql(role_name)}, {escape_sql(description)})
ON DUPLICATE KEY UPDATE roleName = VALUES(roleName), description = VALUES(description);"""
        roles_sql.append(sql)
    
    # Process all Excel files
    all_questions_sql = []
    all_applicability_sql = []
    stats = {}
    
    for file_path in sorted(excel_files):
        filename = os.path.basename(file_path)
        framework_code = FRAMEWORK_MAPPING.get(filename)
        
        if not framework_code:
            print(f"⚠️  Skipping unknown file: {filename}")
            continue
        
        questions_sql, applicability_sql, count = process_excel_file(file_path, framework_code)
        all_questions_sql.extend(questions_sql)
        all_applicability_sql.extend(applicability_sql)
        stats[framework_code] = count
    
    # Write SQL file
    output_file = '/home/ubuntu/mdr-compliance-platform/fda-questions-insert.sql'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- FDA Questions Import SQL\n")
        f.write(f"-- Generated: {datetime.now().isoformat()}\n")
        f.write(f"-- Total questions: {sum(stats.values())}\n\n")
        
        f.write("-- Insert FDA Roles\n")
        for sql in roles_sql:
            f.write(sql + "\n")
        
        f.write("\n-- Insert FDA Questions\n")
        for sql in all_questions_sql:
            f.write(sql + "\n")
        
        f.write("\n-- Insert Question Applicability Mappings\n")
        for sql in all_applicability_sql:
            f.write(sql + "\n")
    
    print(f"\n📄 SQL file generated: {output_file}")
    print(f"📊 Total: {sum(stats.values())} questions")
    
    # Generate report
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_questions': sum(stats.values()),
        'by_framework': stats,
    }
    
    report_file = '/home/ubuntu/mdr-compliance-platform/fda-import-report.json'
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"📄 Report saved: {report_file}")
    print("\n✅ SQL generation completed!")
    print(f"\n💡 To import: Execute the SQL file via webdev_execute_sql tool")

if __name__ == '__main__':
    main()
