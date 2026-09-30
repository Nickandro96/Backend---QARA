import assert from "node:assert/strict";
import { test } from "node:test";
import { renderReportPdf } from "./pdfRenderer";
import type { ReportData } from "./reportData";

function minimalReport(): ReportData {
  return {
    language: "fr",
    generatedAt: "2026-09-30T12:00:00.000Z",
    auditId: 47,
    auditName: "Audit pagination",
    auditNature: "surveillance",
    referentialNames: ["MDR"],
    organisationName: "QA Corp",
    organisationAddress: null,
    organisationSiret: null,
    organisationSrn: null,
    organisationLogoUrl: null,
    siteName: "Siège",
    processScope: ["Vigilance"],
    startDate: "2026-09-30T00:00:00.000Z",
    endDate: "2026-09-30T00:00:00.000Z",
    auditTeam: [{ name: "Klauss Ngankep", role: "Auditeur" }],
    auditeesRepresentatives: [],
    reportReference: "RAP-47-2026",
    reportVersion: 1,
    reportStatus: "final",
    distributionList: null,
    conclusion: "Conclusion de contrôle.",
    nextSteps: "Suivre la CAPA.",
    plannedAgenda: [],
    actualAgenda: [],
    scopeExclusions: "Importation non applicable",
    economicRole: "fabricant",
    markets: ["Union européenne"],
    prrcName: null,
    prrcQualification: null,
    notifiedBodyName: null,
    notifiedBodyNumber: null,
    certificates: [],
    globalScore: 98,
    breakdown: { compliant: 9, partial: 0, nonCompliant: 1, notApplicable: 0 },
    gapsByGravite: { majeur: 1, mineur: 0, observation: 0 },
    verdictPhrase: "Prêt sous réserve de traiter l'écart.",
    previousAudit: null,
    processResults: [],
    gapRegister: [],
    capaPlan: [],
    fullQA: [],
    evidenceIndex: [],
    reportVersionHistory: [{ version: 1, status: "final", date: "2026-09-30T12:00:00.000Z" }],
  };
}

test("renderReportPdf n'ajoute aucune page blanche lors de la pagination", async () => {
  const pdf = await renderReportPdf(minimalReport());
  const pageObjects = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [];
  // Le document minimal comporte dix pages de contenu explicites. Avant le
  // correctif, les pieds de page ajoutaient vingt pages blanches (30 au total).
  assert.equal(pageObjects.length, 10);
});
