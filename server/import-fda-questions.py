#!/usr/bin/env python3.11
"""
FDA Questions Import Script
Imports 229 questions from 8 Excel files into fda_questions table
Generates stable external_id (HASH) for upsert capability
Creates fda_question_applicability mappings based on framework rules
"""

import os
import sys
import glob
import hashlib
import json
from datetime import datetime
import openpyxl
import mysql.connector
from mysql.connector import Error

# Framework mapping: filename → framework_code
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

# Framework applicability rules (which FDA roles can see each framework)
# Format: framework_code → list of role_codes
FRAMEWORK_APPLICABILITY = {
    'FDA_820': ['FDA_LM', 'FDA_CMO'],
    'FDA_807': ['FDA_LM', 'FDA_CMO', 'FDA_IMP'],
    'FDA_510K': ['FDA_LM'],
    'FDA_DENOVO': ['FDA_LM'],
    'FDA_PMA': ['FDA_LM'],
    'FDA_POSTMARKET': ['FDA_LM', 'FDA_IMP', 'FDA_DIST'],  # Simplified: all have some postmarket obligations
    'FDA_LABELING': ['FDA_LM', 'FDA_CMO'],
    'FDA_UDI': ['FDA_LM', 'FDA_CMO'],
}

# FDA Roles to insert
FDA_ROLES = [
    ('FDA_LM', 'Legal Manufacturer / Specification Developer', 'Entity whose name appears on the device label and who designs or specifies the device'),
    ('FDA_CMO', 'Contract Manufacturer', 'Entity that manufactures or reworks devices for another company'),
    ('FDA_IMP', 'Initial Importer', 'Entity that imports devices into the United States for commercial distribution'),
    ('FDA_DIST', 'Distributor', 'Entity that distributes devices without modifying them'),
    ('FDA_CONSULTANT', 'Consultant / Auditor', 'External consultant or auditor with extended read access'),
]

def generate_external_id(framework_code, process, subprocess, reference_exact, question_short):
    """
    Generate stable external_id using HASH
    Format: HASH(framework_code + "|" + process + "|" + subprocess + "|" + reference_exact + "|" + question_short)
    """
    components = [
        str(framework_code or ''),
        str(process or ''),
        str(subprocess or ''),
        str(reference_exact or ''),
        str(question_short or '')[:100],  # Limit to 100 chars to avoid huge hashes
    ]
    combined = '|'.join(components)
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()[:64]

def get_db_connection():
    """Get MySQL database connection from environment variables"""
    try:
        # Read DATABASE_URL from .env or environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable not set")
        
        # Parse DATABASE_URL (format: mysql://user:password@host:port/database)
        # For simplicity, use direct connection params
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'gateway01.us-east-1.prod.aws.tidbcloud.com'),
            port=int(os.getenv('DB_PORT', 4000)),
            user=os.getenv('DB_USER', 'your_user'),
            password=os.getenv('DB_PASSWORD', 'your_password'),
            database=os.getenv('DB_NAME', 'your_database'),
            ssl_ca='/etc/ssl/certs/ca-certificates.crt',
            ssl_verify_cert=True,
            ssl_verify_identity=True,
        )
        return connection
    except Error as e:
        print(f"❌ Error connecting to MySQL: {e}")
        sys.exit(1)

def insert_fda_roles(cursor):
    """Insert 5 FDA roles into fda_roles table"""
    print("\n📋 Inserting FDA roles...")
    
    for role_code, role_name, description in FDA_ROLES:
        cursor.execute("""
            INSERT INTO fda_roles (roleCode, roleName, description)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                roleName = VALUES(roleName),
                description = VALUES(description)
        """, (role_code, role_name, description))
    
    print(f"✅ Inserted/updated {len(FDA_ROLES)} FDA roles")

