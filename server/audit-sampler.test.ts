import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLER_VERSION, sampleAuditQuestions } from "./audit-sampler";

const questions = Array.from({ length: 65 }, (_, index) => ({ id: index + 1, questionKey: `Q${index + 1}`, processId: index % 7, criticality: index % 9 === 0 ? "critical" : "medium", displayOrder: index + 1 }));

test("le mode rapide MDR retourne 14 questions de façon stable", () => {
  assert.equal(SAMPLER_VERSION, "1.0");
  assert.equal(sampleAuditQuestions(questions, "rapid").length, 14);
  assert.deepEqual(sampleAuditQuestions(questions, "rapid"), sampleAuditQuestions(questions, "rapid"));
  assert.equal(new Set(sampleAuditQuestions(questions, "rapid").map((q) => q.processId)).size, 7);
});

test("le mode complet conserve tout le corpus", () => assert.equal(sampleAuditQuestions(questions, "complete").length, 65));
