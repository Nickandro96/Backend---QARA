#!/usr/bin/env node
/**
 * FDA Questions Import Script (Node.js + Drizzle)
 * Imports 229 questions from 8 Excel files into fda_questions table
 * Generates stable external_id (HASH) for upsert capability
 * Creates fda_question_applicability mappings based on framework rules
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import ExcelJS from 'exceljs';
import { getDb } from './db.js';
import { fdaQuestions, fdaRoles, fdaQuestionApplicability } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

// Framework mapping: filename → framework_code
const FRAMEWORK_MAPPING = {
  'QuestionnairesauditsFDA-21CFRPart820.xlsx': 'FDA_820',
  'QuestionnairesauditsFDA-21CFRPart807.xlsx': 'FDA_807',
  'QuestionnairesauditsFDA-510(K).xlsx': 'FDA_510K',
  'QuestionnairesauditsFDA-DeNovo.xlsx': 'FDA_DENOVO',
  'QuestionnairesauditsFDA-PMA.xlsx': 'FDA_PMA',
  'QuestionnairesauditsFDA-PostMarket.xlsx': 'FDA_POSTMARKET',
  'QuestionnairesauditsFDA-Labeling.xlsx': 'FDA_LABELING',
  'QuestionnairesauditsFDA-UDI.xlsx': 'FDA_UDI',
};

// Framework applicability rules (which FDA roles can see each framework)
const FRAMEWORK_APPLICABILITY = {
  FDA_820: ['FDA_LM', 'FDA_CMO'],
  FDA_807: ['FDA_LM', 'FDA_CMO', 'FDA_IMP'],
  FDA_510K: ['FDA_LM'],
  FDA_DENOVO: ['FDA_LM'],
  FDA_PMA: ['FDA_LM'],
  FDA_POSTMARKET: ['FDA_LM', 'FDA_IMP', 'FDA_DIST'],
  FDA_LABELING: ['FDA_LM', 'FDA_CMO'],
  FDA_UDI: ['FDA_LM', 'FDA_CMO'],
};

// FDA Roles to insert
const FDA_ROLES = [
  { roleCode: 'FDA_LM', roleName: 'Legal Manufacturer / Specification Developer', description: 'Entity whose name appears on the device label and who designs or specifies the device' },
  { roleCode: 'FDA_CMO', roleName: 'Contract Manufacturer', description: 'Entity that manufactures or reworks devices for another company' },
  { roleCode: 'FDA_IMP', roleName: 'Initial Importer', description: 'Entity that imports devices into the United States for commercial distribution' },
  { roleCode: 'FDA_DIST', roleName: 'Distributor', description: 'Entity that distributes devices without modifying them' },
  { roleCode: 'FDA_CONSULTANT', roleName: 'Consultant / Auditor', description: 'External consultant or auditor with extended read access' },
];

/**
 * Generate stable external_id using HASH
 */
function generateExternalId(frameworkCode, process, subprocess, referenceExact, questionShort) {
  const components = [
    frameworkCode || '',
    process || '',
    subprocess || '',
    referenceExact || '',
    (questionShort || '').substring(0, 100),
  ];
  const combined = components.join('|');
  return createHash('sha256').update(combined).digest('hex').substring(0, 64);
}

/**
 * Insert FDA roles
 */
async function insertFdaRoles(db) {
  console.log('\n📋 Inserting FDA roles...');
  
  for (const role of FDA_ROLES) {
    // Check if role exists
    const existing = await db.select().from(fdaRoles).where(eq(fdaRoles.roleCode, role.roleCode)).limit(1);
    
    if (existing.length === 0) {
      await db.insert(fdaRoles).values(role);
      console.log(`  ✅ Inserted role: ${role.roleCode}`);
    } else {
      // Update existing role
      await db.update(fdaRoles)
        .set({ roleName: role.roleName, description: role.description })
        .where(eq(fdaRoles.roleCode, role.roleCode));
      console.log(`  ✅ Updated role: ${role.roleCode}`);
    }
  }
  
  console.log(`✅ Inserted/updated ${FDA_ROLES.length} FDA roles`);
}

/**
 * Import questions from a single Excel file
 */
