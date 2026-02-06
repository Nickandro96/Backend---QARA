import { getDb } from "../server/db";
import * as schema from "../drizzle/schema";

const PROCESSES = [
  { id: "gov", name: "Gouvernance & stratégie réglementaire" },
  { id: "ra", name: "Affaires réglementaires (RA)" },
  { id: "qms", name: "Système de management qualité (QMS)" },
  { id: "risk", name: "Gestion des risques (ISO 14971)" },
  { id: "design", name: "Conception & développement" },
  { id: "purchasing", name: "Achats & fournisseurs" },
  { id: "production", name: "Production & sous-traitance" },
  { id: "traceability", name: "Traçabilité & UDI" },
  { id: "pms", name: "PMS / PMCF" },
  { id: "vigilance", name: "Vigilance & incidents" },
  { id: "distrib", name: "Distribution & logistique" },
  { id: "import", name: "Importation" },
  { id: "tech_doc", name: "Documentation technique" },
  { id: "audit", name: "Audits & conformité" },
  { id: "it", name: "IT / données / cybersécurité" }
];

const MDR_QUESTIONS = [
  {
    article: "Article 1",
    questionText: "Comment avez-vous déterminé que vos produits relèvent du champ MDR ?",
    processId: "ra",
    applicableRoles: ["fabricant"],
    criticality: "high"
  },
  {
    article: "Article 1",
    questionText: "Disposez-vous d'une justification écrite de qualification réglementaire ?",
    processId: "ra",
    applicableRoles: ["fabricant"],
    criticality: "high"
  },
  {
    article: "Article 10",
    questionText: "Votre QMS couvre-t-il l'intégralité des exigences MDR ?",
    processId: "qms",
    applicableRoles: ["fabricant"],
    criticality: "critical"
  },
  {
    article: "Article 13",
    questionText: "Comment l'importateur vérifie-t-il la conformité MDR avant mise sur le marché ?",
    processId: "import",
    applicableRoles: ["importateur"],
    criticality: "critical"
  },
  {
    article: "Article 14",
    questionText: "Comment le distributeur vérifie-t-il la conformité des DM reçus ?",
    processId: "distrib",
    applicableRoles: ["distributeur"],
    criticality: "high"
  },
  {
    article: "Article 15",
    questionText: "Une PRRC est-elle formellement désignée avec les compétences démontrées ?",
    processId: "gov",
    applicableRoles: ["fabricant", "mandataire"],
    criticality: "critical"
  }
];

async function seed() {
  const db = await getDb();
  console.log("🌱 Seeding MDR data...");

  // Insert Processes if they exist in schema (assuming generic table or just for logic)
  // For now, focus on mdr_questions
  
  for (const q of MDR_QUESTIONS) {
    try {
      await db.insert(schema.mdrQuestions).values({
        questionText: q.questionText,
        article: q.article,
        economicRole: q.applicableRoles[0], // Simplified for current schema
        criticality: q.criticality,
        isActive: true,
        displayOrder: 0
      });
    } catch (e) {
      console.error(`Error inserting question: ${q.article}`, e);
    }
  }

  console.log("✅ Seeding completed!");
  process.exit(0);
}

seed();
