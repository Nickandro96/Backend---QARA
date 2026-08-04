/**
 * Rendu Excel du rapport d'audit (Tâche D.5) — outil de travail : onglets
 * Synthèse / Détail Q-R / Registre écarts / Plan CAPA / Index des preuves.
 * En-têtes figés, filtres automatiques, mise en forme conditionnelle sur la
 * criticité. Consomme exclusivement l'objet ReportData (mêmes chiffres que
 * le PDF/Word).
 */
import ExcelJS from "exceljs";
import { t, translateAuditNature } from "./i18n";
import type { ReportData } from "./reportData";

const QARA_NAVY = "FF0E1C3D";
const GRAVITE_FILL: Record<string, string> = {
  majeur: "FFDC2626",
  mineur: "FFEAB308",
  observation: "FF3B6FE0",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: QARA_NAVY } };
    cell.alignment = { vertical: "middle" };
  });
  row.commit();
}

export async function renderReportExcel(data: ReportData): Promise<Buffer> {
  const lang = data.language;
  const L = (key: Parameters<typeof t>[0]) => t(key, lang);
  const notProvided = () => L("notProvided");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QARA";
  workbook.created = new Date();

  // ---------------- Onglet Synthèse ----------------
  const summary = workbook.addWorksheet(L("tabSummary"));
  summary.columns = [{ width: 40 }, { width: 40 }];
  summary.addRow([L("reportTitle"), data.auditName]);
  summary.addRow([L("reference"), data.reportReference]);
  summary.addRow([L("version"), data.reportVersion]);
  summary.addRow([L("emissionDate"), fmtDate(data.generatedAt)]);
  summary.addRow([L("auditType"), translateAuditNature(data.auditNature, lang) ?? notProvided()]);
  summary.addRow([L("organisationAudited"), data.organisationName ?? notProvided()]);
  summary.addRow([L("referentialsAudited"), data.referentialNames.join(", ")]);
  summary.addRow([L("auditDates"), `${fmtDate(data.startDate)} - ${fmtDate(data.endDate)}`]);
  summary.addRow([]);
  summary.addRow([L("globalScore"), `${data.globalScore.toFixed(1)}%`]);
  summary.addRow([L("compliant"), data.breakdown.compliant]);
  summary.addRow([L("partial"), data.breakdown.partial]);
  summary.addRow([L("nonCompliant"), data.breakdown.nonCompliant]);
  summary.addRow([L("notApplicable"), data.breakdown.notApplicable]);
  summary.addRow([]);
  summary.addRow([L("criticalityMajor"), data.gapsByGravite.majeur]);
  summary.addRow([L("criticalityMinor"), data.gapsByGravite.mineur]);
  summary.addRow([L("criticalityObservation"), data.gapsByGravite.observation]);
  summary.addRow([]);
  summary.addRow([L("verdict"), data.verdictPhrase]);
  summary.getColumn(1).font = { bold: true };

  // ---------------- Onglet Détail Q-R ----------------
  const qaSheet = workbook.addWorksheet(L("tabQA"));
  qaSheet.columns = [
    { header: L("process"), key: "process", width: 25 },
    { header: L("requirement"), key: "ref", width: 20 },
    { header: L("question"), key: "question", width: 60 },
    { header: L("answer"), key: "answer", width: 18 },
    { header: L("comment"), key: "comment", width: 40 },
  ];
  styleHeaderRow(qaSheet.getRow(1));
  data.fullQA.forEach((qa) => {
    qaSheet.addRow({
      process: qa.processName ?? notProvided(),
      ref: qa.requirementRef ?? notProvided(),
      question: qa.questionTitle ?? notProvided(),
      answer: qa.responseValue ?? notProvided(),
      comment: qa.comment ?? "",
    });
  });
  qaSheet.views = [{ state: "frozen", ySplit: 1 }];
  qaSheet.autoFilter = { from: "A1", to: `E${data.fullQA.length + 1}` };

  // ---------------- Onglet Registre écarts ----------------
  const gapSheet = workbook.addWorksheet(L("tabGapRegister"));
  gapSheet.columns = [
    { header: L("gapReference"), key: "ref", width: 16 },
    { header: L("criticality"), key: "gravite", width: 14 },
    { header: L("requirement"), key: "req", width: 22 },
    { header: L("objectiveEvidence"), key: "evidence", width: 45 },
    { header: L("gapStatement"), key: "gap", width: 60 },
    { header: L("criticalityJustification"), key: "justification", width: 50 },
    { header: L("processAndSite"), key: "process", width: 30 },
    { header: L("status"), key: "status", width: 22 },
  ];
  styleHeaderRow(gapSheet.getRow(1));
  data.gapRegister.forEach((gap) => {
    const row = gapSheet.addRow({
      ref: gap.reference,
      gravite:
        gap.gravite === "majeur" ? L("criticalityMajor") : gap.gravite === "mineur" ? L("criticalityMinor") : L("criticalityObservation"),
      req: `${gap.requirementRef ?? ""} ${gap.requirementTitle ?? ""}`.trim() || notProvided(),
      evidence: gap.objectiveEvidence ?? notProvided(),
      gap: gap.gapStatement,
      justification: gap.criticalityJustification || notProvided(),
      process: `${gap.processName ?? notProvided()} / ${gap.siteName ?? notProvided()}`,
      status: gap.status,
    });
    const fill = GRAVITE_FILL[gap.gravite];
    if (fill) {
      row.getCell("gravite").fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      row.getCell("gravite").font = { color: { argb: "FFFFFFFF" }, bold: true };
    }
  });
  gapSheet.views = [{ state: "frozen", ySplit: 1 }];
  if (data.gapRegister.length > 0) gapSheet.autoFilter = { from: "A1", to: `H${data.gapRegister.length + 1}` };

  // ---------------- Onglet Plan CAPA ----------------
  const capaSheet = workbook.addWorksheet(L("tabCapaPlan"));
  capaSheet.columns = [
    { header: L("linkedGap"), key: "ref", width: 16 },
    { header: L("rootCauseAnalysis"), key: "cause", width: 40 },
    { header: L("rootCauseMethod"), key: "method", width: 18 },
    { header: L("correctiveAction"), key: "action", width: 40 },
    { header: L("responsible"), key: "resp", width: 20 },
    { header: L("dueDate"), key: "due", width: 14 },
    { header: L("verificationDate"), key: "verifDate", width: 16 },
    { header: L("status"), key: "status", width: 22 },
  ];
  styleHeaderRow(capaSheet.getRow(1));
  data.capaPlan.forEach((action) => {
    capaSheet.addRow({
      ref: action.gapReference,
      cause: action.rootCauseAnalysis ?? notProvided(),
      method: action.rootCauseMethod ?? notProvided(),
      action: action.correctiveAction ?? notProvided(),
      resp: action.responsible ?? notProvided(),
      due: fmtDate(action.dueDate) || notProvided(),
      verifDate: fmtDate(action.verificationDate) || notProvided(),
      status: action.status,
    });
  });
  capaSheet.views = [{ state: "frozen", ySplit: 1 }];
  if (data.capaPlan.length > 0) capaSheet.autoFilter = { from: "A1", to: `H${data.capaPlan.length + 1}` };

  // ---------------- Onglet Index des preuves ----------------
  const evidenceSheet = workbook.addWorksheet(L("tabEvidenceIndex"));
  evidenceSheet.columns = [
    { header: L("evidenceDocument"), key: "file", width: 50 },
    { header: L("requirement"), key: "key", width: 25 },
    { header: L("evidenceDate"), key: "date", width: 16 },
  ];
  styleHeaderRow(evidenceSheet.getRow(1));
  data.evidenceIndex.forEach((e) => {
    evidenceSheet.addRow({ file: e.fileName, key: e.questionKey, date: fmtDate(e.createdAt) });
  });
  evidenceSheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
