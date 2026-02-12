/**
 * Audit Report Generator
 * 
 * Generates professional audit reports (FDA/MDR/ISO 13485/ISO 9001) with:
 * - 11 canonical sections (cover page → conclusion)
 * - Prioritized action plan
 * - Evidence index with clickable links
 * - Advanced charts (radar, heatmap, evolution)
 * - Comparison with previous audits
 * 
 * Export formats: PDF (primary), Excel, Word (optional)
 */

import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { audits, findings, actions, auditResponses, questions, referentials, processus, sites, evidenceFiles, users } from "../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { generateRadarChart, generateHistogramChart, generateHeatmapChart, generateTimelineChart } from './report-charts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ReportOptions {
  auditId: number;
  reportType: "complete" | "executive" | "comparative" | "action_plan" | "evidence_index";
  includeGraphs?: boolean;
  includeEvidence?: boolean;
  includeActionPlan?: boolean;
  comparedAuditIds?: number[]; // For comparative reports
  language?: "fr" | "en";
}

export interface AuditData {
  audit: any;
  site: any | null;
  responses: any[];
  findings: any[];
  actions: any[];
  evidenceFiles: any[];
  referentials: any[];
  processus: any[];
  auditor: any | null;
}

export interface ReportMetadata {
  totalQuestions: number;
  answeredQuestions: number;
  conformityRate: number;
  ncMajor: number;
  ncMinor: number;
  observations: number;
  ofi: number;
  totalActions: number;
  actionsOverdue: number;
  topRisks: Array<{ process: string; count: number }>;
}

// ============================================================================
// MAIN REPORT GENERATOR
// ============================================================================

export async function generateAuditReport(options: ReportOptions): Promise<Buffer> {
  // Fetch all audit data
  const auditData = await fetchAuditData(options.auditId);
  
  // Calculate metadata
  const metadata = calculateReportMetadata(auditData);
  
  // Generate PDF based on report type
  switch (options.reportType) {
    case "complete":
      return generateCompleteReport(auditData, metadata, options);
    case "executive":
      return generateExecutiveReport(auditData, metadata, options);
    case "comparative":
      return generateComparativeReport(auditData, metadata, options);
    case "action_plan":
      return generateActionPlanReport(auditData, metadata, options);
    case "evidence_index":
      return generateEvidenceIndexReport(auditData, metadata, options);
    default:
      throw new Error(`Unknown report type: ${options.reportType}`);
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchAuditData(auditId: number): Promise<AuditData> {
  const db = await getDb();
  
  // Fetch audit
  const [audit] = await db.select().from(audits).where(eq(audits.id, auditId));
  if (!audit) {
    throw new Error(`Audit not found: ${auditId}`);
  }

  // Fetch site
  const site = audit.siteId
    ? (await db.select().from(sites).where(eq(sites.id, audit.siteId)))[0]
    : null;

  // Fetch responses with questions
  const responses = await db
    .select({
      response: auditResponses,
      question: questions,
      referential: referentials,
      process: processus,
    })
    .from(auditResponses)
    .leftJoin(questions, eq(auditResponses.questionId, questions.id))
    .leftJoin(referentials, eq(questions.referentialId, referentials.id))
    .leftJoin(processus, eq(questions.processId, processus.id))
    .where(eq(auditResponses.userId, audit.userId));

  // Fetch findings
  const auditFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.auditId, auditId));

  // Fetch actions
  const findingIds = auditFindings.map((f) => f.id);
  const auditActions = findingIds.length > 0
    ? await db.select().from(actions).where(inArray(actions.findingId, findingIds))
    : [];

  // Fetch evidence files
  const questionIds = responses.map((r) => r.question?.id).filter(Boolean) as number[];
  const evidence = questionIds.length > 0
    ? await db.select().from(evidenceFiles).where(
        and(
          eq(evidenceFiles.userId, audit.userId),
          inArray(evidenceFiles.questionId, questionIds)
        )
      )
    : [];

  // Fetch auditor
  const auditor = audit.userId
    ? (await db.select().from(users).where(eq(users.id, audit.userId)))[0]
    : null;

  // Fetch referentials and processes
  const referentialIds = audit.referentialIds ? JSON.parse(audit.referentialIds) : [];
  const processIds = audit.processIds ? JSON.parse(audit.processIds) : [];

  const auditReferentials = referentialIds.length > 0
    ? await db.select().from(referentials).where(inArray(referentials.id, referentialIds))
    : [];

  const auditProcesses = processIds.length > 0
    ? await db.select().from(processus).where(inArray(processus.id, processIds))
    : [];

  return {
    audit,
    site,
    responses,
    findings: auditFindings,
    actions: auditActions,
    evidenceFiles: evidence,
    referentials: auditReferentials,
    processus: auditProcesses,
    auditor,
  };
}

