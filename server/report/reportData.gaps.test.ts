import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditorGapStatement, resolveObjectiveEvidence } from "./reportData";

test("le registre reprend le constat réel de l’auditeur", () => {
  const statement = buildAuditorGapStatement({
    requirementRef: "MDR Art. 87",
    questionText: "Les incidents graves sont-ils notifiés ?",
    responseComment: "Deux incidents n’ont pas été notifiés dans le délai réglementaire.",
    gravite: "majeur",
  });
  assert.match(statement, /Deux incidents n’ont pas été notifiés/);
  assert.match(statement, /MDR Art\. 87/);
  assert.doesNotMatch(statement, /NC typiques/);
});

test("les absences de constat et de preuve sont explicites et opposables", () => {
  const statement = buildAuditorGapStatement({
    requirementRef: null,
    questionText: "Q".repeat(250),
    responseComment: " ",
    gravite: "mineur",
  });
  assert.match(statement, /aucun commentaire d’auditeur saisi/);
  assert.ok(statement.length < 400);
  assert.match(resolveObjectiveEvidence(null), /à compléter avant transmission à l’organisme notifié/);
  assert.equal(resolveObjectiveEvidence("Dossier CAPA-17 vérifié"), "Dossier CAPA-17 vérifié");
});
