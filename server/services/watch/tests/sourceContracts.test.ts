import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseFederalRegisterPayload } from "../sources/FederalRegisterSource";
import { parseCellarSparqlXml } from "../sources/EurLexMdrSource";
import { extractMdcgLinks, parseDateFromText } from "../sources/MdcgSource";
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

test("Federal Register contract maps official id and dates", () => {
  const [item] = parseFederalRegisterPayload(fixture("federal-register.json"));
  assert.equal(item.sourceId, "2026-12345"); assert.equal(item.type, "REGULATION"); assert.equal(item.jurisdiction, "US");
});
test("CELLAR SPARQL XML contract maps CELEX provenance", () => {
  const [item] = parseCellarSparqlXml(fixture("cellar.xml"));
  assert.equal(item.sourceId, "32017R0745"); assert.equal(item.publishedAt?.toISOString().slice(0, 10), "2026-08-01");
});
test("MDCG HTML contract keeps missing dates null", () => {
  const [link] = extractMdcgLinks(fixture("mdcg.html")); assert.match(link.href, /mdcg-2026-7/);
  assert.equal(parseDateFromText("MDCG guidance without a date"), null);
});