// ============================================================================
// METADATA CALCULATION
// ============================================================================

function calculateReportMetadata(data: AuditData): ReportMetadata {
  const totalQuestions = data.responses.length;
  const answeredQuestions = data.responses.filter((r) => r.response.status !== "na").length;
  
  const conformeCount = data.responses.filter((r) => r.response.status === "conforme").length;
  const conformityRate = answeredQuestions > 0 ? (conformeCount / answeredQuestions) * 100 : 0;

  const ncMajor = data.findings.filter((f) => f.findingType === "nc_major").length;
  const ncMinor = data.findings.filter((f) => f.findingType === "nc_minor").length;
  const observations = data.findings.filter((f) => f.findingType === "observation").length;
  const ofi = data.findings.filter((f) => f.findingType === "ofi").length;

  const totalActions = data.actions.length;
  const now = new Date();
  const actionsOverdue = data.actions.filter(
    (a) => a.status !== "completed" && a.dueDate && new Date(a.dueDate) < now
  ).length;

  // Top risks by process
  const processCounts: Record<string, number> = {};
  data.findings.forEach((f) => {
    const processName = data.processus.find((p) => p.id === f.processId)?.name || "Unknown";
    processCounts[processName] = (processCounts[processName] || 0) + 1;
  });

  const topRisks = Object.entries(processCounts)
    .map(([process, count]) => ({ process, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalQuestions,
    answeredQuestions,
    conformityRate,
    ncMajor,
    ncMinor,
    observations,
    ofi,
    totalActions,
    actionsOverdue,
    topRisks,
  };
}

// ============================================================================
// COMPLETE REPORT GENERATOR (11 SECTIONS)
// ============================================================================

async function generateCompleteReport(
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers: Buffer[] = [];

  // Collect PDF data chunks
  doc.on("data", (chunk) => buffers.push(chunk));

  // SECTION 1: Cover Page
  generateCoverPage(doc, data, options);

  // SECTION 2: Context & Scope
  doc.addPage();
  generateContextSection(doc, data, options);

  // SECTION 3: Regulatory Profile
  doc.addPage();
  generateRegulatoryProfileSection(doc, data, options);

  // SECTION 4: Executive Summary
  doc.addPage();
  generateExecutiveSummarySection(doc, data, metadata, options);

  // SECTION 5: Charts & Graphs (if enabled)
  if (options.includeGraphs !== false) {
    doc.addPage();
    await generateChartsSection(doc, data, metadata, options);
  }

  // SECTION 6: Detailed Results by Referential
  doc.addPage();
  generateDetailedResultsSection(doc, data, options);

  // SECTION 7: Non-Conformities & Findings
  if (data.findings.length > 0) {
    doc.addPage();
    generateFindingsSection(doc, data, options);
  }

  // SECTION 8: Prioritized Action Plan (if enabled)
  if (options.includeActionPlan !== false && data.actions.length > 0) {
    doc.addPage();
    generateActionPlanSection(doc, data, options);
  }

  // SECTION 9: Evidence Index (if enabled)
  if (options.includeEvidence !== false && data.evidenceFiles.length > 0) {
    doc.addPage();
    generateEvidenceIndexSection(doc, data, options);
  }

  // SECTION 10: Comparison with Previous Audits (if comparative)
  if (options.comparedAuditIds && options.comparedAuditIds.length > 0) {
    doc.addPage();
    generateComparisonSection(doc, data, options);
  }

  // SECTION 11: Conclusion & Recommendations
  doc.addPage();
  generateConclusionSection(doc, data, metadata, options);

  // Finalize PDF and wait for completion
  doc.end();

  // Wait for PDF stream to finish
  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}

// ============================================================================
// SECTION 1: COVER PAGE
// ============================================================================

function generateCoverPage(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  const { audit, site, referentials } = data;

  // Title
  doc.fontSize(28).font("Helvetica-Bold").text("RAPPORT D'AUDIT", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(20).font("Helvetica").text(audit.name, { align: "center" });
  doc.moveDown(2);

  // Referentials
  doc.fontSize(14).font("Helvetica-Bold").text("Référentiel(s) audité(s) :", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).font("Helvetica");
  referentials.forEach((ref) => {
    doc.text(`• ${ref.name}`, { indent: 20 });
  });
  doc.moveDown(1);

  // Audit details
  const details = [
    { label: "Organisation / Site", value: site?.name || "N/A" },
    { label: "Type d'audit", value: audit.auditType || "N/A" },
    { label: "Date de début", value: audit.startDate ? new Date(audit.startDate).toLocaleDateString("fr-FR") : "N/A" },
    { label: "Date de fin", value: audit.endDate ? new Date(audit.endDate).toLocaleDateString("fr-FR") : "N/A" },
    { label: "Auditeur(s)", value: audit.auditorName || "N/A" },
    { label: "Version du rapport", value: "1.0" },
  ];

  doc.fontSize(12).font("Helvetica");
  details.forEach(({ label, value }) => {
    doc.text(`${label} : `, { continued: true }).font("Helvetica-Bold").text(value);
    doc.font("Helvetica").moveDown(0.5);
  });

  doc.moveDown(2);

  // Confidentiality notice
  doc.fontSize(10).font("Helvetica-Oblique").fillColor("gray");
  doc.text(
    "CONFIDENTIEL - Ce document contient des informations confidentielles et ne doit pas être divulgué sans autorisation.",
    { align: "center" }
  );
  doc.fillColor("black");
}

// ============================================================================
// SECTION 2: CONTEXT & SCOPE
// ============================================================================

function generateContextSection(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  const { audit, site, processes } = data;

  doc.fontSize(18).font("Helvetica-Bold").text("1. CONTEXTE & PÉRIMÈTRE");
  doc.moveDown(1);

  // Objective
  doc.fontSize(14).font("Helvetica-Bold").text("Objectif de l'audit");
  doc.fontSize(11).font("Helvetica").text(
    "Évaluer la conformité du système qualité aux exigences réglementaires applicables et identifier les opportunités d'amélioration."
  );
  doc.moveDown(0.5);

  // Type
  doc.fontSize(14).font("Helvetica-Bold").text("Type d'audit");
  doc.fontSize(11).font("Helvetica").text(audit.auditType || "N/A");
  doc.moveDown(0.5);

  // Organizational scope
  doc.fontSize(14).font("Helvetica-Bold").text("Périmètre organisationnel");
  doc.fontSize(11).font("Helvetica").text(site?.name || "Organisation complète");
  doc.moveDown(0.5);

  // Process scope
  doc.fontSize(14).font("Helvetica-Bold").text("Processus audités");
  doc.fontSize(11).font("Helvetica");
  if (processes.length > 0) {
    processes.forEach((proc) => {
      doc.text(`• ${proc.name}`, { indent: 20 });
    });
  } else {
    doc.text("Tous les processus");
  }
  doc.moveDown(0.5);

  // Methodology
  doc.fontSize(14).font("Helvetica-Bold").text("Méthodologie d'audit");
  doc.fontSize(11).font("Helvetica").text(
    "Audit basé sur l'examen documentaire, les entretiens avec le personnel clé, et l'observation des pratiques opérationnelles. " +
    "Les constats sont classés selon leur criticité (majeure, mineure, observation, OFI)."
  );
}

// ============================================================================
// SECTION 3: REGULATORY PROFILE
// ============================================================================

function generateRegulatoryProfileSection(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  const { referentials } = data;

  doc.fontSize(18).font("Helvetica-Bold").text("2. PROFIL RÉGLEMENTAIRE");
  doc.moveDown(1);

  // Market
  doc.fontSize(14).font("Helvetica-Bold").text("Marché cible");
  doc.fontSize(11).font("Helvetica").text("Union Européenne (UE) / États-Unis (FDA)");
  doc.moveDown(0.5);

  // Role
  doc.fontSize(14).font("Helvetica-Bold").text("Rôle(s) réglementaire(s)");
  doc.fontSize(11).font("Helvetica").text("Fabricant de dispositifs médicaux");
  doc.moveDown(0.5);

  // Applicable referentials
  doc.fontSize(14).font("Helvetica-Bold").text("Référentiels applicables");
  doc.fontSize(11).font("Helvetica");
  referentials.forEach((ref) => {
    doc.text(`• ${ref.name} ${ref.version || ""}`, { indent: 20 });
  });
}

// ============================================================================
// SECTION 4: EXECUTIVE SUMMARY
// ============================================================================

function generateExecutiveSummarySection(
  doc: PDFKit.PDFDocument,
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
) {
  doc.fontSize(18).font("Helvetica-Bold").text("3. SYNTHÈSE EXÉCUTIVE");
  doc.moveDown(1);

  // KPIs
  doc.fontSize(14).font("Helvetica-Bold").text("Indicateurs clés");
  doc.moveDown(0.5);

  const kpis = [
    { label: "Taux de conformité global", value: `${metadata.conformityRate.toFixed(1)}%` },
    { label: "Questions auditées", value: `${metadata.totalQuestions}` },
    { label: "Non-conformités majeures", value: `${metadata.ncMajor}` },
    { label: "Non-conformités mineures", value: `${metadata.ncMinor}` },
    { label: "Observations", value: `${metadata.observations}` },
    { label: "Opportunités d'amélioration", value: `${metadata.ofi}` },
    { label: "Actions correctives", value: `${metadata.totalActions}` },
    { label: "Actions en retard", value: `${metadata.actionsOverdue}` },
  ];

  doc.fontSize(11).font("Helvetica");
  kpis.forEach(({ label, value }) => {
    doc.text(`${label} : `, { continued: true }).font("Helvetica-Bold").text(value);
    doc.font("Helvetica").moveDown(0.3);
  });

  doc.moveDown(1);

  // Top risks
  doc.fontSize(14).font("Helvetica-Bold").text("Processus les plus impactés");
  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica");
  metadata.topRisks.forEach(({ process, count }) => {
    doc.text(`• ${process} : ${count} constat(s)`, { indent: 20 });
  });

  doc.moveDown(1);

  // Conclusion
  doc.fontSize(14).font("Helvetica-Bold").text("Conclusion Direction");
  doc.fontSize(11).font("Helvetica");
  
  let conclusion = "";
  if (metadata.conformityRate >= 90 && metadata.ncMajor === 0) {
    conclusion = "✅ READY - Le système qualité est conforme et prêt pour une inspection réglementaire.";
  } else if (metadata.conformityRate >= 75 && metadata.ncMajor <= 2) {
    conclusion = "⚠️ PARTIALLY READY - Des actions correctives sont nécessaires avant inspection.";
  } else {
    conclusion = "❌ NOT READY - Des non-conformités majeures doivent être traitées en priorité.";
  }
  
  doc.text(conclusion);
}

// ============================================================================
// SECTION 5: CHARTS & GRAPHS
// ============================================================================

async function generateChartsSection(
  doc: PDFKit.PDFDocument,
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
) {
  doc.fontSize(18).font("Helvetica-Bold").text("4. TABLEAUX & GRAPHIQUES");
  doc.moveDown(1);

  try {
    // 1. Radar Chart: Conformité par processus
    doc.fontSize(14).font("Helvetica-Bold").text("4.1 Conformité par Processus");
    doc.moveDown(0.5);
    
    const radarBuffer = await generateRadarChart(data, metadata);
    doc.image(radarBuffer, {
      fit: [500, 375],
      align: 'center',
    });
    doc.moveDown(1);

    // 2. Histogram: NC par criticité
    doc.fontSize(14).font("Helvetica-Bold").text("4.2 Non-Conformités par Criticité");
    doc.moveDown(0.5);
    
    const histogramBuffer = await generateHistogramChart(data, metadata);
    
    doc.image(histogramBuffer, {
      fit: [500, 375],
      align: 'center',
    });
    doc.moveDown(1);

    // 3. Heatmap: Risques par processus
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").text("4.3 Heatmap des Risques");
    doc.moveDown(0.5);
    
    const heatmapBuffer = await generateHeatmapChart(data, metadata);
    doc.image(heatmapBuffer, {
      fit: [500, 400],
      align: 'center',
    });
    doc.moveDown(1);

    // 4. Timeline: Évolution 12 mois
    doc.fontSize(14).font("Helvetica-Bold").text("4.4 Évolution de la Conformité");
    doc.moveDown(0.5);
    
    const timelineBuffer = await generateTimelineChart(data, metadata);
    doc.image(timelineBuffer, {
      fit: [500, 375],
      align: 'center',
    });

  } catch (error) {
    console.error('[Report] Chart generation error:', error);
    doc.fontSize(11).font("Helvetica").text(
      "[Erreur lors de la génération des graphiques. Les données sont disponibles dans les sections suivantes.]"
    );
  }
}

// ============================================================================
// SECTION 6: DETAILED RESULTS BY REFERENTIAL
// ============================================================================

function generateDetailedResultsSection(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  doc.fontSize(18).font("Helvetica-Bold").text("5. RÉSULTATS DÉTAILLÉS PAR RÉFÉRENTIEL");
  doc.moveDown(1);

  // Group responses by referential
  const responsesByRef: Record<string, any[]> = {};
  data.responses.forEach((r) => {
    const refName = r.referential?.name || "Unknown";
    if (!responsesByRef[refName]) {
      responsesByRef[refName] = [];
    }
    responsesByRef[refName].push(r);
  });

  // Generate table for each referential
  Object.entries(responsesByRef).forEach(([refName, responses]) => {
    doc.fontSize(14).font("Helvetica-Bold").text(refName);
    doc.moveDown(0.5);

    // Table header
    doc.fontSize(9).font("Helvetica-Bold");
    const colWidths = [60, 200, 80, 60];
    const startX = 50;
    let currentY = doc.y;

    doc.text("Processus", startX, currentY, { width: colWidths[0] });
    doc.text("Question", startX + colWidths[0], currentY, { width: colWidths[1] });
    doc.text("Statut", startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
    doc.text("Criticité", startX + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });

    currentY += 15;
    doc.moveTo(startX, currentY).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY).stroke();
    currentY += 5;

    // Table rows
    doc.fontSize(8).font("Helvetica");
    responses.slice(0, 20).forEach((r) => {
      const processName = r.process?.name || "N/A";
      const questionText = r.question?.questionText?.substring(0, 80) + "..." || "N/A";
      const status = r.response.status === "conforme" ? "✓ OK" : r.response.status === "nok" ? "✗ NOK" : "N/A";
      const criticality = r.question?.criticality || "N/A";

      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(processName, startX, currentY, { width: colWidths[0] });
      doc.text(questionText, startX + colWidths[0], currentY, { width: colWidths[1] });
      doc.text(status, startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
      doc.text(criticality, startX + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });

      currentY += 30;
    });

    doc.moveDown(2);
  });
}

// ============================================================================
// SECTION 7: NON-CONFORMITIES & FINDINGS
// ============================================================================

function generateFindingsSection(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  doc.fontSize(18).font("Helvetica-Bold").text("6. NON-CONFORMITÉS & CONSTATS");
  doc.moveDown(1);

  // Sort findings by criticality
  const sortedFindings = [...data.findings].sort((a, b) => {
    const criticalityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (criticalityOrder[a.criticality] || 999) - (criticalityOrder[b.criticality] || 999);
  });

  sortedFindings.forEach((finding, index) => {
    if (doc.y > 650) {
      doc.addPage();
    }

    // Finding header
    doc.fontSize(12).font("Helvetica-Bold");
    const typeLabel = finding.findingType === "nc_major" ? "NC MAJEURE" : 
                      finding.findingType === "nc_minor" ? "NC MINEURE" : 
                      finding.findingType === "observation" ? "OBSERVATION" : "OFI";
    
    doc.text(`${index + 1}. ${typeLabel} - ${finding.findingCode || "N/A"}`);
    doc.moveDown(0.3);

    // Finding details
    doc.fontSize(10).font("Helvetica");
    doc.text(`Titre : `, { continued: true }).font("Helvetica-Bold").text(finding.title);
    doc.font("Helvetica").moveDown(0.3);

    doc.text(`Description : ${finding.description}`);
    doc.moveDown(0.3);

    doc.text(`Clause : ${finding.clause || "N/A"}`);
    doc.text(`Criticité : ${finding.criticality}`);
    doc.text(`Statut : ${finding.status}`);
    doc.moveDown(0.5);

    // Associated actions
    const findingActions = data.actions.filter((a) => a.findingId === finding.id);
    if (findingActions.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold").text("Actions associées :");
      doc.font("Helvetica");
      findingActions.forEach((action) => {
        doc.text(`  • ${action.actionCode}: ${action.title}`, { indent: 20 });
      });
    }

    doc.moveDown(1);
  });
}

// ============================================================================
// SECTION 8: PRIORITIZED ACTION PLAN
// ============================================================================

function generateActionPlanSection(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  doc.fontSize(18).font("Helvetica-Bold").text("7. PLAN D'ACTION PRIORISÉ");
  doc.moveDown(1);

  // Sort actions by priority
  const sortedActions = [...data.actions].sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999);
  });

  // Table header
  doc.fontSize(9).font("Helvetica-Bold");
  const colWidths = [80, 180, 100, 80];
  const startX = 50;
  let currentY = doc.y;

  doc.text("Code Action", startX, currentY, { width: colWidths[0] });
  doc.text("Titre", startX + colWidths[0], currentY, { width: colWidths[1] });
  doc.text("Responsable", startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
  doc.text("Échéance", startX + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });

  currentY += 15;
  doc.moveTo(startX, currentY).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY).stroke();
  currentY += 5;

  // Table rows
  doc.fontSize(8).font("Helvetica");
  sortedActions.forEach((action) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }

    const code = action.actionCode || "N/A";
    const title = action.title.substring(0, 60) + (action.title.length > 60 ? "..." : "");
    const responsible = action.responsibleName || "N/A";
    const dueDate = action.dueDate ? new Date(action.dueDate).toLocaleDateString("fr-FR") : "N/A";

    doc.text(code, startX, currentY, { width: colWidths[0] });
    doc.text(title, startX + colWidths[0], currentY, { width: colWidths[1] });
    doc.text(responsible, startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
    doc.text(dueDate, startX + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });

    currentY += 25;
  });
}

