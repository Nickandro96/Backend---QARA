/**
 * Script simplifié pour créer des données de test dashboard
 * Usage: node server/seed-dashboard-simple.mjs
 */

import { getDb } from "./db.js";
import {
  sites,
  audits,
  findings,
  actions,
  auditChecklistAnswers,
  referentials,
  processes,
  questions,
  users,
} from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const db = getDb();

// Trouver l'utilisateur admin
const adminUser = await db.select().from(users).where(eq(users.email, "nickandroklauss@gmail.com")).limit(1);

if (adminUser.length === 0) {
  console.error("❌ Utilisateur admin non trouvé");
  process.exit(1);
}

const userId = adminUser[0].id;
console.log(`✅ Utilisateur trouvé: ${adminUser[0].name} (ID: ${userId})`);

// Récupérer les référentiels et processus existants
const existingReferentials = await db.select().from(referentials);
const existingProcesses = await db.select().from(processes);
const existingQuestions = await db.select().from(questions).limit(100);

console.log(`✅ ${existingReferentials.length} référentiels, ${existingProcesses.length} processus, ${existingQuestions.length} questions`);

// Créer 3 sites
console.log("\n📍 Création des sites...");
const sitesData = [
  { name: "Site Paris - Siège", code: "PAR", address: "15 rue de la Paix, 75001 Paris", country: "France" },
  { name: "Site Lyon - Production", code: "LYO", address: "45 avenue Jean Jaurès, 69007 Lyon", country: "France" },
  { name: "Site Bordeaux - R&D", code: "BDX", address: "12 quai des Chartrons, 33000 Bordeaux", country: "France" },
];

const createdSites = [];
for (const site of sitesData) {
  const [created] = await db.insert(sites).values({
    userId,
    name: site.name,
    code: site.code,
    address: site.address,
    country: site.country,
    isActive: true,
  });
  createdSites.push({ ...site, id: created.insertId });
  console.log(`  ✓ ${site.name}`);
}

// Créer 10 audits sur les 6 derniers mois
console.log("\n🔍 Création des audits...");
const now = new Date();
const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
const createdAudits = [];

const auditTypes = ["internal", "external", "supplier", "certification"];
const auditStatuses = ["draft", "in_progress", "completed", "closed"];

for (let i = 0; i < 10; i++) {
  const site = createdSites[i % createdSites.length];
  const monthOffset = Math.floor(i / 2); // 2 audits par mois
  const startDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + monthOffset, Math.floor(Math.random() * 28) + 1);
  const endDate = new Date(startDate.getTime() + (Math.random() * 5 + 1) * 24 * 60 * 60 * 1000);
  
  const auditType = auditTypes[Math.floor(Math.random() * auditTypes.length)];
  const status = i < 7 ? "closed" : auditStatuses[Math.floor(Math.random() * auditStatuses.length)];
  const score = Math.round((Math.random() * 30 + 65) * 100) / 100; // 65-95%
  const conformityRate = Math.round((Math.random() * 25 + 70) * 100) / 100; // 70-95%
  
  // Sélectionner 2-3 référentiels
  const numRefs = Math.floor(Math.random() * 2) + 2;
  const selectedRefs = existingReferentials
    .sort(() => Math.random() - 0.5)
    .slice(0, numRefs)
    .map(r => r.id);
  
  // Sélectionner 3-5 processus
  const numProcs = Math.floor(Math.random() * 3) + 3;
  const selectedProcs = existingProcesses
    .sort(() => Math.random() - 0.5)
    .slice(0, numProcs)
    .map(p => p.id);
  
  const [audit] = await db.insert(audits).values({
    userId,
    siteId: site.id,
    name: `Audit ${auditType} - ${site.code} - ${startDate.toISOString().slice(0, 7)}`,
    auditType,
    status,
    referentialIds: JSON.stringify(selectedRefs),
    processIds: JSON.stringify(selectedProcs),
    auditorName: ["Jean Dupont", "Marie Martin", "Pierre Bernard", "Sophie Petit"][Math.floor(Math.random() * 4)],
    startDate,
    endDate,
    closedAt: status === "closed" ? endDate : null,
    score: score.toString(),
    conformityRate: conformityRate.toString(),
  });
  
  createdAudits.push({
    id: audit.insertId,
    siteId: site.id,
    referentialIds: selectedRefs,
    processIds: selectedProcs,
    startDate,
    score,
    conformityRate,
    status,
  });
  
  console.log(`  ✓ Audit #${i + 1}: ${auditType} - ${site.code} - Score: ${score}%`);
}

