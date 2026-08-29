import type { UpdateSource } from "../types";
import { fetchTextWithRetry } from "./_http";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
const CELLAR = "https://publications.europa.eu/webapi/rdf/sparql";
const QUERY = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#> PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?work ?celex ?title ?date WHERE { ?work cdm:resource_legal_id_celex ?celex . FILTER(CONTAINS(STR(?celex), "32017R0745") || CONTAINS(STR(?celex), "32017R0746")) OPTIONAL { ?work cdm:work_date_document ?date } OPTIONAL { ?expression cdm:expression_belongs_to_work ?work ; cdm:expression_title ?title . FILTER(LANG(?title) = "en") } } ORDER BY DESC(?date) LIMIT 200`;
function decodeXml(v: string) { return v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
export function parseCellarSparqlXml(xml: string) {
  return (xml.match(/<result\b[\s\S]*?<\/result>/gi) ?? []).map((block) => {
    const value = (name: string) => decodeXml(block.match(new RegExp(`<binding\\s+name=["']${name}["'][^>]*>[\\s\\S]*?<(?:literal|uri)[^>]*>([\\s\\S]*?)<\\/(?:literal|uri)>`, "i"))?.[1]?.trim() ?? "");
    const officialId = value("celex"), sourceUrl = value("work"), rawDate = value("date");
    const parsed = rawDate ? new Date(rawDate) : null; const publishedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    const title = safeText(value("title") || `EUR-Lex ${officialId}`);
    return { type: "REGULATION" as const, title, publishedAt, effectiveAt: null, status: "NEW" as const,
      sourceName: "EUR-Lex CELLAR", sourceUrl, sourceId: officialId, jurisdiction: "EU" as const,
      tags: [{ key: "celex", value: officialId }], hash: computeUpdateHash({ type: "REGULATION", title, sourceName: "EUR-Lex CELLAR", sourceId: officialId, sourceUrl, publishedAt }), retrievedAt: nowUtc() };
  }).filter((item) => item.sourceId && item.sourceUrl);
}
export const EurLexMdrSource: UpdateSource = { name: "EUR-Lex CELLAR", async fetchUpdates(ctx) {
  const started = Date.now();
  try { const base = process.env.WATCH_EURLEX_SPARQL_URL ?? CELLAR; const url = `${base}?query=${encodeURIComponent(QUERY)}&format=${encodeURIComponent("application/sparql-results+xml")}`;
    if (!isUrlAllowed(url)) throw new Error("EUR-Lex CELLAR URL not allowed");
    const items = parseCellarSparqlXml(await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 3 }));
    return { items, health: { name: "EUR-Lex CELLAR", ok: true, durationMs: Date.now() - started, items: items.length } };
  } catch (error: any) { return { items: [], health: { name: "EUR-Lex CELLAR", ok: false, durationMs: Date.now() - started, items: 0, message: error?.message ?? "error" } }; }
} };