// ============================================================================
// SECTION 9: EVIDENCE INDEX
// ============================================================================

function generateEvidenceIndexSection(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  doc.fontSize(18).font("Helvetica-Bold").text("8. INDEX DES PREUVES");
  doc.moveDown(1);

  doc.fontSize(11).font("Helvetica").text(
    `Total de ${data.evidenceFiles.length} fichier(s) de preuve référencé(s).`
  );
  doc.moveDown(0.5);

  // Table header
  doc.fontSize(9).font("Helvetica-Bold");
  const colWidths = [150, 100, 150];
  const startX = 50;
  let currentY = doc.y;

  doc.text("Nom du fichier", startX, currentY, { width: colWidths[0] });
  doc.text("Type", startX + colWidths[0], currentY, { width: colWidths[1] });
  doc.text("Date", startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });

  currentY += 15;
  doc.moveTo(startX, currentY).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), currentY).stroke();
  currentY += 5;

  // Table rows
  doc.fontSize(8).font("Helvetica");
  data.evidenceFiles.slice(0, 50).forEach((file) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }

    const fileName = file.fileName || "N/A";
    const fileType = file.mimeType || "N/A";
    const uploadDate = file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString("fr-FR") : "N/A";

    doc.text(fileName, startX, currentY, { width: colWidths[0] });
    doc.text(fileType, startX + colWidths[0], currentY, { width: colWidths[1] });
    doc.text(uploadDate, startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });

    currentY += 20;
  });
}

