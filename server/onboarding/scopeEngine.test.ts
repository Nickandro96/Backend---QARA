import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEconomicRole,
  situationFromEconomicRole,
  matchesScope,
  validateScopeCompletion,
} from "./scopeEngine";
import type { ScopeSelection } from "./scopeEngine";

test("normalizeEconomicRole : mappe les libellés bruts vérifiés en base vers les 4 rôles canoniques", () => {
  assert.deepEqual(normalizeEconomicRole("fabricant"), ["fabricant"]);
  assert.deepEqual(normalizeEconomicRole("finished device manufacturer"), ["fabricant"]);
  assert.deepEqual(normalizeEconomicRole("fabricant IVD"), ["fabricant"]);
  assert.deepEqual(normalizeEconomicRole("fabricant participant MDSAP"), ["fabricant"]);
  assert.deepEqual(normalizeEconomicRole("assembleur"), ["fabricant"]);
  assert.deepEqual(normalizeEconomicRole("U.S. agent"), ["fabricant"]);
  assert.deepEqual(normalizeEconomicRole("mandataire"), ["mandataire"]);
  assert.deepEqual(normalizeEconomicRole("importateur"), ["importateur"]);
  assert.deepEqual(normalizeEconomicRole("distributeur"), ["distributeur"]);
});

test("normalizeEconomicRole : organisme/organisme DM/direction ne sont pas des rôles (générique — ISO audite l'organisme, pas l'opérateur)", () => {
  assert.deepEqual(normalizeEconomicRole("organisme DM"), []);
  assert.deepEqual(normalizeEconomicRole("organisme"), []);
  assert.deepEqual(normalizeEconomicRole("direction"), []);
});

test("normalizeEconomicRole : null/vide/inconnu -> générique (aucune restriction)", () => {
  assert.deepEqual(normalizeEconomicRole(null), []);
  assert.deepEqual(normalizeEconomicRole(""), []);
  assert.deepEqual(normalizeEconomicRole("libellé jamais vu"), []);
});

test("situationFromEconomicRole : assembleur -> situation assemblage", () => {
  assert.deepEqual(situationFromEconomicRole("assembleur"), ["assemblage"]);
  assert.deepEqual(situationFromEconomicRole("fabricant"), []);
});

function scope(overrides: Partial<Pick<ScopeSelection, "economicRoles" | "situationTags">> = {}) {
  return { economicRoles: ["fabricant"] as ScopeSelection["economicRoles"], situationTags: [] as ScopeSelection["situationTags"], ...overrides };
}

test("matchesScope : question générique (roleReglementaire vide) visible pour tout rôle", () => {
  assert.equal(matchesScope({ roleReglementaire: [], situationTags: [] }, scope({ economicRoles: ["distributeur"] })), true);
  assert.equal(matchesScope({ roleReglementaire: null, situationTags: null }, scope({ economicRoles: ["mandataire"] })), true);
});

test("matchesScope : question restreinte à un rôle non sélectionné -> exclue", () => {
  assert.equal(
    matchesScope({ roleReglementaire: ["fabricant"], situationTags: [] }, scope({ economicRoles: ["distributeur"] })),
    false
  );
});

test("matchesScope : question restreinte à un rôle sélectionné -> incluse", () => {
  assert.equal(
    matchesScope({ roleReglementaire: ["fabricant"], situationTags: [] }, scope({ economicRoles: ["fabricant"] })),
    true
  );
});

test("situationFromEconomicRole : le corpus n'a pas de libellé economicRole dédié au reconditionnement (aucune situation générée)", () => {
  assert.deepEqual(situationFromEconomicRole("finished device manufacturer"), []);
});

test("matchesScope : question fabricant à situationTags non vide par erreur (régression ISO14971) reste visible via le rôle", () => {
  // Reproduit le faux positif détecté en direct : une première version dérivait
  // situationTags depuis `applicableProcesses`, qui liste une audience large et
  // dupliquée par process (ex. "assembleur si impact risque" apparaît sur les 67
  // questions ISO14971 aux côtés de "fabricant"/"fabricant IVD") — non fiable comme
  // signal par question. Ici, roleMatch doit suffire indépendamment de situationTags.
  const isoQuestionMalTague = { roleReglementaire: ["fabricant"], situationTags: [] as string[] };
  assert.equal(matchesScope(isoQuestionMalTague, scope({ economicRoles: ["fabricant"], situationTags: [] })), true);
});

test("matchesScope : question à situation particulière exclue tant que la case n'est pas cochée (bug corrigé le plus important)", () => {
  const question = { roleReglementaire: [] as string[], situationTags: ["assemblage"] as string[] };
  assert.equal(matchesScope(question, scope({ situationTags: [] })), false);
  assert.equal(matchesScope(question, scope({ situationTags: ["assemblage"] })), true);
});

test("matchesScope : ISO13485 (organisme DM -> générique) visible pour fabricant ET pour un pur distributeur", () => {
  // ISO13485 §1 couvre les organisations impliquées à toute étape du cycle de
  // vie (y compris stockage/distribution) : "organisme DM" n'est pas un rôle,
  // la question reste visible quel que soit le rôle économique sélectionné.
  const isoQuestion = { roleReglementaire: normalizeEconomicRole("organisme DM"), situationTags: [] };
  assert.equal(matchesScope(isoQuestion, scope({ economicRoles: ["fabricant"] })), true);
  assert.equal(matchesScope(isoQuestion, scope({ economicRoles: ["distributeur"] })), true);
});

test("matchesScope : MDR assembleur (-> fabricant + tag assemblage) visible pour fabricant si la case est cochée, jamais pour un pur distributeur", () => {
  const mdrQuestion = {
    roleReglementaire: normalizeEconomicRole("assembleur"),
    situationTags: situationFromEconomicRole("assembleur"),
  };
  assert.equal(matchesScope(mdrQuestion, scope({ economicRoles: ["fabricant"], situationTags: ["assemblage"] })), true);
  assert.equal(matchesScope(mdrQuestion, scope({ economicRoles: ["fabricant"], situationTags: [] })), false);
  assert.equal(matchesScope(mdrQuestion, scope({ economicRoles: ["distributeur"], situationTags: ["assemblage"] })), false);
});

test("validateScopeCompletion : au moins un référentiel et un rôle requis", () => {
  const base: ScopeSelection = { referentialCodes: [], economicRoles: [], markets: [], situationTags: [] };
  assert.match(validateScopeCompletion(base) ?? "", /référentiel/i);
  assert.equal(
    validateScopeCompletion({ ...base, referentialCodes: ["MDR"] }) !== null &&
      /rôle/i.test(validateScopeCompletion({ ...base, referentialCodes: ["MDR"] })!),
    true
  );
});

test("validateScopeCompletion : MDSAP exige au moins un marché", () => {
  const scopeWithMdsap: ScopeSelection = {
    referentialCodes: ["MDSAP"],
    economicRoles: ["fabricant"],
    markets: [],
    situationTags: [],
  };
  assert.match(validateScopeCompletion(scopeWithMdsap) ?? "", /marché/i);
  assert.equal(validateScopeCompletion({ ...scopeWithMdsap, markets: ["US"] }), null);
});

test("validateScopeCompletion : scope complet sans MDSAP -> valide", () => {
  const complete: ScopeSelection = {
    referentialCodes: ["MDR", "ISO13485"],
    economicRoles: ["fabricant"],
    markets: [],
    situationTags: [],
  };
  assert.equal(validateScopeCompletion(complete), null);
});
