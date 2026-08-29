import test from "node:test";
import assert from "node:assert/strict";
import { assessReportCompleteness } from "./completeness";

function report(overrides: Record<string, unknown> = {}) {
  return {
    organisationName: "QARA Medtech",
    auditNature: "interne",
    startDate: "2026-08-28",
    endDate: "2026-08-29",
    auditTeam: [{ name: "Auditeur", role: "Lead" }],
    auditeesRepresentatives: [{ name: "Responsable qualité" }],
    processScope: ["SMQ"],
    scopeExclusions: "Aucune",
    plannedAgenda: [{ date: "2026-08-28", activity: "Ouverture" }],
    actualAgenda: [{ date: "2026-08-28", activity: "Ouverture" }],
    evidenceIndex: [{ fileName: "preuve.pdf" }],
    gapRegister: [],
    capaPlan: [],
    breakdown: { compliant: 2, partial: 1, nonCompliant: 0, notApplicable: 0 },
    fullQA: [{}, {}, {}],
    verdictPhrase: "Système apte sous réserve du suivi des observations.",
    ...overrides,
  } as any;
}

test("un audit sans réponse bloque la génération", () => {
  const result = assessReportCompleteness(report({
    breakdown: { compliant: 0, partial: 0, nonCompliant: 0, notApplicable: 0 },
  }));
  assert.equal(result.blocking.length, 1);
});

test("un audit complet est prêt et propose une conclusion éditable", () => {
  const result = assessReportCompleteness(report());
  assert.deepEqual(result.blocking, []);
  assert.deepEqual(result.missingCritical, []);
  assert.equal(result.completionPercent, 100);
  assert.match(result.defaultConclusion, /Système apte/);
});
