import test from "node:test";
import assert from "node:assert/strict";
import { calculateAuditProgress } from "./audit-progress";

const keys = (count: number) => Array.from({ length: count }, (_, index) => `Q${index + 1}`);

test("1 réponse finale sur 64 donne 1,56 % et jamais 100 %", () => {
  const result = calculateAuditProgress(keys(64), [{ questionKey: "Q1", responseValue: "compliant" }]);
  assert.equal(result.percentage, 1.56);
  assert.equal(result.finalApplicableResponses, 1);
  assert.equal(result.isComplete, false);
});

test("un audit vide donne 0 %", () => assert.equal(calculateAuditProgress(keys(64), []).percentage, 0));

test("un audit complet donne 100 %", () => {
  const responses = keys(3).map((questionKey) => ({ questionKey, responseValue: "compliant" }));
  assert.equal(calculateAuditProgress(keys(3), responses).percentage, 100);
  assert.equal(calculateAuditProgress(keys(3), responses).isComplete, true);
});

test("une question N/A est exclue du dénominateur", () => {
  const result = calculateAuditProgress(keys(3), [
    { questionKey: "Q1", responseValue: "not_applicable" },
    { questionKey: "Q2", responseValue: "partial" },
  ]);
  assert.equal(result.totalApplicableQuestions, 2);
  assert.equal(result.notApplicableQuestions, 1);
  assert.equal(result.percentage, 50);
});

test("une réponse brouillon n'est pas comptée comme finale", () => {
  const result = calculateAuditProgress(keys(2), [{ questionKey: "Q1", responseValue: "in_progress" }]);
  assert.equal(result.draftResponses, 1);
  assert.equal(result.finalApplicableResponses, 0);
  assert.equal(result.percentage, 0);
});

test("doublons et réponses hors périmètre sont ignorés", () => {
  const result = calculateAuditProgress(keys(2), [
    { questionKey: "Q1", responseValue: "compliant" },
    { questionKey: "Q1", responseValue: "non_compliant" },
    { questionKey: "OTHER", responseValue: "compliant" },
  ]);
  assert.equal(result.finalApplicableResponses, 1);
  assert.equal(result.percentage, 50);
});
