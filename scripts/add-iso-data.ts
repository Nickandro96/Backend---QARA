/**
 * ISO 13485 Data Integration Script
 * Adds ISO 13485 questions to fallback-data.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FALLBACK_PATH = join(__dirname, '../server/fallback-data.ts');

const ISO_QUESTIONS = [
  { id: "iso-4-1-q1", article: "Clause 4.1", questionText: "Le système de management de la qualité est-il documenté et maintenu conformément à la norme ISO 13485 ?", questionShort: "Documentation SMQ", criticality: "high", economicRole: "fabricant", applicableRoles: ["fabricant", "mandataire", "importateur", "distributeur"], applicableProcesses: ["qms"] },
  { id: "iso-4-2-q1", article: "Clause 4.2", questionText: "La documentation comprend-elle une politique qualité et des objectifs qualité ?", questionShort: "Politique et objectifs", criticality: "medium", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["qms", "gov_strat"] },
  { id: "iso-5-1-q1", article: "Clause 5.1", questionText: "La direction fournit-elle des preuves de son engagement envers le développement et la mise en œuvre du SMQ ?", questionShort: "Engagement direction", criticality: "high", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["gov_strat"] },
  { id: "iso-6-2-q1", article: "Clause 6.2", questionText: "Le personnel effectuant un travail ayant une incidence sur la qualité est-il compétent ?", questionShort: "Compétence personnel", criticality: "medium", economicRole: "fabricant", applicableRoles: ["fabricant", "importateur", "distributeur"], applicableProcesses: ["qms"] },
  { id: "iso-7-4-1-q1", article: "Clause 7.4.1", questionText: "L'organisation a-t-elle établi des critères pour la sélection, l'évaluation et la réévaluation des fournisseurs ?", questionShort: "Sélection fournisseurs", criticality: "critical", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["purchasing_suppliers"] },
  { id: "iso-8-2-1-q1", article: "Clause 8.2.1", questionText: "L'organisation a-t-elle établi un processus de rétroaction pour fournir un avertissement précoce des problèmes de qualité ?", questionShort: "Rétroaction clients", criticality: "high", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["pms_pmcf"] }
];

try {
  let content = readFileSync(FALLBACK_PATH, 'utf-8');

  // Replace FALLBACK_ISO_QUESTIONS
  const isoQuestionsStr = `export const FALLBACK_ISO_QUESTIONS = ${JSON.stringify(ISO_QUESTIONS, null, 2)};`;
  content = content.replace(/export const FALLBACK_ISO_QUESTIONS = \[[\s\S]*?\];/, isoQuestionsStr);

  writeFileSync(FALLBACK_PATH, content);
  console.log("✅ ISO 13485 questions integrated successfully!");
} catch (error) {
  console.error("❌ Error during integration:", error);
  process.exit(1);
}
