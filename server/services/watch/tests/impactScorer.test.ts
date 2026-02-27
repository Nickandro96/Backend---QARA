import test from "node:test";
import assert from "node:assert/strict";
import { scoreImpact } from "../enrichment/ImpactScorer";

test("Impact scoring: PMS domain => at least High", () => {
  const r = scoreImpact({
    type: "GUIDANCE",
    status: "NEW",
    title: "MDCG 202x-xx PMS guidance",
    impactedDomains: ["PMS"],
    tags: [],
  });
  assert.equal(r.level, "High");
});

test("Impact scoring: minor corrigendum => Low/Medium", () => {
  const r = scoreImpact({
    type: "REGULATION",
    status: "CORRIGENDUM",
    title: "Corrigendum (editorial) - MDR 2017/745",
    impactedDomains: ["Other"],
    tags: [],
  });
  assert.ok(r.level === "Low" || r.level === "Medium");
});
