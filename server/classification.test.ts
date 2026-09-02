import test from "node:test";
import assert from "node:assert/strict";
import { classifyAnswers } from "./classification-router";

test("peau intacte n'active pas la Règle 4 (peau lésée) — rapport QA 2026-09-02 IMP-8", () => {
  const res = classifyAnswers({
    device_name: "Pansement test",
    invasiveness: "non-invasif",
    contact_site: ["peau_intacte"],
  } as any);

  const ruleNumbers = res.appliedRules.map((r) => r.number);
  assert.ok(!ruleNumbers.includes("4"), `Règle 4 ne doit pas s'appliquer, obtenu: ${ruleNumbers.join(",")}`);
  assert.ok(ruleNumbers.includes("1"), "Règle 1 (non invasif) attendue pour peau intacte");
});

test("peau lésée active bien la Règle 4", () => {
  const res = classifyAnswers({
    device_name: "Pansement plaie",
    invasiveness: "non-invasif",
    contact_site: ["peau_lesee"],
    wound_depth: "profonde",
  } as any);
  assert.ok(res.appliedRules.some((r) => r.number === "4"));
});

test("appliedRules sont des objets et confidence est une enum", () => {
  const res = classifyAnswers({
    device_name: "X",
    invasiveness: "non-invasif",
    contact_site: ["peau_intacte"],
  } as any);
  assert.equal(typeof res.appliedRules[0], "object");
  assert.ok("number" in res.appliedRules[0] && "title" in res.appliedRules[0]);
  assert.ok(["high", "medium", "low"].includes(res.confidence));
  assert.equal(typeof res.confidenceScore, "number");
});
