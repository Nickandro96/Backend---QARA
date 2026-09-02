import test from "node:test";
import assert from "node:assert/strict";
import { isUrlAllowed } from "../utils";

test("autorise les domaines des régulateurs officiels (rapport QA 2026-09-02)", () => {
  for (const url of [
    "https://ansm.sante.fr/actualites/rss",
    "https://api.fda.gov/device/recall.json",
    "https://www.fda.gov/medical-devices",
    "https://www.federalregister.gov/api/v1/documents.json",
    "https://recalls-rappels.canada.ca/en/search/rss",
    "https://www.gov.uk/drug-device-alerts.atom",
    "https://www.tga.gov.au/news/safety-alerts/rss.xml",
    "https://health.ec.europa.eu/latest-updates_en",
    "https://eur-lex.europa.eu/oj/direct-access.html",
    "https://www.iso.org/news.html",
  ]) {
    assert.equal(isUrlAllowed(url), true, url);
  }
});

test("rejette les domaines hors allowlist et les schémas non http(s)", () => {
  assert.equal(isUrlAllowed("https://evil.example.com/x"), false);
  assert.equal(isUrlAllowed("https://notfda.gov.evil.com/x"), false);
  assert.equal(isUrlAllowed("file:///etc/passwd"), false);
  assert.equal(isUrlAllowed("not a url"), false);
});
