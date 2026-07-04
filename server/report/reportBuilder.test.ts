import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditReport, topPriorities } from "./reportBuilder";
import { DEFAULT_SCORING_CONFIG } from "../scoring/types";
import type { ScoringResult } from "../scoring/types";
import type { CapaAction } from "../capa/types";

function makeScoringResult(overrides: Partial<ScoringResult["global"]> = {}): ScoringResult {
  return {
    global: {
      score: 82,
      statut: "conforme_avec_reserves",
      ecartsCritiques: 0,
      ecarts: { majeurs: 1, mineurs: 2, observations: 1 },
      maturiteMoyenne: 3.2,
      questionsApplicables: 40,
      questionsNonApplicables: 2,
      questionsNonRepondues: 5,
      ...overrides,
    },
    parReferentiel: [
      { referentialCode: "MDR", score: 82, statut: "conforme_avec_reserves", ecartsCritiques: 0, ecarts: { majeurs: 1, mineurs: 2, observations: 1 }, maturiteMoyenne: 3.2, questionsApplicables: 40, questionsNonApplicables: 2, questionsNonRepondues: 5 },
    ],
    parProcessus: [
      { referentialCode: "MDR", processName: "SMQ", score: 60, statut: "non_conforme", ecartsCritiques: 0, ecarts: { majeurs: 1, mineurs: 0, observations: 0 }, maturiteMoyenne: 2, questionsApplicables: 5, questionsNonApplicables: 0, questionsNonRepondues: 0 },
      { referentialCode: "MDR", processName: "PMS", score: 95, statut: "conforme", ecartsCritiques: 0, ecarts: { majeurs: 0, mineurs: 0, observations: 0 }, maturiteMoyenne: 4.5, questionsApplicables: 5, questionsNonApplicables: 0, questionsNonRepondues: 0 },
    ],
    ecarts: [
      { questionKey: "Q-1", referentialCode: "MDR", processName: "SMQ", gravite: "majeur", criticality: "critical", responseValue: "non_compliant", elementaryScore: 0, typicalNc: [] },
    ],
    couvertureCroisee: [
      { questionKey: "Q-1", referentielSource: "MDR", exigenceSource: "x", referentielsCouverts: [{ referentiel: "ISO13485", reference: "8.5.2" }] },
    ],
  };
}

function makeCapaAction(overrides: Partial<CapaAction> = {}): CapaAction {
  return {
    id: 1,
    auditId: 10,
    questionKey: "Q-1",
    referentialCode: "MDR",
    processName: "SMQ",
    gravite: "majeur",
    criticality: "critical",
    ecartIdentifie: "constat",
    analyseCauseRacine: null,
    actionRecommandee: "action",
    actionRetenue: null,
    responsible: null,
    dueDate: null,
    statut: "ouverte",
    preuveRealisation: null,
    dateVerificationEfficacite: null,
    preuveEfficacite: null,
    resultatEfficacite: null,
    referentielsImpactes: [],
    priorite: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseMeta() {
  return {
    auditId: 10,
    organisationName: "Acme MedTech",
    siteName: "Site principal",
    economicRole: "fabricant",
    referentialCodes: ["MDR"],
    auditorName: null,
    auditorEmail: null,
    startDate: null,
    endDate: null,
    niveau: "detaille" as const,
  };
}

test("buildAuditReport : verdict conforme -> pret", () => {
  const report = buildAuditReport({
    meta: baseMeta(),
    scoringResult: makeScoringResult({ statut: "conforme", score: 95 }),
    capaActions: [],
    config: DEFAULT_SCORING_CONFIG,
  });
  assert.equal(report.syntheseExecutive.verdict, "pret");
});

test("buildAuditReport : verdict conforme_avec_reserves -> pret_avec_reserves", () => {
  const report = buildAuditReport({
    meta: baseMeta(),
    scoringResult: makeScoringResult({ statut: "conforme_avec_reserves" }),
    capaActions: [],
    config: DEFAULT_SCORING_CONFIG,
  });
  assert.equal(report.syntheseExecutive.verdict, "pret_avec_reserves");
});

test("buildAuditReport : verdict non_conforme -> pas_pret", () => {
  const report = buildAuditReport({
    meta: baseMeta(),
    scoringResult: makeScoringResult({ statut: "non_conforme" }),
    capaActions: [],
    config: DEFAULT_SCORING_CONFIG,
  });
  assert.equal(report.syntheseExecutive.verdict, "pas_pret");
});

test("buildAuditReport : assemble toutes les sections attendues (§2 SPEC-3)", () => {
  const report = buildAuditReport({
    meta: baseMeta(),
    scoringResult: makeScoringResult(),
    capaActions: [makeCapaAction()],
    config: DEFAULT_SCORING_CONFIG,
  });
  assert.equal(report.meta.organisationName, "Acme MedTech");
  assert.ok(report.meta.generatedAt);
  assert.equal(report.syntheseExecutive.scoreGlobal, 82);
  assert.equal(report.radarParProcessus.length, 2);
  assert.equal(report.resultatsParReferentiel.length, 1);
  assert.equal(report.registreEcarts.length, 1);
  assert.equal(report.planAction.length, 1);
  assert.equal(report.couvertureCroisee.length, 1);
  assert.equal(report.annexes.seuilConforme, DEFAULT_SCORING_CONFIG.seuilConforme);
  assert.match(report.mentionLegale, /auto-évaluation préparatoire/);
});

test("topPriorities : exclut les actions déjà clôturées", () => {
  const actions = [
    makeCapaAction({ id: 1, statut: "cloturee_efficace" }),
    makeCapaAction({ id: 2, statut: "cloturee_sans_suite" }),
    makeCapaAction({ id: 3, statut: "ouverte" }),
  ];
  const result = topPriorities(actions);
  assert.deepEqual(result.map((a) => a.id), [3]);
});

test("topPriorities : trie par priorité et limite à N", () => {
  const actions = [
    makeCapaAction({ id: 1, gravite: "observation", criticality: "low" }),
    makeCapaAction({ id: 2, gravite: "majeur", criticality: "critical" }),
    makeCapaAction({ id: 3, gravite: "mineur", criticality: "high" }),
  ];
  const result = topPriorities(actions, 2);
  assert.deepEqual(result.map((a) => a.id), [2, 3]);
});
