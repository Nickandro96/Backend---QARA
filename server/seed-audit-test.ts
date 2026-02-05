/**
 * Seed script to create a complete test audit for report generation testing
 * 
 * Creates:
 * - 1 site (Test Manufacturing Site)
 * - 1 audit (ISO 13485 audit)
 * - 50 audit responses (mix of compliant/non-compliant/na)
 * - 10 findings (5 major NC, 3 minor NC, 2 observations)
 * - 5 corrective actions
 * - Evidence files references
 */

import { getDb } from "./db";
import { sites, audits, auditResponses, findings, actions, questions, referentials, processes, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function seedAuditTest() {
  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available");
    process.exit(1);
  }
  
  console.log("🌱 Starting audit test seed...");

  // Get or create a test user (use first user in database)
  const usersResult = await db.select().from(users).limit(1);
  if (usersResult.length === 0) {
    console.error("❌ No users found in database. Please create a user first.");
    process.exit(1);
  }
  const userId = usersResult[0].id;
  console.log(`✅ Using user ID: ${userId}`);

  // 1. Create test site
  console.log("\n📍 Creating test site...");
  const [site] = await db.insert(sites).values({
    name: "Test Manufacturing Site - Paris",
    address: "123 Rue de la Conformité, 75001 Paris, France",
    country: "France",
    market: "EU",
    economicRole: "fabricant",
    userId,
  }).returning();
  console.log(`✅ Site created: ${site.name} (ID: ${site.id})`);

  // 2. Get ISO 13485 referential
  console.log("\n📚 Finding ISO 13485 referential...");
  const [iso13485] = await db.select().from(referentials).where(eq(referentials.name, "ISO 13485:2016")).limit(1);
  if (!iso13485) {
    console.error("❌ ISO 13485 referential not found");
    process.exit(1);
  }
  console.log(`✅ Referential found: ${iso13485.name} (ID: ${iso13485.id})`);

  // 3. Get some processes
  console.log("\n⚙️ Finding processes...");
  const allProcesses = await db.select().from(processes).limit(5);
  if (allProcesses.length === 0) {
    console.error("❌ No processes found");
    process.exit(1);
  }
  console.log(`✅ Found ${allProcesses.length} processes`);

  // 4. Create audit
  console.log("\n📋 Creating test audit...");
  const [audit] = await db.insert(audits).values({
    name: "Audit ISO 13485 - Test Complet",
    type: "internal",
    status: "completed",
    siteId: site.id,
    userId,
    referentialIds: JSON.stringify([iso13485.id]),
    processIds: JSON.stringify(allProcesses.map(p => p.id)),
    startDate: new Date("2024-01-15"),
    endDate: new Date("2024-01-19"),
    auditDate: new Date("2024-01-15"),
    score: 78.5,
    conformityRate: 78.5,
    market: "EU",
    economicRole: "fabricant",
    auditors: JSON.stringify(["Jean Dupont (Lead Auditor)", "Marie Martin (Technical Expert)"]),
    objectives: "Évaluer la conformité du système de management de la qualité selon ISO 13485:2016",
    scope: "Tous les processus de conception, fabrication et distribution de dispositifs médicaux de classe IIa",
    methodology: "Audit documentaire + interviews + observations terrain",
    conclusions: "Le système QMS est globalement conforme avec quelques non-conformités mineures à corriger",
  }).returning();
  console.log(`✅ Audit created: ${audit.name} (ID: ${audit.id})`);

  // 5. Get some questions from ISO 13485
  console.log("\n❓ Finding questions...");
  const allQuestions = await db.select()
    .from(questions)
    .where(eq(questions.referentialId, iso13485.id))
    .limit(50);
  
  if (allQuestions.length === 0) {
    console.error("❌ No questions found for ISO 13485");
    process.exit(1);
  }
  console.log(`✅ Found ${allQuestions.length} questions`);

  // 6. Create audit responses (mix of compliant/non-compliant/na)
  console.log("\n✍️ Creating audit responses...");
  const responses = [];
  
  for (let i = 0; i < allQuestions.length; i++) {
    const question = allQuestions[i];
    let status: "conforme" | "non_conforme" | "na";
    let comment = "";
    let evidenceFiles: string[] = [];

    // Create realistic distribution:
    // 70% compliant, 20% non-compliant, 10% na
    const rand = Math.random();
    if (rand < 0.7) {
      status = "conforme";
      comment = "Conforme - Documentation vérifiée et processus en place";
      evidenceFiles = [`evidence_${i + 1}_procedure.pdf`, `evidence_${i + 1}_record.pdf`];
    } else if (rand < 0.9) {
      status = "non_conforme";
      comment = "Non-conforme - Écart identifié nécessitant une action corrective";
      evidenceFiles = [`evidence_${i + 1}_nc_photo.jpg`];
    } else {
      status = "na";
      comment = "Non applicable - Processus non concerné par cette exigence";
      evidenceFiles = [];
    }

    responses.push({
      auditId: audit.id,
      questionId: question.id,
      status,
      comment,
      evidenceFiles: JSON.stringify(evidenceFiles),
      respondedBy: userId,
      respondedAt: new Date(),
    });
  }

  await db.insert(auditResponses).values(responses);
  console.log(`✅ Created ${responses.length} audit responses`);

  // 7. Create findings (NC majeures, mineures, observations)
  console.log("\n🔍 Creating findings...");
  const findingsData = [
    {
      auditId: audit.id,
      type: "non_conformite_majeure",
      title: "NC Majeure - Absence de validation du processus de stérilisation",
      description: "Le processus de stérilisation des dispositifs n'a pas été validé conformément à ISO 11135. Aucun rapport de validation disponible.",
      processId: allProcesses[0].id,
      referentialId: iso13485.id,
      chapter: "7.5.6 - Validation des processus",
      severity: "critique",
      riskLevel: "high",
      impact: "Risque de contamination des dispositifs et de non-conformité réglementaire",
      rootCause: "Manque de ressources qualifiées pour la validation",
      recommendation: "Recruter un expert en validation ou faire appel à un consultant externe",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-16"),
    },
    {
      auditId: audit.id,
      type: "non_conformite_majeure",
      title: "NC Majeure - Gestion inadéquate des réclamations clients",
      description: "Plusieurs réclamations clients n'ont pas été traitées dans les délais réglementaires (>30 jours)",
      processId: allProcesses[1].id,
      referentialId: iso13485.id,
      chapter: "8.2.2 - Réclamations",
      severity: "critique",
      riskLevel: "high",
      impact: "Non-conformité MDR Article 83, risque de sanctions réglementaires",
      rootCause: "Absence de système informatisé de suivi des réclamations",
      recommendation: "Implémenter un système CRM dédié aux réclamations",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-16"),
    },
    {
      auditId: audit.id,
      type: "non_conformite_majeure",
      title: "NC Majeure - Traçabilité incomplète des composants",
      description: "La traçabilité des composants critiques n'est pas assurée de bout en bout",
      processId: allProcesses[2].id,
      referentialId: iso13485.id,
      chapter: "7.5.9 - Traçabilité",
      severity: "elevee",
      riskLevel: "medium",
      impact: "Impossibilité de rappeler des lots spécifiques en cas de problème",
      rootCause: "Système ERP obsolète ne supportant pas la traçabilité unitaire",
      recommendation: "Mise à niveau du système ERP ou implémentation d'un module de traçabilité",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-17"),
    },
    {
      auditId: audit.id,
      type: "non_conformite_majeure",
      title: "NC Majeure - Revue de conception incomplète",
      description: "Les revues de conception ne couvrent pas tous les aspects requis par la norme",
      processId: allProcesses[3].id,
      referentialId: iso13485.id,
      chapter: "7.3.4 - Revue de conception",
      severity: "elevee",
      riskLevel: "medium",
      impact: "Risque de défauts de conception non détectés",
      rootCause: "Check-list de revue de conception incomplète",
      recommendation: "Réviser et compléter la check-list de revue de conception",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-17"),
    },
    {
      auditId: audit.id,
      type: "non_conformite_majeure",
      title: "NC Majeure - Formation insuffisante du personnel",
      description: "Certains opérateurs n'ont pas reçu la formation requise pour les processus critiques",
      processId: allProcesses[4].id,
      referentialId: iso13485.id,
      chapter: "6.2 - Ressources humaines",
      severity: "elevee",
      riskLevel: "medium",
      impact: "Risque d'erreurs de fabrication et de non-conformités produit",
      rootCause: "Plan de formation non à jour",
      recommendation: "Mettre à jour le plan de formation et former le personnel manquant",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-18"),
    },
    {
      auditId: audit.id,
      type: "non_conformite_mineure",
      title: "NC Mineure - Documentation obsolète",
      description: "Certaines procédures affichées en production ne sont pas à la dernière version",
      processId: allProcesses[0].id,
      referentialId: iso13485.id,
      chapter: "4.2.4 - Maîtrise des documents",
      severity: "moyenne",
      riskLevel: "low",
      impact: "Risque de confusion pour les opérateurs",
      rootCause: "Processus de mise à jour des documents affiché non formalisé",
      recommendation: "Formaliser le processus de mise à jour des documents affichés",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-18"),
    },
    {
      auditId: audit.id,
      type: "non_conformite_mineure",
      title: "NC Mineure - Étalonnage en retard",
      description: "3 instruments de mesure ont dépassé leur date d'étalonnage de 2 semaines",
      processId: allProcesses[1].id,
      referentialId: iso13485.id,
      chapter: "7.6 - Maîtrise des équipements de surveillance et de mesure",
      severity: "moyenne",
      riskLevel: "low",
      impact: "Risque de mesures imprécises",
      rootCause: "Absence d'alerte automatique pour les étalonnages",
      recommendation: "Implémenter un système d'alerte automatique",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-18"),
    },
    {
      auditId: audit.id,
      type: "non_conformite_mineure",
      title: "NC Mineure - Enregistrements incomplets",
      description: "Certains enregistrements de contrôle qualité ne comportent pas toutes les signatures requises",
      processId: allProcesses[2].id,
      referentialId: iso13485.id,
      chapter: "4.2.5 - Maîtrise des enregistrements",
      severity: "faible",
      riskLevel: "low",
      impact: "Traçabilité des contrôles non optimale",
      rootCause: "Formulaires papier mal conçus",
      recommendation: "Réviser les formulaires et passer à un système électronique",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-19"),
    },
    {
      auditId: audit.id,
      type: "observation",
      title: "Observation - Opportunité d'amélioration du processus d'achat",
      description: "Le processus d'évaluation des fournisseurs pourrait être renforcé avec des audits plus fréquents",
      processId: allProcesses[3].id,
      referentialId: iso13485.id,
      chapter: "7.4 - Achats",
      severity: "faible",
      riskLevel: "low",
      impact: "Amélioration potentielle de la qualité des composants achetés",
      rootCause: "N/A - Opportunité d'amélioration",
      recommendation: "Planifier des audits fournisseurs annuels pour les fournisseurs critiques",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-19"),
    },
    {
      auditId: audit.id,
      type: "observation",
      title: "Observation - Amélioration de la communication interne",
      description: "La communication entre les équipes R&D et production pourrait être améliorée",
      processId: allProcesses[4].id,
      referentialId: iso13485.id,
      chapter: "5.5.3 - Communication interne",
      severity: "faible",
      riskLevel: "low",
      impact: "Réduction potentielle des délais de mise sur le marché",
      rootCause: "N/A - Opportunité d'amélioration",
      recommendation: "Organiser des réunions hebdomadaires inter-équipes",
      status: "open",
      identifiedBy: userId,
      identifiedAt: new Date("2024-01-19"),
    },
  ];

  const createdFindings = await db.insert(findings).values(findingsData).returning();
  console.log(`✅ Created ${createdFindings.length} findings (5 major NC, 3 minor NC, 2 observations)`);

  // 8. Create corrective actions for major NCs
  console.log("\n🎯 Creating corrective actions...");
  const actionsData = [
    {
      auditId: audit.id,
      findingId: createdFindings[0].id,
      title: "CAPA - Validation du processus de stérilisation",
      description: "Recruter un consultant externe pour valider le processus de stérilisation selon ISO 11135",
      type: "corrective",
      priority: "high",
      status: "in_progress",
      assignedTo: userId,
      dueDate: new Date("2024-03-15"),
      createdBy: userId,
      createdAt: new Date("2024-01-20"),
    },
    {
      auditId: audit.id,
      findingId: createdFindings[1].id,
      title: "CAPA - Implémentation système CRM réclamations",
      description: "Sélectionner et implémenter un système CRM dédié aux réclamations clients",
      type: "corrective",
      priority: "high",
      status: "planned",
      assignedTo: userId,
      dueDate: new Date("2024-04-30"),
      createdBy: userId,
      createdAt: new Date("2024-01-20"),
    },
    {
      auditId: audit.id,
      findingId: createdFindings[2].id,
      title: "CAPA - Mise à niveau système ERP",
      description: "Mettre à niveau le système ERP pour supporter la traçabilité unitaire",
      type: "corrective",
      priority: "medium",
      status: "planned",
      assignedTo: userId,
      dueDate: new Date("2024-06-30"),
      createdBy: userId,
      createdAt: new Date("2024-01-20"),
    },
    {
      auditId: audit.id,
      findingId: createdFindings[3].id,
      title: "CAPA - Révision check-list revue de conception",
      description: "Réviser et compléter la check-list de revue de conception",
      type: "corrective",
      priority: "medium",
      status: "completed",
      assignedTo: userId,
      dueDate: new Date("2024-02-28"),
      completedAt: new Date("2024-02-15"),
      createdBy: userId,
      createdAt: new Date("2024-01-20"),
    },
    {
      auditId: audit.id,
      findingId: createdFindings[4].id,
      title: "CAPA - Formation du personnel",
      description: "Mettre à jour le plan de formation et former le personnel manquant",
      type: "corrective",
      priority: "high",
      status: "in_progress",
      assignedTo: userId,
      dueDate: new Date("2024-03-31"),
      createdBy: userId,
      createdAt: new Date("2024-01-20"),
    },
  ];

  await db.insert(actions).values(actionsData);
  console.log(`✅ Created ${actionsData.length} corrective actions`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ SEED COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`  - Site: ${site.name} (ID: ${site.id})`);
  console.log(`  - Audit: ${audit.name} (ID: ${audit.id})`);
  console.log(`  - Responses: ${responses.length}`);
  console.log(`  - Findings: ${createdFindings.length} (5 major NC, 3 minor NC, 2 observations)`);
  console.log(`  - Actions: ${actionsData.length}`);
  console.log(`\n🎯 Next steps:`);
  console.log(`  1. Go to /reports/generate?auditId=${audit.id}`);
  console.log(`  2. Select report type and generate PDF`);
  console.log(`  3. Download and review the generated report`);
  console.log("\n");
}

// Run seed
seedAuditTest()
  .then(() => {
    console.log("✅ Seed script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed script failed:", error);
    process.exit(1);
  });
