/**
 * Seed script for dashboard demo data
 * Creates realistic audit data for multi-site, multi-process, multi-referential scenarios
 */

import { db } from "./_core/db";
import {
  sites,
  audits,
  findings,
  actions,
  auditChecklistAnswers,
  aggMonthlySite,
  aggMonthlyProcess,
  aggStandardClause,
  aggRequirementPareto,
  referentials,
  processes,
  questions,
} from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

// Demo data configuration
const DEMO_USER_ID = 1; // Will be updated to actual user ID

// Sites data
const sitesData = [
  { name: "Site Paris - Siège", code: "PAR", address: "15 rue de la Paix, 75001 Paris", country: "France" },
  { name: "Site Lyon - Production", code: "LYO", address: "45 avenue Jean Jaurès, 69007 Lyon", country: "France" },
  { name: "Site Bordeaux - R&D", code: "BDX", address: "12 quai des Chartrons, 33000 Bordeaux", country: "France" },
  { name: "Site Munich - EU", code: "MUC", address: "Maximilianstraße 35, 80539 München", country: "Germany" },
  { name: "Site Boston - US", code: "BOS", address: "100 Cambridge St, Boston, MA 02114", country: "USA" },
];

// Generate random date within range
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate random score between min and max
function randomScore(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Finding types distribution
const findingTypes = ["nc_major", "nc_minor", "observation", "ofi", "positive"] as const;
const findingTypeWeights = [0.05, 0.15, 0.25, 0.20, 0.35]; // Weighted distribution

function getRandomFindingType(): typeof findingTypes[number] {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < findingTypes.length; i++) {
    cumulative += findingTypeWeights[i];
    if (rand < cumulative) return findingTypes[i];
  }
  return "positive";
}

// Action statuses
const actionStatuses = ["open", "in_progress", "completed", "verified"] as const;

export async function seedDashboardDemo(userId: number) {
  console.log("Starting dashboard demo seed for user:", userId);

  try {
    // Get existing referentials and processes
    const existingReferentials = await db.select().from(referentials);
    const existingProcesses = await db.select().from(processes);
    const existingQuestions = await db.select().from(questions);

    if (existingReferentials.length === 0 || existingProcesses.length === 0) {
      console.log("No referentials or processes found. Please seed base data first.");
      return { success: false, message: "Missing base data" };
    }

    // Create sites
    console.log("Creating sites...");
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
    }

    // Create audits (12 months of data, 2-4 audits per month)
    console.log("Creating audits...");
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const createdAudits = [];

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + month, 1);
      const monthEnd = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + month + 1, 0);
      const auditsThisMonth = Math.floor(Math.random() * 3) + 2; // 2-4 audits

      for (let a = 0; a < auditsThisMonth; a++) {
        const site = createdSites[Math.floor(Math.random() * createdSites.length)];
        const auditType = ["internal", "external", "supplier", "certification"][Math.floor(Math.random() * 4)] as any;
        const status = month < 11 ? "closed" : ["completed", "in_progress"][Math.floor(Math.random() * 2)] as any;
        const startDate = randomDate(monthStart, monthEnd);
        const endDate = new Date(startDate.getTime() + (Math.random() * 5 + 1) * 24 * 60 * 60 * 1000);
        const score = randomScore(65, 98);
        const conformityRate = randomScore(70, 99);

        // Select random referentials (1-3)
        const numRefs = Math.floor(Math.random() * 3) + 1;
        const selectedRefs = existingReferentials
          .sort(() => Math.random() - 0.5)
          .slice(0, numRefs)
          .map(r => r.id);

        // Select random processes (2-5)
        const numProcs = Math.floor(Math.random() * 4) + 2;
        const selectedProcs = existingProcesses
          .sort(() => Math.random() - 0.5)
          .slice(0, numProcs)
          .map(p => p.id);

        const [audit] = await db.insert(audits).values({
          userId,
          siteId: site.id,
          name: `Audit ${auditType} - ${site.code} - ${monthStart.toISOString().slice(0, 7)}`,
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
        });
      }
    }

    // Create findings for each audit
    console.log("Creating findings...");
    const createdFindings = [];
    let findingCounter = 1;

    for (const audit of createdAudits) {
      const numFindings = Math.floor(Math.random() * 8) + 3; // 3-10 findings per audit

      for (let f = 0; f < numFindings; f++) {
        const findingType = getRandomFindingType();
        const refId = audit.referentialIds[Math.floor(Math.random() * audit.referentialIds.length)];
        const procId = audit.processIds[Math.floor(Math.random() * audit.processIds.length)];
        const criticality = findingType === "nc_major" ? "critical" : 
                           findingType === "nc_minor" ? "high" : 
                           ["medium", "low"][Math.floor(Math.random() * 2)] as any;
        const status = findingType === "positive" ? "closed" : 
                      ["open", "in_progress", "closed", "verified"][Math.floor(Math.random() * 4)] as any;

        const [finding] = await db.insert(findings).values({
          auditId: audit.id,
          referentialId: refId,
          processId: procId,
          findingCode: `F-${new Date().getFullYear()}-${String(findingCounter++).padStart(4, '0')}`,
          findingType,
          title: `${findingType === "nc_major" ? "Non-conformité majeure" : 
                   findingType === "nc_minor" ? "Non-conformité mineure" : 
                   findingType === "observation" ? "Observation" : 
                   findingType === "ofi" ? "Opportunité d'amélioration" : 
                   "Point positif"} - Processus ${procId}`,
          description: `Description détaillée du constat relatif au processus et au référentiel audité.`,
          clause: ["4.1", "5.2", "7.3", "8.2", "9.1", "10.2"][Math.floor(Math.random() * 6)],
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
        });
      }
    }

    // Create actions for NC findings
    console.log("Creating actions...");
    let actionCounter = 1;

    for (const finding of createdFindings) {
      if (finding.findingType === "nc_major" || finding.findingType === "nc_minor") {
        const numActions = Math.floor(Math.random() * 3) + 1; // 1-3 actions per NC

        for (let a = 0; a < numActions; a++) {
          const actionType = ["corrective", "preventive", "improvement"][Math.floor(Math.random() * 3)] as any;
          const priority = finding.findingType === "nc_major" ? "critical" : 
                          ["high", "medium"][Math.floor(Math.random() * 2)] as any;
          const status = actionStatuses[Math.floor(Math.random() * 4)];
          const dueDate = new Date(Date.now() + (Math.random() * 90 - 30) * 24 * 60 * 60 * 1000);

          await db.insert(actions).values({
            findingId: finding.id,
            actionCode: `CAPA-${new Date().getFullYear()}-${String(actionCounter++).padStart(4, '0')}`,
            actionType,
            title: `Action ${actionType} pour le constat F-${finding.id}`,
            description: `Description de l'action corrective ou préventive à mettre en œuvre.`,
            responsibleName: ["Jean Dupont", "Marie Martin", "Pierre Bernard"][Math.floor(Math.random() * 3)],
            priority,
            status,
            dueDate,
            completedAt: status === "completed" || status === "verified" ? new Date() : null,
            verifiedAt: status === "verified" ? new Date() : null,
            effectivenessVerified: status === "verified",
          });
        }
      }
    }

    // Create audit checklist answers
    console.log("Creating checklist answers...");
    const sampleQuestions = existingQuestions.slice(0, Math.min(50, existingQuestions.length));

    for (const audit of createdAudits.slice(0, 10)) { // Limit to 10 audits for performance
      for (const question of sampleQuestions) {
        const answer = ["conforme", "nok", "na", "partial"][Math.floor(Math.random() * 4)] as any;
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
      }
    }

    // Generate aggregates
    console.log("Generating aggregates...");
    await generateAggregates(userId, createdSites, existingProcesses, existingReferentials);

    console.log("Dashboard demo seed completed successfully!");
    return { 
      success: true, 
      message: "Demo data created",
      stats: {
        sites: createdSites.length,
        audits: createdAudits.length,
        findings: createdFindings.length,
      }
    };

  } catch (error) {
    console.error("Error seeding dashboard demo:", error);
    return { success: false, message: String(error) };
  }
}

