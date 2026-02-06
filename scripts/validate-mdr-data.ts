/**
 * MDR Data Validation Script
 * Validates the integrity of MDR questions and processes
 */

import { FALLBACK_MDR_QUESTIONS, FALLBACK_PROCESSES } from "../server/fallback-data";
import { normalizeMdrQuestion } from "../server/mdr-validator";

console.log("🔍 MDR Data Validation Script\n");

// 1. Validate Processes
console.log("📋 Validating Processes...");
console.log(`Total processes: ${FALLBACK_PROCESSES.length}`);
FALLBACK_PROCESSES.forEach((p: any, idx: number) => {
  if (!p.id) console.warn(`  ⚠️ Process ${idx} missing id`);
  if (!p.name) console.warn(`  ⚠️ Process ${idx} missing name`);
});
console.log("✅ Processes validation complete\n");

// 2. Validate Questions
console.log("📝 Validating Questions...");
console.log(`Total questions: ${FALLBACK_MDR_QUESTIONS.length}`);

let validCount = 0;
let warningCount = 0;
let errorCount = 0;

FALLBACK_MDR_QUESTIONS.forEach((q: any, idx: number) => {
  try {
    const normalized = normalizeMdrQuestion(q, idx);
    
    // Check for critical fields
    if (!normalized.id) {
      console.error(`  ❌ Question ${idx} has empty id after normalization`);
      errorCount++;
    } else if (!normalized.questionText) {
      console.error(`  ❌ Question ${idx} (${normalized.id}) has empty questionText`);
      errorCount++;
    } else if (!normalized.criticality) {
      console.warn(`  ⚠️ Question ${idx} (${normalized.id}) has empty criticality`);
      warningCount++;
    } else if (!normalized.economicRole) {
      console.warn(`  ⚠️ Question ${idx} (${normalized.id}) has empty economicRole`);
      warningCount++;
    } else {
      validCount++;
    }
  } catch (e) {
    console.error(`  ❌ Question ${idx} failed normalization:`, e);
    errorCount++;
  }
});

console.log(`\n✅ Valid: ${validCount}`);
console.log(`⚠️  Warnings: ${warningCount}`);
console.log(`❌ Errors: ${errorCount}`);

// 3. Sample normalized questions
console.log("\n📊 Sample Normalized Questions:");
FALLBACK_MDR_QUESTIONS.slice(0, 3).forEach((q: any, idx: number) => {
  const normalized = normalizeMdrQuestion(q, idx);
  console.log(`\n  Q${idx + 1}: ${normalized.id}`);
  console.log(`    Text: ${normalized.questionText.substring(0, 50)}...`);
  console.log(`    Role: ${normalized.economicRole}`);
  console.log(`    Criticality: ${normalized.criticality}`);
});

// 4. Final Summary
console.log("\n" + "=".repeat(50));
if (errorCount === 0 && warningCount === 0) {
  console.log("✅ All MDR data is valid and ready for production!");
} else if (errorCount === 0) {
  console.log("⚠️  Data is mostly valid but has minor warnings");
} else {
  console.log("❌ Data validation failed - fix errors before deployment");
}
console.log("=".repeat(50));

process.exit(errorCount > 0 ? 1 : 0);
