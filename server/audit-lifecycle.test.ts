import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAuditDeletable,
  assertAuditCanComplete,
  assertAuditCanStart,
  assertAuditCanReopen,
  assertAuditComplete,
  assertAuditMutable,
  assertQuestionBelongsToAudit,
  isAuditClosed,
  resolveAuditProcessId,
} from "./audit-lifecycle";

const codeIs = (code: string) => (error: any) => error?.code === code;

test("suppression destructive refusée dès qu'une preuve réglementaire existe", () => {
  assert.doesNotThrow(() => assertAuditDeletable({ responses: 0, capas: 0 }));
  assert.throws(() => assertAuditDeletable({ responses: 1, capas: 0 }), codeIs("CONFLICT"));
  assert.throws(() => assertAuditDeletable({ responses: 0, capas: 1 }), codeIs("CONFLICT"));
});

test("machine d’états : brouillon puis en cours, sans modification silencieuse après clôture", () => {
  assert.doesNotThrow(() => assertAuditCanStart({ status: "draft" }));
  assert.doesNotThrow(() => assertAuditCanStart({ status: "in_progress" }));
  assert.throws(() => assertAuditCanComplete({ status: "draft" }), codeIs("PRECONDITION_FAILED"));
  assert.doesNotThrow(() => assertAuditCanComplete({ status: "in_progress" }));
  for (const status of ["completed", "closed"]) {
    assert.equal(isAuditClosed(status), true);
    assert.throws(() => assertAuditMutable({ status }), codeIs("CONFLICT"));
    assert.throws(() => assertAuditCanComplete({ status }), codeIs("CONFLICT"));
  }
});

test("réouverture explicite : motif obligatoire et statut closed protégé", () => {
  assert.throws(() => assertAuditCanReopen({ status: "completed" }), codeIs("BAD_REQUEST"));
  assert.doesNotThrow(() => assertAuditCanReopen({ status: "completed" }, "Correction documentée"));
  assert.throws(() => assertAuditCanReopen({ status: "closed" }, "Correction documentée"), codeIs("FORBIDDEN"));
});

test("processId numérique est accepté uniquement s’il est cohérent avec la question", () => {
  const scoped = [{ questionKey: "Q1", processId: 7 }, { questionKey: "Q2", processId: null }];
  assert.equal(resolveAuditProcessId("Q1", 7, scoped), 7);
  assert.equal(resolveAuditProcessId("Q1", "7", scoped), 7);
  assert.equal(resolveAuditProcessId("Q2", 3, scoped), 3);
  assert.equal(resolveAuditProcessId("Q2", null, scoped), null);
  assert.throws(() => resolveAuditProcessId("Q1", "abc", scoped), codeIs("BAD_REQUEST"));
  assert.throws(() => resolveAuditProcessId("Q1", 8, scoped), codeIs("BAD_REQUEST"));
});

test("un audit annulé ne peut pas être démarré", () => {
  assert.throws(() => assertAuditCanStart({ status: "cancelled" }), codeIs("CONFLICT"));
});

test("questionKey doit appartenir exactement au questionnaire MDR ou ISO", () => {
  const mdr = [{ questionKey: "MDR-10-9" }];
  const iso = [{ questionKey: "ISO13485-4.2.4" }];
  assert.doesNotThrow(() => assertQuestionBelongsToAudit("MDR-10-9", mdr));
  assert.doesNotThrow(() => assertQuestionBelongsToAudit("ISO13485-4.2.4", iso));
  assert.throws(() => assertQuestionBelongsToAudit("ISO13485-4.2.4", mdr), codeIs("BAD_REQUEST"));
  assert.throws(() => assertQuestionBelongsToAudit("UNKNOWN", iso), codeIs("BAD_REQUEST"));
});

test("clôture lorsque chaque question applicable a une réponse finale persistée", () => {
  const questions = [{ questionKey: "Q1" }, { questionKey: "Q2" }];
  assert.deepEqual(
    assertAuditComplete(questions, [
      { questionKey: "Q1", responseValue: "compliant" },
      { questionKey: "Q2", responseValue: "not_applicable" },
    ]),
    { answered: 1, expected: 1 }
  );
  assert.throws(
    () => assertAuditComplete(questions, [{ questionKey: "Q1", responseValue: "in_progress" }]),
    codeIs("PRECONDITION_FAILED")
  );
  assert.throws(() => assertAuditComplete([], []), codeIs("PRECONDITION_FAILED"));
});

test("les doublons et réponses étrangères ne faussent pas la progression", () => {
  const result = assertAuditComplete(
    [{ questionKey: "Q1" }, { questionKey: "Q2" }],
    [
      { questionKey: "Q1", responseValue: "compliant" },
      { questionKey: "Q1", responseValue: "non_compliant" },
      { questionKey: "Q2", responseValue: "5" },
      { questionKey: "OUTSIDE", responseValue: "compliant" },
    ]
  );
  assert.deepEqual(result, { answered: 2, expected: 2 });
});