async function generateAggregates(
  userId: number, 
  sitesList: any[], 
  processesList: any[], 
  referentialsList: any[]
) {
  const now = new Date();
  
  // Generate monthly aggregates for the past 12 months
  for (let month = 0; month < 12; month++) {
    const yearMonth = new Date(now.getFullYear(), now.getMonth() - month, 1)
      .toISOString().slice(0, 7);

    // Aggregate by site
    for (const site of sitesList) {
      await db.insert(aggMonthlySite).values({
        userId,
        siteId: site.id,
        yearMonth,
        auditCount: Math.floor(Math.random() * 3) + 1,
        avgScore: randomScore(70, 95).toString(),
        avgConformityRate: randomScore(75, 98).toString(),
        ncMajorCount: Math.floor(Math.random() * 3),
        ncMinorCount: Math.floor(Math.random() * 8),
        observationCount: Math.floor(Math.random() * 10),
        ofiCount: Math.floor(Math.random() * 5),
        totalActions: Math.floor(Math.random() * 15) + 5,
        closedActions: Math.floor(Math.random() * 12) + 3,
        overdueActions: Math.floor(Math.random() * 3),
        avgClosureDays: randomScore(5, 45).toString(),
      });
    }

    // Aggregate by process
    for (const process of processesList) {
      await db.insert(aggMonthlyProcess).values({
        userId,
        processId: process.id,
        yearMonth,
        auditCount: Math.floor(Math.random() * 5) + 1,
        avgScore: randomScore(65, 98).toString(),
        avgConformityRate: randomScore(70, 99).toString(),
        ncMajorCount: Math.floor(Math.random() * 2),
        ncMinorCount: Math.floor(Math.random() * 6),
        observationCount: Math.floor(Math.random() * 8),
        ofiCount: Math.floor(Math.random() * 4),
        totalFindings: Math.floor(Math.random() * 15) + 3,
        riskScore: randomScore(10, 80).toString(),
      });
    }

    // Aggregate by standard/clause
    for (const ref of referentialsList) {
      const clauses = ["4.1", "4.2", "5.1", "5.2", "6.1", "7.1", "7.2", "7.3", "8.1", "8.2", "9.1", "10.1"];
      for (const clause of clauses.slice(0, Math.floor(Math.random() * 6) + 3)) {
        const total = Math.floor(Math.random() * 20) + 5;
        const conforme = Math.floor(total * (0.7 + Math.random() * 0.25));
        const nok = Math.floor((total - conforme) * 0.6);
        const na = total - conforme - nok;

        await db.insert(aggStandardClause).values({
          userId,
          referentialId: ref.id,
          clause,
          yearMonth,
          totalQuestions: total,
          conformeCount: conforme,
          nokCount: nok,
          naCount: na,
          conformityRate: ((conforme / (total - na)) * 100).toFixed(2),
          ncMajorCount: Math.floor(Math.random() * 2),
          ncMinorCount: Math.floor(nok * 0.7),
        });
      }
    }
  }
}

// Export for use in tRPC router
export default seedDashboardDemo;
