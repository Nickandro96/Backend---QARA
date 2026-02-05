
import { getDb } from "../db";
import { referentials, processes, mdrQuestions, isoQuestions, fdaQuestions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting Core Data Seed...");
  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed. Make sure DATABASE_URL is set.");
    return;
  }

  // 1. Seed Referentials
  console.log("1️⃣ Seeding Referentials...");
  const referentialData = [
    { code: "MDR", name: "Règlement (UE) 2017/745 (MDR)", description: "Règlement relatif aux dispositifs médicaux", version: "2017/745" },
    { code: "ISO_13485", name: "ISO 13485:2016", description: "Dispositifs médicaux - Systèmes de management de la qualité", version: "2016" },
    { code: "ISO_9001", name: "ISO 9001:2015", description: "Systèmes de management de la qualité", version: "2015" },
    { code: "FDA_820", name: "FDA 21 CFR Part 820 (QSR)", description: "Quality System Regulation", version: "Part 820" },
    { code: "FDA_807", name: "FDA 21 CFR Part 807", description: "Establishment Registration and Device Listing", version: "Part 807" }
  ];

  for (const ref of referentialData) {
    const existing = await db.select().from(referentials).where(eq(referentials.code, ref.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(referentials).values(ref);
      console.log(`   ✅ Inserted referential: ${ref.code}`);
    }
  }

  // 2. Seed Processes
  console.log("2️⃣ Seeding Processes...");
  const processData = [
    { name: "Gouvernance & Management", description: "Responsabilité de la direction et stratégie", displayOrder: 1, icon: "LayoutDashboard" },
    { name: "Système de Management de la Qualité", description: "Documentation et maîtrise du SMQ", displayOrder: 2, icon: "FileText" },
    { name: "Conception & Développement", description: "Maîtrise de la conception des dispositifs", displayOrder: 3, icon: "Lightbulb" },
    { name: "Gestion des Risques", description: "Analyse et maîtrise des risques", displayOrder: 4, icon: "AlertTriangle" },
    { name: "Achats & Fournisseurs", description: "Maîtrise des fournisseurs et sous-traitants", displayOrder: 5, icon: "ShoppingCart" },
    { name: "Production & Prestation de service", description: "Maîtrise de la fabrication", displayOrder: 6, icon: "Factory" },
    { name: "Surveillance Après-Vente", description: "PMS et vigilance", displayOrder: 7, icon: "Activity" }
  ];

  for (const proc of processData) {
    const existing = await db.select().from(processes).where(eq(processes.name, proc.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(processes).values(proc);
      console.log(`   ✅ Inserted process: ${proc.name}`);
    }
  }

  // 3. Seed Sample MDR Questions
  console.log("3️⃣ Seeding MDR Questions...");
  const mdrSample = [
    { externalId: "mdr-q1", article: "Art. 10", questionText: "Le fabricant a-t-il établi, documenté, mis en œuvre et maintenu un système de gestion des risques ?", economicRole: "fabricant" as const, criticality: "critical" as const, processCategory: "QMS" },
    { externalId: "mdr-q2", article: "Art. 15", questionText: "Le fabricant dispose-t-il, au sein de son organisation, d'au moins une personne chargée du respect de la réglementation ?", economicRole: "fabricant" as const, criticality: "high" as const, processCategory: "RA" }
  ];

  for (const q of mdrSample) {
    const existing = await db.select().from(mdrQuestions).where(eq(mdrQuestions.externalId, q.externalId)).limit(1);
    if (existing.length === 0) {
      await db.insert(mdrQuestions).values(q);
      console.log(`   ✅ Inserted MDR question: ${q.externalId}`);
    }
  }

  // 4. Seed ISO Questions
  console.log("4️⃣ Seeding ISO Questions...");
  const isoSample = [
    { externalId: "iso-13485-q1", standard: "13485" as const, clauseTitle: "Système de management de la qualité", questionText: "L'organisme a-t-il établi, documenté et maintenu un SMQ conforme aux exigences de la norme ?", criticality: "high" as const, processCategory: "QMS" },
    { externalId: "iso-9001-q1", standard: "9001" as const, clauseTitle: "Leadership", questionText: "La direction démontre-t-elle son leadership et son engagement vis-à-vis du SMQ ?", criticality: "medium" as const, processCategory: "Management" }
  ];

  for (const q of isoSample) {
    const existing = await db.select().from(isoQuestions).where(eq(isoQuestions.externalId, q.externalId)).limit(1);
    if (existing.length === 0) {
      await db.insert(isoQuestions).values(q);
      console.log(`   ✅ Inserted ISO question: ${q.externalId}`);
    }
  }

  // 5. Seed FDA Questions (The 9 qualification questions logic)
  console.log("5️⃣ Seeding FDA Questions...");
  const fdaSample = [
    { externalId: "fda-820-q1", frameworkCode: "FDA_820", questionShort: "QSR Compliance", questionDetailed: "Does the manufacturer establish and maintain a quality system that is appropriate for the specific medical device(s)?", criticality: "critical", applicabilityType: "ALL" as const },
    { externalId: "fda-807-q1", frameworkCode: "FDA_807", questionShort: "Establishment Registration", questionDetailed: "Is the establishment registered with the FDA as required by 21 CFR Part 807?", criticality: "high", applicabilityType: "ALL" as const }
  ];

  for (const q of fdaSample) {
    const existing = await db.select().from(fdaQuestions).where(eq(fdaQuestions.externalId, q.externalId)).limit(1);
    if (existing.length === 0) {
      await db.insert(fdaQuestions).values(q);
      console.log(`   ✅ Inserted FDA question: ${q.externalId}`);
    }
  }

  console.log("✨ Seed Core Data Completed!");
}

seed().catch(console.error);