// ============================================================================
// SECTION 10: COMPARISON WITH PREVIOUS AUDITS (PLACEHOLDER)
// ============================================================================

function generateComparisonSection(doc: PDFKit.PDFDocument, data: AuditData, options: ReportOptions) {
  doc.fontSize(18).font("Helvetica-Bold").text("9. COMPARAISON AVEC AUDITS PRÉCÉDENTS");
  doc.moveDown(1);

  doc.fontSize(11).font("Helvetica").text(
    "[Comparaison temporelle sera implémentée dans une version ultérieure avec accès aux audits historiques]"
  );
  
  // TODO: Implement comparison logic
  // - Fetch previous audits
  // - Calculate evolution metrics
  // - Display trend charts
}

// ============================================================================
// SECTION 11: CONCLUSION & RECOMMENDATIONS
// ============================================================================

function generateConclusionSection(
  doc: PDFKit.PDFDocument,
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
) {
  doc.fontSize(18).font("Helvetica-Bold").text("10. CONCLUSION & RECOMMANDATIONS");
  doc.moveDown(1);

  // Overall assessment
  doc.fontSize(14).font("Helvetica-Bold").text("Niveau de maîtrise globale");
  doc.fontSize(11).font("Helvetica");
  
  let assessment = "";
  if (metadata.conformityRate >= 90) {
    assessment = "Le système qualité démontre un niveau de maîtrise élevé avec une conformité de " +
                 `${metadata.conformityRate.toFixed(1)}%. Les processus sont bien documentés et appliqués.`;
  } else if (metadata.conformityRate >= 75) {
    assessment = "Le système qualité présente un niveau de maîtrise satisfaisant avec une conformité de " +
                 `${metadata.conformityRate.toFixed(1)}%. Certaines améliorations sont nécessaires.`;
  } else {
    assessment = "Le système qualité nécessite des améliorations significatives. Le taux de conformité de " +
                 `${metadata.conformityRate.toFixed(1)}% indique des lacunes importantes.`;
  }
  
  doc.text(assessment);
  doc.moveDown(1);

  // Residual risks
  doc.fontSize(14).font("Helvetica-Bold").text("Risques résiduels");
  doc.fontSize(11).font("Helvetica");
  if (metadata.ncMajor > 0) {
    doc.text(`⚠️ ${metadata.ncMajor} non-conformité(s) majeure(s) identifiée(s) nécessitant un traitement prioritaire.`);
  }
  if (metadata.actionsOverdue > 0) {
    doc.text(`⚠️ ${metadata.actionsOverdue} action(s) en retard impactant la conformité globale.`);
  }
  if (metadata.ncMajor === 0 && metadata.actionsOverdue === 0) {
    doc.text("✓ Aucun risque résiduel majeur identifié.");
  }
  doc.moveDown(1);

  // Strategic recommendations
  doc.fontSize(14).font("Helvetica-Bold").text("Recommandations stratégiques");
  doc.fontSize(11).font("Helvetica");
  doc.text("1. Prioriser le traitement des non-conformités majeures identifiées");
  doc.text("2. Renforcer la formation du personnel sur les exigences critiques");
  doc.text("3. Améliorer la documentation et la traçabilité des processus clés");
  doc.text("4. Planifier un audit de suivi dans 6 mois pour vérifier l'efficacité des actions");
  doc.moveDown(1);

  // Inspection readiness
  doc.fontSize(14).font("Helvetica-Bold").text("Préparation inspection");
  doc.fontSize(11).font("Helvetica");
  
  let readiness = "";
  if (metadata.conformityRate >= 90 && metadata.ncMajor === 0) {
    readiness = "✅ READY - L'organisation est prête pour une inspection réglementaire.";
  } else if (metadata.conformityRate >= 75 && metadata.ncMajor <= 2) {
    readiness = "⚠️ PARTIALLY READY - Actions correctives requises avant inspection.";
  } else {
    readiness = "❌ NOT READY - Traitement prioritaire des NC majeures nécessaire.";
  }
  
  doc.text(readiness);
}