// Créer des findings (constats) pour chaque audit
console.log("\n📋 Création des findings...");
const findingTypes = ["nc_major", "nc_minor", "observation", "ofi", "positive"];
const findingTypeWeights = [0.10, 0.20, 0.25, 0.20, 0.25]; // Distribution réaliste
const criticalities = ["critical", "high", "medium", "low"];
const findingStatuses = ["open", "in_progress", "closed", "verified"];

function getRandomFindingType() {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < findingTypes.length; i++) {
    cumulative += findingTypeWeights[i];
    if (rand < cumulative) return findingTypes[i];
  }
  return "positive";
}

const createdFindings = [];
let findingCounter = 1;

for (const audit of createdAudits) {
  const numFindings = Math.floor(Math.random() * 6) + 4; // 4-9 findings par audit
  
  for (let f = 0; f < numFindings; f++) {
    const findingType = getRandomFindingType();
    const refId = audit.referentialIds[Math.floor(Math.random() * audit.referentialIds.length)];
    const procId = audit.processIds[Math.floor(Math.random() * audit.processIds.length)];
    
    const criticality = findingType === "nc_major" ? "critical" : 
                       findingType === "nc_minor" ? "high" : 
                       criticalities[Math.floor(Math.random() * 2) + 2]; // medium ou low
    
    const status = findingType === "positive" ? "closed" : 
                  audit.status === "closed" ? findingStatuses[Math.floor(Math.random() * 4)] :
                  findingStatuses[Math.floor(Math.random() * 2)]; // open ou in_progress
    
    const [finding] = await db.insert(findings).values({
      auditId: audit.id,
      referentialId: refId,
      processId: procId,
      findingCode: `F-${new Date().getFullYear()}-${String(findingCounter++).padStart(4, '0')}`,
      findingType,
      title: `${findingType === "nc_major" ? "NC Majeure" : 
               findingType === "nc_minor" ? "NC Mineure" : 
               findingType === "observation" ? "Observation" : 
               findingType === "ofi" ? "Opportunité d'amélioration" : 
               "Point positif"} - Processus ${procId}`,
      description: `Constat détaillé identifié lors de l'audit concernant le processus ${procId} et le référentiel ${refId}.`,
      clause: ["4.1", "5.2", "7.3.4", "8.2.1", "9.1", "10.2"][Math.floor(Math.random() * 6)],
      criticality,
      riskScore: Math.floor(Math.random() * 100) + 1,
      status,
      closedAt: status === "closed" || status === "verified" ? audit.startDate : null,
    });
    
    createdFindings.push({
      id: finding.insertId,
      auditId: audit.id,
      findingType,
      status,
      criticality,
    });
  }
}

console.log(`  ✓ ${createdFindings.length} findings créés`);

// Créer des actions pour les NC
console.log("\n⚡ Création des actions correctives...");
const actionTypes = ["corrective", "preventive", "improvement"];
const actionStatuses = ["open", "in_progress", "completed", "verified", "cancelled"];
const actionPriorities = ["critical", "high", "medium", "low"];

let actionCounter = 1;
let actionsCreated = 0;

