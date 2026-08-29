/**
 * Rendu PDF du rapport d'audit (Tâche D.2-D.5) — document de référence,
 * opposable. Consomme exclusivement l'objet ReportData assemblé par
 * reportData.ts (aucun accès DB ici, calcul de rendu pur).
 */
import PDFDocument from "pdfkit";
import { t, translateAuditNature, type ReportLanguage } from "./i18n";
import type { ReportData } from "./reportData";

const COLORS = {
  navy: "#0e1c3d",
  accent: "#3b6fe0",
  green: "#16a34a",
  orange: "#eab308",
  red: "#dc2626",
  gray: "#6b7280",
  lightGray: "#e5e7eb",
};

const PAGE_MARGIN = 50;

function graviteColor(gravite: string): string {
  if (gravite === "majeur") return COLORS.red;
  if (gravite === "mineur") return COLORS.orange;
  return COLORS.accent;
}

function fmtDate(iso: string | null): string {
  if (!iso) return null as any;
  return new Date(iso).toISOString().slice(0, 10);
}

export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  const lang = data.language;
  const L = (key: Parameters<typeof t>[0]) => t(key, lang);

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: {
      Title: `${L("reportTitle")} — ${data.auditName}`,
      Author: "QARA",
      CreationDate: new Date(),
    },
  });
  const buffers: Buffer[] = [];
  doc.on("data", (c: Buffer) => buffers.push(c));

  const notProvided = () => L("notProvided");
  const val = (v: string | number | null | undefined) =>
    v === null || v === undefined || v === "" ? notProvided() : String(v);

  function h1(text: string) {
    doc.moveDown(0.5);
    doc.fillColor(COLORS.navy).fontSize(16).font("Helvetica-Bold").text(text);
    doc.moveDown(0.3);
    doc.fillColor("black").font("Helvetica");
  }
  function h2(text: string) {
    doc.moveDown(0.4);
    doc.fillColor(COLORS.accent).fontSize(12).font("Helvetica-Bold").text(text);
    doc.moveDown(0.2);
    doc.fillColor("black").font("Helvetica");
  }
  function p(text: string, opts: any = {}) {
    doc.fontSize(10).font("Helvetica").fillColor("black").text(text, opts);
  }
  function labelValue(label: string, value: string) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.navy).text(`${label} : `, { continued: true });
    doc.font("Helvetica").fillColor("black").text(value);
  }
  function ensureSpace(minHeight: number) {
    if (doc.y > doc.page.height - PAGE_MARGIN - minHeight) {
      doc.addPage();
    }
  }

  // ============================================================
  // PAGE DE GARDE
  // ============================================================
  doc.fillColor(COLORS.navy).fontSize(10).font("Helvetica-Bold").text("QARA", { align: "left" });
  doc.moveDown(3);
  doc.fillColor(COLORS.navy).fontSize(26).font("Helvetica-Bold").text(L("reportTitle"), { align: "center" });
  doc.moveDown(0.3);
  doc.fillColor("black").fontSize(16).font("Helvetica").text(data.auditName, { align: "center" });
  doc.moveDown(2);

  const coverDetails: Array<[string, string]> = [
    [L("auditType"), val(translateAuditNature(data.auditNature, lang))],
    [L("organisationAudited"), val(data.organisationName)],
    [L("referentialsAudited"), data.referentialNames.join(", ") || notProvided()],
    [L("scope"), data.processScope.join(", ") || notProvided()],
    [L("auditDates"), `${val(fmtDate(data.startDate))} -> ${val(fmtDate(data.endDate))}`],
    [L("reference"), data.reportReference],
    [L("version"), String(data.reportVersion)],
    [L("status"), data.reportStatus === "draft" ? L("statusDraft") : L("statusFinal")],
    [L("emissionDate"), fmtDate(data.generatedAt)],
  ];
  coverDetails.forEach(([label, value]) => {
    labelValue(label, value);
    doc.moveDown(0.4);
  });

  doc.moveDown(1);
  h2(L("auditTeam"));
  if (data.auditTeam.length > 0) {
    data.auditTeam.forEach((m) => p(`• ${m.name}${m.role ? ` (${m.role})` : ""}`));
  } else {
    p(notProvided());
  }

  doc.moveDown(0.5);
  h2(L("auditeeRepresentatives"));
  if (data.auditeesRepresentatives.length > 0) {
    data.auditeesRepresentatives.forEach((rp) => p(`• ${rp.name}${rp.function ? ` — ${rp.function}` : ""}`));
  } else {
    p(notProvided());
  }

  doc.moveDown(2);
  doc.fontSize(9).font("Helvetica-Oblique").fillColor(COLORS.gray).text(
    `${L("confidential")} — ${L("distributionList")} : ${data.distributionList ?? notProvided()}`,
    { align: "center" }
  );
  doc.moveDown(3);
  doc.fontSize(9).fillColor(COLORS.gray).text(`${L("approvalSignature")} : ______________________`, { align: "center" });
  doc.fillColor("black");

  // ============================================================
  // SECTION 1 — CONTEXTE, OBJECTIFS ET MÉTHODOLOGIE
  // ============================================================
  doc.addPage();
  h1(L("section1Title"));
  h2(L("objectives"));
  p(L("objectivesText"));
  h2(L("methodology"));
  p(L("methodologyText"));
  h2(L("criteria"));
  p(data.referentialNames.join(", ") || notProvided());
  doc.moveDown(0.5);
  doc.rect(PAGE_MARGIN, doc.y, doc.page.width - 2 * PAGE_MARGIN, 0).stroke(COLORS.lightGray);
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica-Oblique").fillColor(COLORS.navy).text(L("samplingDisclaimer"));
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor(COLORS.gray).text(L("confidentialityClause"));
  doc.fillColor("black");
  doc.moveDown(0.5);
  h2(L("scopeExclusions"));
  p(val(data.scopeExclusions));

  // ============================================================
  // SECTION 2 — PROFIL RÉGLEMENTAIRE
  // ============================================================
  doc.addPage();
  h1(L("section2Title"));
  labelValue(L("economicRole"), val(data.economicRole));
  doc.moveDown(0.3);
  labelValue(L("targetMarkets"), data.markets.join(", ") || notProvided());
  doc.moveDown(0.3);
  labelValue(L("prrc"), data.prrcName ? `${data.prrcName}${data.prrcQualification ? ` (${data.prrcQualification})` : ""}` : notProvided());
  doc.moveDown(0.3);
  labelValue(
    L("notifiedBody"),
    data.notifiedBodyName ? `${data.notifiedBodyName}${data.notifiedBodyNumber ? ` (n°${data.notifiedBodyNumber})` : ""}` : notProvided()
  );
  doc.moveDown(0.5);
  h2(L("certificates"));
  if (data.certificates.length > 0) {
    data.certificates.forEach((c) =>
      p(`• ${val(c.referentialCode)} — ${val(c.certificateNumber)} (${val(fmtDate(c.issueDate))} -> ${val(fmtDate(c.expiryDate))})`)
    );
  } else {
    p(notProvided());
  }

  // ============================================================
  // SECTION 3 — SYNTHÈSE EXÉCUTIVE
  // ============================================================
  doc.addPage();
  h1(L("section3Title"));
  labelValue(L("globalScore"), `${data.globalScore.toFixed(1)}%`);
  doc.moveDown(0.5);
  h2(L("scoringMethod"));
  p(L("scoringMethodText"));
  doc.moveDown(0.5);
  h2(L("breakdown"));
  p(`${L("compliant")} : ${data.breakdown.compliant}  |  ${L("partial")} : ${data.breakdown.partial}  |  ${L("nonCompliant")} : ${data.breakdown.nonCompliant}  |  ${L("notApplicable")} : ${data.breakdown.notApplicable}`);
  doc.moveDown(0.5);
  h2(L("gapsByCriticality"));
  doc.fillColor(COLORS.red).text(`${L("criticalityMajor")} : ${data.gapsByGravite.majeur}`, { continued: true });
  doc.fillColor("black").text("   ", { continued: true });
  doc.fillColor(COLORS.orange).text(`${L("criticalityMinor")} : ${data.gapsByGravite.mineur}`, { continued: true });
  doc.fillColor("black").text("   ", { continued: true });
  doc.fillColor(COLORS.accent).text(`${L("criticalityObservation")} : ${data.gapsByGravite.observation}`);
  doc.fillColor("black");
  doc.moveDown(0.5);
  h2(L("verdict"));
  p(data.verdictPhrase);
  doc.moveDown(0.5);
  h2(L("previousAuditComparison"));
  if (data.previousAudit) {
    p(`${data.previousAudit.auditName} (${val(fmtDate(data.previousAudit.date))}) : ${data.previousAudit.score.toFixed(1)}% -> ${data.globalScore.toFixed(1)}%`);
  } else {
    p(L("noPreviousAudit"));
  }

  // ============================================================
  // SECTION 4 — RÉSULTATS PAR PROCESSUS
  // ============================================================
  doc.addPage();
  h1(L("section4Title"));
  if (data.processResults.length === 0) {
    p(notProvided());
  } else {
    const colX = [PAGE_MARGIN, PAGE_MARGIN + 180, PAGE_MARGIN + 280, PAGE_MARGIN + 340, PAGE_MARGIN + 400, PAGE_MARGIN + 460];
    doc.fontSize(9).font("Helvetica-Bold").fillColor("white");
    doc.rect(PAGE_MARGIN, doc.y, doc.page.width - 2 * PAGE_MARGIN, 18).fill(COLORS.navy);
    const headerY = doc.y - 18 + 4;
    doc.fillColor("white");
    doc.text(L("process"), colX[0], headerY, { width: 175 });
    doc.text(L("questionsCount"), colX[1], headerY, { width: 95 });
    doc.text(L("score"), colX[2], headerY, { width: 55 });
    doc.text(L("criticalityMajor"), colX[3], headerY, { width: 55 });
    doc.text(L("criticalityMinor"), colX[4], headerY, { width: 55 });
    doc.text(L("criticalityObservation"), colX[5], headerY, { width: 60 });
    doc.moveDown(0.3);
    doc.fillColor("black").font("Helvetica").fontSize(9);
    data.processResults.forEach((row, i) => {
      ensureSpace(20);
      const y = doc.y;
      if (i % 2 === 1) doc.rect(PAGE_MARGIN, y, doc.page.width - 2 * PAGE_MARGIN, 16).fill("#f3f4f6").fillColor("black");
      doc.text(row.processName, colX[0], y + 2, { width: 175 });
      doc.text(String(row.questionsApplicables), colX[1], y + 2, { width: 95 });
      doc.text(`${row.score.toFixed(0)}%`, colX[2], y + 2, { width: 55 });
      doc.text(String(row.ecartsMajeurs), colX[3], y + 2, { width: 55 });
      doc.text(String(row.ecartsMineurs), colX[4], y + 2, { width: 55 });
      doc.text(String(row.ecartsObservations), colX[5], y + 2, { width: 60 });
      doc.y = y + 16;
    });
  }

  // ============================================================
  // SECTION 5 — REGISTRE DES ÉCARTS (fiche en 3 temps, jamais scindée)
  // ============================================================
  doc.addPage();
  h1(L("section5Title"));
  if (data.gapRegister.length === 0) {
    doc.fillColor(COLORS.green).fontSize(11).text(`✓ ${L("noGaps")}`);
    doc.fillColor("black");
  } else {
    data.gapRegister.forEach((gap) => {
      // Estimation de hauteur pour éviter de scinder la fiche entre deux pages
      const estimatedHeight = 160;
      if (doc.y > doc.page.height - PAGE_MARGIN - estimatedHeight) {
        doc.addPage();
      }
      const boxTop = doc.y;
      doc.fontSize(11).font("Helvetica-Bold").fillColor(graviteColor(gap.gravite)).text(
        `${gap.reference} — ${gap.gravite === "majeur" ? L("criticalityMajor") : gap.gravite === "mineur" ? L("criticalityMinor") : L("criticalityObservation")}`
      );
      doc.fillColor("black").fontSize(9).font("Helvetica-Bold").text(`${L("requirement")} : `, { continued: true });
      doc.font("Helvetica").text(`${val(gap.requirementRef)} — ${val(gap.requirementTitle)}`);
      doc.font("Helvetica-Bold").text(`${L("objectiveEvidence")} : `, { continued: true });
      doc.font("Helvetica").text(val(gap.objectiveEvidence));
      doc.font("Helvetica-Bold").text(`${L("gapStatement")} : `, { continued: true });
      doc.font("Helvetica").text(gap.gapStatement);
      doc.font("Helvetica-Bold").text(`${L("criticalityJustification")} : `, { continued: true });
      doc.font("Helvetica").text(gap.criticalityJustification);
      doc.font("Helvetica-Bold").text(`${L("processAndSite")} : `, { continued: true });
      doc.font("Helvetica").text(`${val(gap.processName)} / ${val(gap.siteName)}`);
      doc.font("Helvetica-Bold").text(`${L("status")} : `, { continued: true });
      doc.font("Helvetica").text(gap.status);
      if (gap.mdsapGrade !== null) {
        doc.font("Helvetica-Bold").text(`${L("mdsapGrade")} : `, { continued: true });
        doc.font("Helvetica").text(`${gap.mdsapGrade}${gap.mdsapEscalation ? ` — ${gap.mdsapEscalation}` : ""}`);
      }
      doc.moveDown(0.6);
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).stroke(COLORS.lightGray);
      doc.moveDown(0.4);
    });
  }

  // ============================================================
  // SECTION 6 — PLAN D'ACTION / CAPA
  // ============================================================
  doc.addPage();
  h1(L("section6Title"));
  if (data.capaPlan.length === 0) {
    p(L("noActions"));
  } else {
    data.capaPlan.forEach((action) => {
      const estimatedHeight = 140;
      if (doc.y > doc.page.height - PAGE_MARGIN - estimatedHeight) {
        doc.addPage();
      }
      doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.accent).text(`${L("linkedGap")} : ${action.gapReference}`);
      doc.fillColor("black").fontSize(9);
      doc.font("Helvetica-Bold").text(`${L("containment")} : `, { continued: true });
      doc.font("Helvetica").text(val(action.containment));
      doc.font("Helvetica-Bold").text(`${L("rootCauseAnalysis")} : `, { continued: true });
      doc.font("Helvetica").text(val(action.rootCauseAnalysis));
      doc.font("Helvetica-Bold").text(`${L("rootCauseMethod")} : `, { continued: true });
      doc.font("Helvetica").text(val(action.rootCauseMethod));
      doc.font("Helvetica-Bold").text(`${L("correctiveAction")} : `, { continued: true });
      doc.font("Helvetica").text(val(action.correctiveAction));
      doc.font("Helvetica-Bold").text(`${L("responsible")} : `, { continued: true });
      doc.font("Helvetica").text(val(action.responsible));
      doc.font("Helvetica-Bold").text(`${L("dueDate")} : `, { continued: true });
      doc.font("Helvetica").text(val(fmtDate(action.dueDate)));
      doc.font("Helvetica-Bold").text(`${L("verificationCriteria")} : `, { continued: true });
      doc.font("Helvetica").text(val(action.verificationCriteria));
      doc.font("Helvetica-Bold").text(`${L("verificationDate")} : `, { continued: true });
      doc.font("Helvetica").text(val(fmtDate(action.verificationDate)));
      doc.font("Helvetica-Bold").text(`${L("status")} : `, { continued: true });
      doc.font("Helvetica").text(action.status);
      doc.moveDown(0.5);
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).stroke(COLORS.lightGray);
      doc.moveDown(0.4);
    });
  }

  // ============================================================
  // SECTION 7 — CONCLUSION
  // ============================================================
  doc.addPage();
  h1(L("section7Title"));
  h2(L("systemAptitude"));
  p(data.verdictPhrase);
  doc.moveDown(0.5);
  h2(L("recommendation"));
  p(data.conclusion);
  doc.moveDown(0.5);
  h2(L("nextSteps"));
  p(data.nextSteps ?? notProvided());

  // ============================================================
  // SECTION 8 — ANNEXES
  // ============================================================
  doc.addPage();
  h1(L("section8Title"));

  h2(L("annexQA"));
  if (data.fullQA.length === 0) {
    p(notProvided());
  } else {
    data.fullQA.forEach((qa) => {
      ensureSpace(40);
      doc.fontSize(8).font("Helvetica-Bold").text(val(qa.questionTitle));
      doc.font("Helvetica").text(`${L("answer")} : ${val(qa.responseValue)}${qa.comment ? ` — ${qa.comment}` : ""}`);
      doc.moveDown(0.2);
    });
  }

  doc.addPage();
  h2(L("annexEvidence"));
  if (data.evidenceIndex.length === 0) {
    p(notProvided());
  } else {
    data.evidenceIndex.forEach((e) => p(`• ${e.fileName} (${e.questionKey}, ${fmtDate(e.createdAt)})`));
  }

  doc.moveDown(0.5);
  h2(L("annexPeople"));
  if (data.auditeesRepresentatives.length === 0) {
    p(notProvided());
  } else {
    data.auditeesRepresentatives.forEach((rp) => p(`• ${rp.name}${rp.function ? ` — ${rp.function}` : ""}`));
  }

  doc.moveDown(0.5);
  h2(L("annexAgenda"));
  if (data.plannedAgenda.length === 0 && data.actualAgenda.length === 0) p(notProvided());
  else {
    data.plannedAgenda.forEach((item) => p(`Prévu - ${item.date}: ${item.activity}`));
    data.actualAgenda.forEach((item) => p(`Réalisé - ${item.date}: ${item.activity}`));
  }

  doc.moveDown(0.5);
  h2(L("annexGlossary"));
  p("SMQ / QMS, NC, CAPA, PRRC, MDR, IVDR, MDSAP, ISO, OFI");

  doc.moveDown(0.5);
  h2(L("annexVersions"));
  if (data.reportVersionHistory.length === 0) {
    p(notProvided());
  } else {
    data.reportVersionHistory.forEach((v) => p(`v${v.version} — ${fmtDate(v.date)}`));
  }

  // ============================================================
  // EN-TÊTE / PIED DE PAGE (D.3) — appliqué a posteriori sur toutes les pages
  // ============================================================
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 35;
    doc.fontSize(8).fillColor(COLORS.gray).font("Helvetica");
    doc.text(
      `${data.reportReference} — ${L("version")} ${data.reportVersion} — ${L("confidential")}`,
      PAGE_MARGIN,
      bottom,
      { width: doc.page.width - 2 * PAGE_MARGIN - 80, align: "left", lineBreak: false }
    );
    doc.text(`${L("page")} ${i + 1} ${L("of")} ${total}`, doc.page.width - PAGE_MARGIN - 100, bottom, {
      width: 100,
      align: "right",
      lineBreak: false,
    });
    doc.fillColor("black");
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });
}
