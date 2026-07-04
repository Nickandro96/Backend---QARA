import test from "node:test";
import assert from "node:assert/strict";
import { buildScoringResult, detectGap, elementaryScore } from "./scoringEngine";
import type { ScoringQuestion, ScoringResponse } from "./types";

function q(overrides: Partial<ScoringQuestion> & Pick<ScoringQuestion, "questionKey">): ScoringQuestion {
  return {
    referentialCode: "MDR",
    processName: "QMS",
    criticality: "medium",
    questionType: "yes_no_partial_na",
    typicalNc: [],
    mappings: [],
    ...overrides,
  };
}

test("elementaryScore: yes_no_partial_na — compliant/partial/non_compliant/not_applicable", () => {
  const question = q({ questionKey: "k1" });
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "compliant" }), 1);
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "partial" }), 0.5);
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "non_compliant" }), 0);
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "not_applicable" }), null);
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "in_progress" }), null);
  assert.equal(elementaryScore(question, undefined), null);
});

test("elementaryScore: maturity_0_5 — level/5, N/A excluded", () => {
  const question = q({ questionKey: "k1", questionType: "maturity_0_5" });
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "compliant", maturityLevel: 0 }), 0);
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "compliant", maturityLevel: 3 }), 0.6);
  assert.equal(elementaryScore(question, { questionKey: "k1", responseValue: "compliant", maturityLevel: 5 }), 1);
  assert.equal(
    elementaryScore(question, { questionKey: "k1", responseValue: "not_applicable", maturityLevel: 5 }),
    null
  );
});

test("N/A ne pénalise ni ne gonfle le score (exclue du dénominateur)", () => {
  const questions = [
    q({ questionKey: "k1", criticality: "high" }),
    q({ questionKey: "k2", criticality: "high" }),
  ];
  const withNA: ScoringResponse[] = [
    { questionKey: "k1", responseValue: "compliant" },
    { questionKey: "k2", responseValue: "not_applicable" },
  ];
  const withoutK2: ScoringResponse[] = [{ questionKey: "k1", responseValue: "compliant" }];

  const r1 = buildScoringResult(questions, withNA);
  const r2 = buildScoringResult([questions[0]], withoutK2);
  assert.equal(r1.global.score, 100);
  assert.equal(r1.global.score, r2.global.score);
  assert.equal(r1.global.questionsNonApplicables, 1);
});

test("pondération par criticité : un Non critique pèse plus qu'un Non faible", () => {
  const questions = [
    q({ questionKey: "crit", criticality: "critical" }),
    q({ questionKey: "faible", criticality: "low" }),
  ];
  // Cas A : le "Non" tombe sur la question critique.
  const responsesA: ScoringResponse[] = [
    { questionKey: "crit", responseValue: "non_compliant" },
    { questionKey: "faible", responseValue: "compliant" },
  ];
  // Cas B : le "Non" tombe sur la question faible.
  const responsesB: ScoringResponse[] = [
    { questionKey: "crit", responseValue: "compliant" },
    { questionKey: "faible", responseValue: "non_compliant" },
  ];
  const resultA = buildScoringResult(questions, responsesA);
  const resultB = buildScoringResult(questions, responsesB);
  assert.ok(resultA.global.score < resultB.global.score);
  // Poids 4 vs 1 sur un total de 5 : cas A = (0*4 + 1*1)/5 = 20%, cas B = (1*4 + 0*1)/5 = 80%.
  assert.equal(resultA.global.score, 20);
  assert.equal(resultB.global.score, 80);
});

test("règle de blocage : un Non critique force Non conforme même si le score global est élevé", () => {
  const questions = [
    q({ questionKey: "crit", criticality: "critical" }),
    ...Array.from({ length: 20 }, (_, i) => q({ questionKey: `ok${i}`, criticality: "low" })),
  ];
  const responses: ScoringResponse[] = [
    { questionKey: "crit", responseValue: "non_compliant" },
    ...Array.from({ length: 20 }, (_, i) => ({ questionKey: `ok${i}`, responseValue: "compliant" as const })),
  ];
  const result = buildScoringResult(questions, responses);
  // Score numérique élevé (un seul poids 4 sur 24 au dénominateur) mais statut bloqué.
  assert.ok(result.global.score > 75);
  assert.equal(result.global.statut, "non_conforme");
  assert.equal(result.global.ecartsCritiques, 1);
});

