import { getDb } from "../db.js";
import { questions, referentials, processes } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedFDA820() {
  console.log("🚀 Starting FDA_820 questions seed...");
  
  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed!");
    return;
  }
  
  // Load FDA_820 questions from JSON
  const dataPath = path.join(__dirname, "../data/fda-820-questions.json");
  const rawData = fs.readFileSync(dataPath, "utf-8");
  const data = JSON.parse(rawData);
  
  // Get referential ID for FDA_820
  const [fda820Ref] = await db
    .select()
    .from(referentials)
    .where(eq(referentials.code, "FDA_820"));
  
  if (!fda820Ref) {
    console.error("❌ FDA_820 referential not found in database!");
    return;
  }
  
  console.log(`✅ Found FDA_820 referential with ID: ${fda820Ref.id}`);
  
  // Get all processes from database
  const allProcesses = await db.select().from(processes);
  const processMap = new Map<string, number>();
  for (const proc of allProcesses) {
    processMap.set(proc.name, proc.id);
  }
  
  // Process mapping for processes (map FDA process names to existing process names in DB)
  const processMapping: Record<string, string> = {
    "Système de management de la qualité (QMS)": "Système de management de la qualité (QMS)",
    "Audits internes": "Audit interne",
    "Ressources humaines & formation": "Compétences / PRRC / formation",
    "Conception & développement": "Conception & développement",
    "Gestion documentaire": "Système de management de la qualité (QMS)", // Document control is part of QMS
    "Gestion des fournisseurs & achats": "Achats & fournisseurs",
    "Production & validation des procédés": "Production & validation des procédés",
    "Gestion des non-conformités": "Non-conformités & CAPA",
    "Actions correctives & préventives (CAPA)": "Non-conformités & CAPA",
    "Réclamations & vigilance": "PMS & vigilance",
    "Surveillance post-commercialisation": "PMS & vigilance"
  };
  
  // Insert questions
  let insertedCount = 0;
  let displayOrder = 1;
  
  for (const q of data.questions) {
    const processName = processMapping[q.process] || q.process;
    const processId = processMap.get(processName);
    
    if (!processId) {
      console.warn(`⚠️ Process not found: ${processName}, skipping question`);
      continue;
    }
    
    try {
      await db.insert(questions).values({
        referentialId: fda820Ref.id,
        processId: processId,
        article: q.article,
        annexe: null,
        economicRole: q.role,
        questionText: q.questionText,
        expectedEvidence: JSON.stringify(q.expectedEvidence),
        criticality: q.criticality,
        risks: q.risks,
        actionPlan: q.actionPlan,
        aiPrompt: q.aiPrompt,
        displayOrder: displayOrder++
      });
      
      insertedCount++;
    } catch (error) {
      console.error(`❌ Error inserting question: ${q.questionText}`, error);
    }
  }
  
  console.log(`✅ Inserted ${insertedCount} FDA_820 questions successfully!`);
  console.log(`📊 Total FDA questions in database: ${insertedCount + 109} (109 existing + ${insertedCount} new)`);
}

seedFDA820().catch(console.error);