for (const finding of createdFindings) {
  if (finding.findingType === "nc_major" || finding.findingType === "nc_minor") {
    const numActions = Math.floor(Math.random() * 2) + 1; // 1-2 actions par NC
    
    for (let a = 0; a < numActions; a++) {
      const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      const priority = finding.findingType === "nc_major" ? "critical" : 
                      finding.criticality === "high" ? "high" :
                      actionPriorities[Math.floor(Math.random() * 2) + 1]; // medium ou low
      
      const status = finding.status === "closed" ? actionStatuses[Math.floor(Math.random() * 4)] :
                    actionStatuses[Math.floor(Math.random() * 3)]; // open, in_progress ou completed
      
      const dueDate = new Date(Date.now() + (Math.random() * 90 - 30) * 24 * 60 * 60 * 1000); // -30 à +60 jours
      
      await db.insert(actions).values({
        findingId: finding.id,
        actionCode: `CAPA-${new Date().getFullYear()}-${String(actionCounter++).padStart(4, '0')}`,
        actionType,
        title: `Action ${actionType} - Finding ${finding.id}`,
        description: `Description de l'action ${actionType} à mettre en œuvre pour traiter le constat identifié.`,
        responsibleName: ["Jean Dupont", "Marie Martin", "Pierre Bernard", "Sophie Petit"][Math.floor(Math.random() * 4)],
        responsibleEmail: ["jean.dupont@example.com", "marie.martin@example.com", "pierre.bernard@example.com", "sophie.petit@example.com"][Math.floor(Math.random() * 4)],
        priority,
        status,
        dueDate,
        completedAt: status === "completed" || status === "verified" ? new Date() : null,
        verifiedAt: status === "verified" ? new Date() : null,
        effectivenessVerified: status === "verified",
      });
      
      actionsCreated++;
    }
  }
}

console.log(`  ✓ ${actionsCreated} actions créées`);

// Créer des réponses de checklist pour quelques audits
console.log("\n✅ Création des réponses de checklist...");
const sampleQuestions = existingQuestions.slice(0, 30); // 30 questions par audit
const answerTypes = ["conforme", "nok", "na", "partial"];

let answersCreated = 0;

for (const audit of createdAudits.slice(0, 5)) { // Seulement 5 audits pour la performance
  for (const question of sampleQuestions) {
    const answer = answerTypes[Math.floor(Math.random() * answerTypes.length)];
    const maxScore = 10;
    const score = answer === "conforme" ? maxScore : 
                 answer === "partial" ? Math.floor(maxScore * 0.5) : 
                 answer === "na" ? null : 0;
    
    await db.insert(auditChecklistAnswers).values({
      auditId: audit.id,
      questionId: question.id,
      answer,
      score,
      maxScore,
      evidenceCount: Math.floor(Math.random() * 5),
    });
    
    answersCreated++;
  }
}

console.log(`  ✓ ${answersCreated} réponses de checklist créées`);

// Résumé final
console.log("\n" + "=".repeat(60));
console.log("✅ SEED DASHBOARD TERMINÉ AVEC SUCCÈS");
console.log("=".repeat(60));
console.log(`📊 Statistiques:`);
console.log(`  - Sites: ${createdSites.length}`);
console.log(`  - Audits: ${createdAudits.length}`);
console.log(`  - Findings: ${createdFindings.length}`);
console.log(`    • NC Majeures: ${createdFindings.filter(f => f.findingType === "nc_major").length}`);
console.log(`    • NC Mineures: ${createdFindings.filter(f => f.findingType === "nc_minor").length}`);
console.log(`    • Observations: ${createdFindings.filter(f => f.findingType === "observation").length}`);
console.log(`    • OFI: ${createdFindings.filter(f => f.findingType === "ofi").length}`);
console.log(`    • Points positifs: ${createdFindings.filter(f => f.findingType === "positive").length}`);
console.log(`  - Actions: ${actionsCreated}`);
console.log(`  - Réponses checklist: ${answersCreated}`);
console.log("=".repeat(60));

process.exit(0);