test("statuts : conforme (>=90, 0 écart critique) / conforme avec réserves (75-89) / non conforme (<75)", () => {
  const one = (crit: ScoringQuestion["criticality"], val: ScoringResponse["responseValue"]) =>
    buildScoringResult([q({ questionKey: "k", criticality: crit })], [{ questionKey: "k", responseValue: val }]);

  assert.equal(one("low", "compliant").global.statut, "conforme");
  assert.equal(one("low", "partial").global.statut, "non_conforme"); // 50% < 75
});

test("gradation des écarts : majeur/mineur/observation", () => {
  const highNon = detectGap(
    q({ questionKey: "k", criticality: "high" }),
    { questionKey: "k", responseValue: "non_compliant" }
  );
  assert.equal(highNon?.gravite, "majeur");

  const lowNon = detectGap(
    q({ questionKey: "k", criticality: "low" }),
    { questionKey: "k", responseValue: "non_compliant" }
  );
  assert.equal(lowNon?.gravite, "mineur");

  const highPartial = detectGap(
    q({ questionKey: "k", criticality: "high" }),
    { questionKey: "k", responseValue: "partial" }
  );
  assert.equal(highPartial?.gravite, "mineur");

  const lowPartial = detectGap(
    q({ questionKey: "k", criticality: "low" }),
    { questionKey: "k", responseValue: "partial" }
  );
  assert.equal(lowPartial?.gravite, "observation");

  const compliant = detectGap(
    q({ questionKey: "k", criticality: "critical" }),
    { questionKey: "k", responseValue: "compliant" }
  );
  assert.equal(compliant, null);
});

test("calcul pur et déterministe : mêmes entrées -> mêmes sorties", () => {
  const questions = [q({ questionKey: "k1", criticality: "high" }), q({ questionKey: "k2", criticality: "low" })];
  const responses: ScoringResponse[] = [
    { questionKey: "k1", responseValue: "partial" },
    { questionKey: "k2", responseValue: "compliant" },
  ];
  const r1 = buildScoringResult(questions, responses);
  const r2 = buildScoringResult(questions, responses);
  assert.deepEqual(r1, r2);
});

test("regroupement par référentiel et par processus", () => {
  const questions = [
    q({ questionKey: "a", referentialCode: "MDR", processName: "QMS" }),
    q({ questionKey: "b", referentialCode: "MDR", processName: "Design" }),
    q({ questionKey: "c", referentialCode: "ISO13485", processName: "QMS" }),
  ];
  const responses: ScoringResponse[] = [
    { questionKey: "a", responseValue: "compliant" },
    { questionKey: "b", responseValue: "compliant" },
    { questionKey: "c", responseValue: "compliant" },
  ];
  const result = buildScoringResult(questions, responses);
  assert.equal(result.parReferentiel.length, 2);
  assert.equal(result.parProcessus.length, 3); // MDR::QMS, MDR::Design, ISO13485::QMS distincts
});

test("couverture croisée : restitue les mappings du corpus au-delà de l'exigence primaire", () => {
  const withMapping = q({
    questionKey: "a",
    mappings: [
      { referentiel: "MDR", correspondance: "exigence primaire", libelle_exigence: "Exigence A" },
      { referentiel: "ISO 13485", correspondance: "équivalent UE", libelle_exigence: "Exigence A bis" },
    ],
  });
  const withoutMapping = q({
    questionKey: "b",
    mappings: [{ referentiel: "MDR", correspondance: "exigence primaire", libelle_exigence: "Exigence B" }],
  });
  const result = buildScoringResult(
    [withMapping, withoutMapping],
    [
      { questionKey: "a", responseValue: "compliant" },
      { questionKey: "b", responseValue: "compliant" },
    ]
  );
  assert.equal(result.couvertureCroisee.length, 1);
  assert.equal(result.couvertureCroisee[0].questionKey, "a");
  assert.equal(result.couvertureCroisee[0].referentielsCouverts.length, 1);
  assert.equal(result.couvertureCroisee[0].referentielsCouverts[0].referentiel, "ISO 13485");
});

test("questions non répondues sont exclues du calcul (audit en cours)", () => {
  const questions = [q({ questionKey: "a" }), q({ questionKey: "b" })];
  const result = buildScoringResult(questions, [{ questionKey: "a", responseValue: "compliant" }]);
  assert.equal(result.global.questionsNonRepondues, 1);
  assert.equal(result.global.score, 100);
});
