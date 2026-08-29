/**
 * Rendu Word (.docx) du rapport d'audit (Tâche D.5) — même structure que le
 * PDF, éditable, styles natifs (titres hiérarchisés, table des matières
 * automatique, en-têtes/pieds de page). Consomme exclusivement l'objet
 * ReportData (mêmes chiffres que le PDF/Excel).
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  PageNumber,
  TableOfContents,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from "docx";
import { t, translateAuditNature } from "./i18n";
import type { ReportData } from "./reportData";

const QARA_NAVY = "0E1C3D";
const QARA_ACCENT = "3B6FE0";
const GRAVITE_COLOR: Record<string, string> = { majeur: "DC2626", mineur: "EAB308", observation: "3B6FE0" };

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: QARA_NAVY, fill: QARA_NAVY },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })] })],
  });
}
function bodyCell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })] });
}

export async function renderReportWord(data: ReportData): Promise<Buffer> {
  const lang = data.language;
  const L = (key: Parameters<typeof t>[0]) => t(key, lang);
  const notProvided = () => L("notProvided");
  const val = (v: string | null | undefined) => (v ? v : notProvided());

  const heading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) =>
    new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, color: QARA_NAVY, bold: true })] });

  const sub = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 }, children: [new TextRun({ text, color: QARA_ACCENT })] });

  const body = (text: string) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text })] });

  const labelValue = (label: string, value: string) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `${label} : `, bold: true }), new TextRun({ text: value })],
    });

  const children: Array<Paragraph | TableOfContents> = [];

  // ---- Page de garde ----
  children.push(
    new Paragraph({ children: [new TextRun({ text: "QARA", bold: true, color: QARA_NAVY })] }),
    new Paragraph({ text: "" }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: L("reportTitle"), bold: true, size: 48, color: QARA_NAVY })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.auditName, size: 32 })] }),
    new Paragraph({ text: "" }),
    labelValue(L("auditType"), val(translateAuditNature(data.auditNature, lang))),
    labelValue(L("organisationAudited"), val(data.organisationName)),
    labelValue(L("referentialsAudited"), data.referentialNames.join(", ") || notProvided()),
    labelValue(L("scope"), data.processScope.join(", ") || notProvided()),
    labelValue(L("auditDates"), `${fmtDate(data.startDate) || notProvided()} → ${fmtDate(data.endDate) || notProvided()}`),
    labelValue(L("reference"), data.reportReference),
    labelValue(L("version"), String(data.reportVersion)),
    labelValue(L("status"), data.reportStatus === "draft" ? L("statusDraft") : L("statusFinal")),
    labelValue(L("emissionDate"), fmtDate(data.generatedAt)),
    new Paragraph({ text: "" }),
    sub(L("auditTeam")),
    ...(data.auditTeam.length > 0
      ? data.auditTeam.map((m) => body(`• ${m.name}${m.role ? ` (${m.role})` : ""}`))
      : [body(notProvided())]),
    sub(L("auditeeRepresentatives")),
    ...(data.auditeesRepresentatives.length > 0
      ? data.auditeesRepresentatives.map((rp) => body(`• ${rp.name}${rp.function ? ` — ${rp.function}` : ""}`))
      : [body(notProvided())]),
    new Paragraph({
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: L("confidential"), italics: true, color: "6B7280" })],
    })
  );

  children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }));
  children.push(new TableOfContents(L("tableOfContents"), { hyperlink: true, headingStyleRange: "1-2" }));

  // ---- Section 1 ----
  children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }));
  children.push(heading(L("section1Title")));
  children.push(sub(L("objectives")), body(L("objectivesText")));
  children.push(sub(L("methodology")), body(L("methodologyText")));
  children.push(sub(L("criteria")), body(data.referentialNames.join(", ") || notProvided()));
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [new TextRun({ text: L("samplingDisclaimer"), italics: true, color: QARA_NAVY })],
    })
  );
  children.push(new Paragraph({ children: [new TextRun({ text: L("confidentialityClause"), size: 16, color: "6B7280" })] }));
  children.push(sub(L("scopeExclusions")), body(val(data.scopeExclusions)));

  // ---- Section 2 ----
  children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }));
  children.push(heading(L("section2Title")));
  children.push(labelValue(L("economicRole"), val(data.economicRole)));
  children.push(labelValue(L("targetMarkets"), data.markets.join(", ") || notProvided()));
  children.push(
    labelValue(L("prrc"), data.prrcName ? `${data.prrcName}${data.prrcQualification ? ` (${data.prrcQualification})` : ""}` : notProvided())
  );
  children.push(
    labelValue(
      L("notifiedBody"),
      data.notifiedBodyName ? `${data.notifiedBodyName}${data.notifiedBodyNumber ? ` (n°${data.notifiedBodyNumber})` : ""}` : notProvided()
    )
  );
  children.push(sub(L("certificates")));
  if (data.certificates.length > 0) {
    data.certificates.forEach((c) =>
      children.push(body(`• ${val(c.referentialCode)} — ${val(c.certificateNumber)} (${fmtDate(c.issueDate) || notProvided()} → ${fmtDate(c.expiryDate) || notProvided()})`))
    );
  } else {
    children.push(body(notProvided()));
  }

  // ---- Section 3 ----
  children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }));
  children.push(heading(L("section3Title")));
  children.push(labelValue(L("globalScore"), `${data.globalScore.toFixed(1)}%`));
  children.push(sub(L("scoringMethod")), body(L("scoringMethodText")));
  children.push(
    sub(L("breakdown")),
    body(
      `${L("compliant")} : ${data.breakdown.compliant} | ${L("partial")} : ${data.breakdown.partial} | ${L("nonCompliant")} : ${data.breakdown.nonCompliant} | ${L("notApplicable")} : ${data.breakdown.notApplicable}`
    )
  );
  children.push(
    sub(L("gapsByCriticality")),
    body(`${L("criticalityMajor")} : ${data.gapsByGravite.majeur} | ${L("criticalityMinor")} : ${data.gapsByGravite.mineur} | ${L("criticalityObservation")} : ${data.gapsByGravite.observation}`)
  );
  children.push(sub(L("verdict")), body(data.verdictPhrase));
  children.push(sub(L("previousAuditComparison")));
  children.push(
    body(
      data.previousAudit
        ? `${data.previousAudit.auditName} (${fmtDate(data.previousAudit.date) || notProvided()}) : ${data.previousAudit.score.toFixed(1)}% → ${data.globalScore.toFixed(1)}%`
        : L("noPreviousAudit")
    )
  );

  // ---- Section 4 (table) ----
  children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }));
  children.push(heading(L("section4Title")));

  const tables: (Table | Paragraph)[] = [];
  if (data.processResults.length === 0) {
    tables.push(body(notProvided()));
  } else {
    tables.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              headerCell(L("process")),
              headerCell(L("questionsCount")),
              headerCell(L("score")),
              headerCell(L("criticalityMajor")),
              headerCell(L("criticalityMinor")),
              headerCell(L("criticalityObservation")),
            ],
          }),
          ...data.processResults.map(
            (row) =>
              new TableRow({
                children: [
                  bodyCell(row.processName),
                  bodyCell(String(row.questionsApplicables)),
                  bodyCell(`${row.score.toFixed(0)}%`),
                  bodyCell(String(row.ecartsMajeurs)),
                  bodyCell(String(row.ecartsMineurs)),
                  bodyCell(String(row.ecartsObservations)),
                ],
              })
          ),
        ],
      })
    );
  }

  // ---- Section 5 — registre des écarts (fiche en 3 temps) ----
  const section5: Paragraph[] = [new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }), heading(L("section5Title"))];
  if (data.gapRegister.length === 0) {
    section5.push(new Paragraph({ children: [new TextRun({ text: `✓ ${L("noGaps")}`, color: "16A34A" })] }));
  } else {
    data.gapRegister.forEach((gap) => {
      section5.push(
        new Paragraph({
          spacing: { before: 200 },
          keepLines: true,
          keepNext: true,
          children: [
            new TextRun({
              text: `${gap.reference} — ${
                gap.gravite === "majeur" ? L("criticalityMajor") : gap.gravite === "mineur" ? L("criticalityMinor") : L("criticalityObservation")
              }`,
              bold: true,
              color: GRAVITE_COLOR[gap.gravite],
            }),
          ],
        }),
        labelValue(L("requirement"), `${gap.requirementRef ?? notProvided()} — ${gap.requirementTitle ?? notProvided()}`),
        labelValue(L("objectiveEvidence"), gap.objectiveEvidence ?? notProvided()),
        labelValue(L("gapStatement"), gap.gapStatement),
        labelValue(L("criticalityJustification"), gap.criticalityJustification),
        labelValue(L("processAndSite"), `${gap.processName ?? notProvided()} / ${gap.siteName ?? notProvided()}`),
        labelValue(L("status"), gap.status)
      );
      if (gap.mdsapGrade !== null) {
        section5.push(labelValue(L("mdsapGrade"), `${gap.mdsapGrade}${gap.mdsapEscalation ? ` — ${gap.mdsapEscalation}` : ""}`));
      }
    });
  }

  // ---- Section 6 — CAPA ----
  const section6: Paragraph[] = [new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }), heading(L("section6Title"))];
  if (data.capaPlan.length === 0) {
    section6.push(body(L("noActions")));
  } else {
    data.capaPlan.forEach((action) => {
      section6.push(
        new Paragraph({ spacing: { before: 200 }, keepLines: true, keepNext: true, children: [new TextRun({ text: `${L("linkedGap")} : ${action.gapReference}`, bold: true, color: QARA_ACCENT })] }),
        labelValue(L("containment"), val(action.containment)),
        labelValue(L("rootCauseAnalysis"), val(action.rootCauseAnalysis)),
        labelValue(L("rootCauseMethod"), val(action.rootCauseMethod)),
        labelValue(L("correctiveAction"), val(action.correctiveAction)),
        labelValue(L("responsible"), val(action.responsible)),
        labelValue(L("dueDate"), fmtDate(action.dueDate) || notProvided()),
        labelValue(L("verificationCriteria"), val(action.verificationCriteria)),
        labelValue(L("verificationDate"), fmtDate(action.verificationDate) || notProvided()),
        labelValue(L("status"), action.status)
      );
    });
  }

  // ---- Section 7 ----
  const section7 = [
    new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }),
    heading(L("section7Title")),
    sub(L("systemAptitude")),
    body(data.verdictPhrase),
    sub(L("recommendation")),
    body(data.conclusion),
    sub(L("nextSteps")),
    body(data.nextSteps ?? notProvided()),
  ];

  // ---- Section 8 — annexes ----
  const section8: Paragraph[] = [new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }), heading(L("section8Title"))];
  section8.push(sub(L("annexQA")));
  if (data.fullQA.length === 0) section8.push(body(notProvided()));
  else data.fullQA.forEach((qa) => section8.push(body(`${val(qa.questionTitle)} — ${L("answer")} : ${val(qa.responseValue)}${qa.comment ? ` (${qa.comment})` : ""}`)));

  section8.push(sub(L("annexEvidence")));
  if (data.evidenceIndex.length === 0) section8.push(body(notProvided()));
  else data.evidenceIndex.forEach((e) => section8.push(body(`• ${e.fileName} (${e.questionKey}, ${fmtDate(e.createdAt)})`)));

  section8.push(sub(L("annexPeople")));
  if (data.auditeesRepresentatives.length === 0) section8.push(body(notProvided()));
  else data.auditeesRepresentatives.forEach((rp) => section8.push(body(`• ${rp.name}${rp.function ? ` — ${rp.function}` : ""}`)));

  section8.push(sub(L("annexAgenda")));
  if (data.plannedAgenda.length === 0 && data.actualAgenda.length === 0) section8.push(body(notProvided()));
  else {
    data.plannedAgenda.forEach((item) => section8.push(body(`Prévu - ${item.date}: ${item.activity}`)));
    data.actualAgenda.forEach((item) => section8.push(body(`Réalisé - ${item.date}: ${item.activity}`)));
  }
  section8.push(sub(L("annexGlossary")), body("SMQ / QMS, NC, CAPA, PRRC, MDR, IVDR, MDSAP, ISO, OFI"));
  section8.push(sub(L("annexVersions")));
  if (data.reportVersionHistory.length === 0) section8.push(body(notProvided()));
  else data.reportVersionHistory.forEach((v) => section8.push(body(`v${v.version} — ${fmtDate(v.date)}`)));

  const doc = new Document({
    creator: "QARA",
    title: `${L("reportTitle")} — ${data.auditName}`,
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${data.reportReference} — ${L("version")} ${data.reportVersion}`, size: 16, color: "6B7280" })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${L("confidential")} — ${L("page")} `, size: 16, color: "6B7280" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "6B7280" }),
                  new TextRun({ text: ` ${L("of")} `, size: 16, color: "6B7280" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "6B7280" }),
                ],
              }),
            ],
          }),
        },
        children: [...children, ...tables, ...section5, ...section6, ...section7, ...section8],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
