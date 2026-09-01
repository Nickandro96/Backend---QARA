import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildActionDraft,
  priorityScore,
  isValidStatusTransition,
  validateTransitionFields,
  sortByPriority,
  classifyNonConformityResponse,
} from "./capaEngine";

test("classifyNonConformityResponse exclut explicitement les réponses non applicables", () => {
  assert.equal(classifyNonConformityResponse("non_compliant"), "non_conforme");
  assert.equal(classifyNonConformityResponse("partial"), "partiel");
  assert.equal(classifyNonConformityResponse("non_applicable"), null);
  assert.equal(classifyNonConformityResponse("compliant"), null);
});
import type { Ecart } from "../scoring/types";

function makeEcart(overrides: Partial<Ecart> = {}): Ecart {
  return {
    questionKey: "Q-1",
    referentialCode: "MDR",
    processName: "SMQ",
    gravite: "majeur",
    criticality: "critical",
    responseValue: "non_compliant",
    elementaryScore: 0,
    typicalNc: [],
    ...overrides,
  };
}

test("buildActionDraft dérive action_recommandee de auditVerifies + expectedEvidence", () => {
  const draft = buildActionDraft(makeEcart(), {
    auditVerifies: "Que la procédure X est appliquée",
    expectedEvidence: "enregistrement daté et approuvé",
  });
  assert.match(draft.actionRecommandee, /Que la procédure X est appliquée/);
  assert.match(draft.actionRecommandee, /enregistrement daté et approuvé/);
});

test("buildActionDraft retombe sur un libellé générique si le corpus n'a rien", () => {
  const draft = buildActionDraft(makeEcart(), { auditVerifies: null, expectedEvidence: "" });
  assert.match(draft.actionRecommandee, /aucun libellé d'action pré-rempli/);
});

test("buildActionDraft inclut les NC typiques dans le constat quand présentes", () => {
  const draft = buildActionDraft(
    makeEcart({ typicalNc: ["Mineure : dossier incomplet"] }),
    { auditVerifies: "x" }
  );
  assert.match(draft.ecartIdentifie, /Mineure : dossier incomplet/);
});

test("priorityScore : écart majeur/critical > mineur/critical > majeur/low", () => {
  const majeurCritical = priorityScore("majeur", "critical");
  const mineurCritical = priorityScore("mineur", "critical");
  const majeurLow = priorityScore("majeur", "low");
  assert.ok(majeurCritical > mineurCritical);
  assert.ok(majeurCritical > majeurLow);
});

test("sortByPriority trie les écarts critiques/majeurs en premier", () => {
  const items = [
    { id: "obs-low", gravite: "observation" as const, criticality: "low" as const },
    { id: "majeur-critical", gravite: "majeur" as const, criticality: "critical" as const },
    { id: "mineur-high", gravite: "mineur" as const, criticality: "high" as const },
  ];
  const sorted = sortByPriority(items);
  assert.deepEqual(
    sorted.map((i) => i.id),
    ["majeur-critical", "mineur-high", "obs-low"]
  );
});

test("isValidStatusTransition : cycle de vie nominal autorisé", () => {
  assert.equal(isValidStatusTransition("ouverte", "en_cours"), true);
  assert.equal(isValidStatusTransition("en_cours", "a_verifier"), true);
  assert.equal(isValidStatusTransition("a_verifier", "cloturee_efficace"), true);
  assert.equal(isValidStatusTransition("a_verifier", "cloturee_inefficace"), true);
  assert.equal(isValidStatusTransition("cloturee_inefficace", "en_cours"), true);
});

test("isValidStatusTransition : une action ne peut pas sauter en_cours -> clôture", () => {
  assert.equal(isValidStatusTransition("en_cours", "cloturee_efficace"), false);
  assert.equal(isValidStatusTransition("en_cours", "cloturee_inefficace"), false);
});

test("isValidStatusTransition : impossible de sauter directement de ouverte à a_verifier ou clôture", () => {
  assert.equal(isValidStatusTransition("ouverte", "a_verifier"), false);
  assert.equal(isValidStatusTransition("ouverte", "cloturee_efficace"), false);
});

test("isValidStatusTransition : les clôtures définitives n'ont aucune transition sortante", () => {
  assert.equal(isValidStatusTransition("cloturee_efficace", "en_cours"), false);
  assert.equal(isValidStatusTransition("cloturee_sans_suite", "en_cours"), false);
});

test("isValidStatusTransition : rejette une transition vers le même statut", () => {
  assert.equal(isValidStatusTransition("en_cours", "en_cours"), false);
});

test("validateTransitionFields : analyse de cause racine obligatoire pour gravité majeure passant en cours", () => {
  const err = validateTransitionFields("en_cours", { gravite: "majeur", analyseCauseRacine: "" });
  assert.match(err ?? "", /analyse de cause racine/i);
  const ok = validateTransitionFields("en_cours", {
    gravite: "majeur",
    analyseCauseRacine: "5 pourquoi effectués",
  });
  assert.equal(ok, null);
});

test("validateTransitionFields : pas d'exigence de cause racine pour mineur/observation", () => {
  const ok = validateTransitionFields("en_cours", { gravite: "mineur" });
  assert.equal(ok, null);
});

test("validateTransitionFields : preuve de réalisation requise avant vérification d'efficacité", () => {
  const err = validateTransitionFields("a_verifier", { gravite: "mineur", preuveRealisation: "" });
  assert.match(err ?? "", /preuve de réalisation/i);
  const ok = validateTransitionFields("a_verifier", {
    gravite: "mineur",
    preuveRealisation: "Document XYZ",
  });
  assert.equal(ok, null);
});

test("validateTransitionFields : clôture exige preuve + résultat d'efficacité cohérent", () => {
  assert.match(
    validateTransitionFields("cloturee_efficace", { gravite: "mineur" }) ?? "",
    /preuve d'efficacité/i
  );
  assert.match(
    validateTransitionFields("cloturee_efficace", {
      gravite: "mineur",
      preuveEfficacite: "Indicateur revu",
      resultatEfficacite: "inefficace",
    }) ?? "",
    /efficace/i
  );
  assert.equal(
    validateTransitionFields("cloturee_efficace", {
      gravite: "mineur",
      preuveEfficacite: "Indicateur revu",
      resultatEfficacite: "efficace",
    }),
    null
  );
  assert.equal(
    validateTransitionFields("cloturee_inefficace", {
      gravite: "mineur",
      preuveEfficacite: "Indicateur revu",
      resultatEfficacite: "inefficace",
    }),
    null
  );
});