async function importExcelFile(filePath, frameworkCode, db, stats) {
  console.log(`\n📄 Processing: ${basename(filePath)} → ${frameworkCode}`);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  let rowCount = 0;
  
  // Skip header row (row 1)
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    
    // Skip empty rows
    if (!row.hasValues) continue;
    
    // Map Excel columns to database fields
    const process = row.getCell(1).value?.toString() || null;
    const subprocess = row.getCell(2).value?.toString() || null;
    const referenceStandard = row.getCell(3).value?.toString() || null;
    const referenceExact = row.getCell(4).value?.toString() || null;
    const questionShort = row.getCell(5).value?.toString() || null;
    const questionDetailed = row.getCell(6).value?.toString() || null;
    const expectedEvidence = row.getCell(7).value?.toString() || null;
    const interviews = row.getCell(8).value?.toString() || null;
    const fieldTest = row.getCell(9).value?.toString() || null;
    const riskIfNc = row.getCell(10).value?.toString() || null;
    const criticality = row.getCell(11).value?.toString() || null;
    
    // Generate external_id
    const externalId = generateExternalId(frameworkCode, process, subprocess, referenceExact, questionShort);
    
    // Check if question exists
    const existing = await db.select().from(fdaQuestions).where(eq(fdaQuestions.externalId, externalId)).limit(1);
    
    let questionId;
    
    if (existing.length === 0) {
      // Insert new question
      const result = await db.insert(fdaQuestions).values({
        externalId,
        frameworkCode,
        process,
        subprocess,
        referenceStandard,
        referenceExact,
        questionShort,
        questionDetailed,
        expectedEvidence,
        interviews,
        fieldTest,
        riskIfNc,
        criticality,
        applicabilityType: 'ROLE_BASED',
        sourceFile: basename(filePath),
        sourceRow: rowNumber,
      });
      questionId = result[0].insertId;
    } else {
      // Update existing question
      questionId = existing[0].id;
      await db.update(fdaQuestions)
        .set({
          process,
          subprocess,
          referenceStandard,
          referenceExact,
          questionShort,
          questionDetailed,
          expectedEvidence,
          interviews,
          fieldTest,
          riskIfNc,
          criticality,
        })
        .where(eq(fdaQuestions.id, questionId));
    }
    
    // Create applicability mappings
    const applicableRoles = FRAMEWORK_APPLICABILITY[frameworkCode] || [];
    for (const roleCode of applicableRoles) {
      // Check if mapping exists
      const existingMapping = await db.select()
        .from(fdaQuestionApplicability)
        .where(eq(fdaQuestionApplicability.questionId, questionId))
        .where(eq(fdaQuestionApplicability.roleCode, roleCode))
        .limit(1);
      
      if (existingMapping.length === 0) {
        await db.insert(fdaQuestionApplicability).values({
          questionId,
          roleCode,
        });
      }
    }
    
    rowCount++;
  }
  
  stats[frameworkCode] = rowCount;
  console.log(`✅ Imported ${rowCount} questions from ${frameworkCode}`);
}

/**
 * Generate import report
 */
function generateReport(stats) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 FDA QUESTIONS IMPORT REPORT');
  console.log('='.repeat(60));
  
  let total = 0;
  for (const [frameworkCode, count] of Object.entries(stats).sort()) {
    console.log(`  ${frameworkCode.padEnd(20)} ${count.toString().padStart(3)} questions`);
    total += count;
  }
  
  console.log('-'.repeat(60));
  console.log(`  ${'TOTAL'.padEnd(20)} ${total.toString().padStart(3)} questions`);
  console.log('='.repeat(60));
  
  // Save report to JSON
  const report = {
    timestamp: new Date().toISOString(),
    total_questions: total,
    by_framework: stats,
    frameworks: Object.values(FRAMEWORK_MAPPING),
    roles: FDA_ROLES.map(r => r.roleCode),
  };
  
  const reportPath = '/home/ubuntu/mdr-compliance-platform/fda-import-report.json';
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 FDA Questions Import Script');
  console.log('='.repeat(60));
  
  // Check if Excel files exist
  const excelDir = '/home/ubuntu/upload';
  const excelFiles = readdirSync(excelDir)
    .filter(f => f.startsWith('QuestionnairesauditsFDA-') && f.endsWith('.xlsx'))
    .map(f => join(excelDir, f));
  
  if (excelFiles.length === 0) {
    console.error(`❌ No Excel files found in ${excelDir}`);
    process.exit(1);
  }
  
  console.log(`📁 Found ${excelFiles.length} Excel files`);
  
  // Connect to database
  console.log('\n🔌 Connecting to database...');
  const db = await getDb();
  
  try {
    // Insert FDA roles first
    await insertFdaRoles(db);
    
    // Import questions from each Excel file
    const stats = {};
    for (const filePath of excelFiles.sort()) {
      const filename = basename(filePath);
      const frameworkCode = FRAMEWORK_MAPPING[filename];
      
      if (!frameworkCode) {
        console.warn(`⚠️  Skipping unknown file: ${filename}`);
        continue;
      }
      
      await importExcelFile(filePath, frameworkCode, db, stats);
    }
    
    // Generate report
    generateReport(stats);
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error(`\n❌ Import failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main
main().catch(console.error);