def import_excel_file(file_path, framework_code, cursor, stats):
    """Import questions from a single Excel file"""
    print(f"\n📄 Processing: {os.path.basename(file_path)} → {framework_code}")
    
    try:
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active
        
        # Skip header row (row 1)
        row_count = 0
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row or not any(row):  # Skip empty rows
                continue
            
            # Map Excel columns to database fields
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
            external_id = generate_external_id(
                framework_code, process, subprocess, reference_exact, question_short
            )
            
            # Determine applicability_type (for now, all are ROLE_BASED)
            # In future, we could add logic to detect "ALL" questions
            applicability_type = 'ROLE_BASED'
            
            # Insert/update question
            cursor.execute("""
                INSERT INTO fda_questions (
                    externalId, frameworkCode, process, subprocess, referenceStandard,
                    referenceExact, questionShort, questionDetailed, expectedEvidence,
                    interviews, fieldTest, riskIfNc, criticality, applicabilityType,
                    sourceFile, sourceRow
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON DUPLICATE KEY UPDATE
                    process = VALUES(process),
                    subprocess = VALUES(subprocess),
                    referenceStandard = VALUES(referenceStandard),
                    referenceExact = VALUES(referenceExact),
                    questionShort = VALUES(questionShort),
                    questionDetailed = VALUES(questionDetailed),
                    expectedEvidence = VALUES(expectedEvidence),
                    interviews = VALUES(interviews),
                    fieldTest = VALUES(fieldTest),
                    riskIfNc = VALUES(riskIfNc),
                    criticality = VALUES(criticality),
                    applicabilityType = VALUES(applicabilityType),
                    updatedAt = CURRENT_TIMESTAMP
            """, (
                external_id, framework_code, process, subprocess, reference_standard,
                reference_exact, question_short, question_detailed, expected_evidence,
                interviews, field_test, risk_if_nc, criticality, applicability_type,
                os.path.basename(file_path), row_idx
            ))
            
            # Get question_id (either newly inserted or existing)
            cursor.execute("SELECT id FROM fda_questions WHERE externalId = %s", (external_id,))
            question_id = cursor.fetchone()[0]
            
            # Create applicability mappings
            applicable_roles = FRAMEWORK_APPLICABILITY.get(framework_code, [])
            for role_code in applicable_roles:
                cursor.execute("""
                    INSERT INTO fda_question_applicability (questionId, roleCode)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE questionId = questionId
                """, (question_id, role_code))
            
            row_count += 1
        
        stats[framework_code] = row_count
        print(f"✅ Imported {row_count} questions from {framework_code}")
        
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        raise

def generate_report(stats):
    """Generate import report"""
    print("\n" + "="*60)
    print("📊 FDA QUESTIONS IMPORT REPORT")
    print("="*60)
    
    total = 0
    for framework_code, count in sorted(stats.items()):
        print(f"  {framework_code:20} {count:3} questions")
        total += count
    
    print("-"*60)
    print(f"  {'TOTAL':20} {total:3} questions")
    print("="*60)
    
    # Export to JSON for verification
    report_file = '/home/ubuntu/mdr-compliance-platform/fda-import-report.json'
    with open(report_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_questions': total,
            'by_framework': stats,
            'frameworks': list(FRAMEWORK_MAPPING.values()),
            'roles': [r[0] for r in FDA_ROLES],
        }, f, indent=2)
    
    print(f"\n📄 Report saved to: {report_file}")

def main():
    """Main import process"""
    print("🚀 FDA Questions Import Script")
    print("="*60)
    
    # Check if Excel files exist
    excel_dir = '/home/ubuntu/upload'
    excel_files = glob.glob(os.path.join(excel_dir, 'QuestionnairesauditsFDA-*.xlsx'))
    
    if not excel_files:
        print(f"❌ No Excel files found in {excel_dir}")
        sys.exit(1)
    
    print(f"📁 Found {len(excel_files)} Excel files")
    
    # Connect to database
    print("\n🔌 Connecting to database...")
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        # Insert FDA roles first
        insert_fda_roles(cursor)
        connection.commit()
        
        # Import questions from each Excel file
        stats = {}
        for file_path in sorted(excel_files):
            filename = os.path.basename(file_path)
            framework_code = FRAMEWORK_MAPPING.get(filename)
            
            if not framework_code:
                print(f"⚠️  Skipping unknown file: {filename}")
                continue
            
            import_excel_file(file_path, framework_code, cursor, stats)
            connection.commit()
        
        # Generate report
        generate_report(stats)
        
        print("\n✅ Import completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        connection.rollback()
        sys.exit(1)
    
    finally:
        cursor.close()
        connection.close()

if __name__ == '__main__':
    main()