// ============================================================================
// EXECUTIVE REPORT (SIMPLIFIED)
// ============================================================================

async function generateExecutiveReport(
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Cover page
    generateCoverPage(doc, data, options);

    // Executive summary only
    doc.addPage();
    generateExecutiveSummarySection(doc, data, metadata, options);

    // Top findings
    if (data.findings.length > 0) {
      doc.addPage();
      doc.fontSize(18).font("Helvetica-Bold").text("CONSTATS PRIORITAIRES");
      doc.moveDown(1);
      
      const topFindings = data.findings
        .filter((f) => f.findingType === "nc_major" || f.criticality === "critical")
        .slice(0, 5);
      
      topFindings.forEach((finding, index) => {
        doc.fontSize(12).font("Helvetica-Bold").text(`${index + 1}. ${finding.title}`);
        doc.fontSize(10).font("Helvetica").text(finding.description);
        doc.moveDown(0.5);
      });
    }

    // Conclusion
    doc.addPage();
    generateConclusionSection(doc, data, metadata, options);

    doc.end();
  });
}

// ============================================================================
// COMPARATIVE REPORT (PLACEHOLDER)
// ============================================================================

async function generateComparativeReport(
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
): Promise<Buffer> {
  // TODO: Implement comparative report
  return generateExecutiveReport(data, metadata, options);
}

// ============================================================================
// ACTION PLAN REPORT
// ============================================================================

async function generateActionPlanReport(
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Cover page
    doc.fontSize(24).font("Helvetica-Bold").text("PLAN D'ACTION PRIORISÉ", { align: "center" });
    doc.moveDown(2);

    // Action plan
    generateActionPlanSection(doc, data, options);

    doc.end();
  });
}

// ============================================================================
// EVIDENCE INDEX REPORT
// ============================================================================

async function generateEvidenceIndexReport(
  data: AuditData,
  metadata: ReportMetadata,
  options: ReportOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Cover page
    doc.fontSize(24).font("Helvetica-Bold").text("INDEX DES PREUVES", { align: "center" });
    doc.moveDown(2);

    // Evidence index
    generateEvidenceIndexSection(doc, data, options);

    doc.end();
  });
}
