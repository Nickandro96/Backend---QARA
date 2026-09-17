import test from "node:test";
import assert from "node:assert/strict";
import { normalizeResponseValue } from "../response-values";

test("normalise toutes les variantes de non-conformité", () => {
  for (const value of ["non_compliant", "non-conforme", "non_conforme", "NC", "non-compliant"]) {
    assert.equal(normalizeResponseValue(value), "non_compliant", value);
  }
});

test("normalise toutes les variantes de réponse partielle", () => {
  for (const value of ["partial", "partiel", "partially compliant", "partiellement conforme"]) {
    assert.equal(normalizeResponseValue(value), "partial", value);
  }
});

test("préserve les réponses finales et exclut les brouillons", () => {
  assert.equal(normalizeResponseValue("compliant"), "compliant");
  assert.equal(normalizeResponseValue("not_applicable"), "not_applicable");
  assert.equal(normalizeResponseValue("brouillon"), "in_progress");
});
