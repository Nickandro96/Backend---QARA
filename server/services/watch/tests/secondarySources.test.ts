import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { isTgaEnabled, REGULATORY_SOURCE_REGISTRY } from "../registry";
import { parseAnsmRss } from "../sources/AnsmSource";
import { parseFdaMedwatchPayload } from "../sources/FdaMedwatchSource";
import { parseHealthCanadaPayload } from "../sources/HealthCanadaSource";
import { parseMhraAtom } from "../sources/MhraSource";
import { parseTgaRss, tgaFeedRequest } from "../sources/TgaSource";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const allowedTypes = new Set(["REGULATION", "GUIDANCE", "STANDARD", "QUALITY", "NOTICE", "CONSULTATION"]);

function assertContract(items: any[], language: "fr" | "en") {
  assert.ok(items.length >= 2);
  for (const item of items) {
    assert.ok(item.officialId, "official_id must be non-empty");
    assert.match(item.sourceUrl, /^https:\/\//);
    assert.equal(item.languageSource, language, "language_source mismatch");
    assert.ok(allowedTypes.has(item.type), `invalid type ${item.type}`);
    assert.ok(item.rawContent, "raw_content should be present when fixture has content");
  }
  assert.ok(items.some((item) => item.publishedAt instanceof Date && !Number.isNaN(item.publishedAt.getTime())));
  assert.ok(items.some((item) => item.publishedAt === null));
}

test("ANSM RSS contract", () => assertContract(parseAnsmRss(fixture("ansm.xml")), "fr"));
test("FDA MedWatch openFDA contract", () => assertContract(parseFdaMedwatchPayload(fixture("fda-medwatch.json") + ""), "en"));
test("Health Canada contract", () => {
  const items = parseHealthCanadaPayload(fixture("health-canada.json"));
  assertContract(items, "en");
  assert.ok(items.every((item: any) => item.jurisdiction === "CA"));
});
test("TGA RSS contract", () => {
  const items = parseTgaRss(fixture("tga.xml"), "alert");
  assertContract(items, "en");
  assert.ok(items.every((item: any) => item.jurisdiction === "AU"));
});

test("TGA is opt-in until an authorized relay is configured", () => {
  assert.equal(isTgaEnabled({}), false);
  assert.equal(isTgaEnabled({ WATCH_TGA_ENABLED: "true" }), true);
});

test("TGA supports a dedicated authorized upstream without leaking the generic relay token", () => {
  const feed = { path: "/feeds/guidance.xml", relayPath: "/tga/guidance", sourceType: "guidance" };
  assert.deepEqual(tgaFeedRequest(feed, {
    WATCH_TGA_FEED_BASE_URL: "https://authorized.example/",
    WATCH_TGA_FEED_TOKEN: "dedicated-token",
    WATCH_RELAY_TOKEN: "generic-token",
  }), {
    url: "https://authorized.example/feeds/guidance.xml",
    token: "dedicated-token",
  });
});
test("MHRA Atom contract", () => assertContract(parseMhraAtom(fixture("mhra.atom")), "en"));

test("registry contains the eight P0/P1-C sources", () => {
  const ids = new Set(REGULATORY_SOURCE_REGISTRY.map((source) => source.id));
  for (const id of ["eur-lex-mdr", "mdcg", "federal-register", "ansm", "fda-medwatch", "health-canada", "tga", "mhra"]) {
    assert.equal(ids.has(id), true, `${id} missing from registry`);
  }
});

test("every source declares whether it is official or secondary", () => {
  for (const source of REGULATORY_SOURCE_REGISTRY) {
    assert.ok(["official", "secondary"].includes(source.authorityType), `${source.id} authority type missing`);
  }
});
