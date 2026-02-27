import test from "node:test";
import assert from "node:assert/strict";
import { computeUpdateHash, dedupeByHash } from "../enrichment/Dedupe";

test("computeUpdateHash is stable for same inputs", () => {
  const d = new Date("2026-02-01T00:00:00Z");
  const h1 = computeUpdateHash({
    type: "GUIDANCE",
    title: "MDCG 2021-1 rev.1",
    sourceName: "EU Commission",
    sourceId: "MDCG2021-1",
    sourceUrl: "https://example.europa.eu/doc.pdf",
    publishedAt: d,
  });
  const h2 = computeUpdateHash({
    type: "GUIDANCE",
    title: "MDCG 2021-1 rev.1",
    sourceName: "EU Commission",
    sourceId: "MDCG2021-1",
    sourceUrl: "https://example.europa.eu/doc.pdf",
    publishedAt: d,
  });
  assert.equal(h1, h2);
});

test("dedupeByHash drops duplicates", () => {
  const items = [{ hash: "a" }, { hash: "b" }, { hash: "a" }];
  const { unique, duplicates } = dedupeByHash(items);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 1);
});
