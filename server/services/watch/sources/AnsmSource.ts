import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { parseRssItems, stableOfficialId, stripHtml, tagValue } from "./SourceParsing";

const SOURCE_ID = "ansm";
const FEEDS = [
  "https://ansm.sante.fr/rss.xml",
  "https://ansm.sante.fr/actualites.rss",
];

export function parseAnsmRss(xml: string) {
  return parseRssItems(xml).map((item) => {
    const title = safeText(tagValue(item, "title"));
    const sourceUrl = safeText(tagValue(item, "link"));
    const rawContent = stripHtml(tagValue(item, "description"));
    const parsedDate = tagValue(item, "pubDate") ? new Date(tagValue(item, "pubDate")) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const officialId = safeText(tagValue(item, "guid")) || sourceUrl || stableOfficialId(SOURCE_ID, title, publishedAt);
    const haystack = `${title} ${rawContent}`.toLowerCase();
    const type = haystack.includes("rappel de lot") ? "RECALL" : haystack.includes("alerte") ? "ALERT" : haystack.includes("decision") || haystack.includes("décision") ? "REGULATION" : "NOTICE";
    // DB mapping: official_id <- officialId, language_source <- languageSource.
    return {
      type: type === "REGULATION" ? "REGULATION" as const : "NOTICE" as const,
      title, publishedAt, effectiveAt: null, status: "NEW" as const,
      sourceName: "ANSM", sourceUrl, sourceId: officialId, officialId, rawContent,
      languageSource: "fr", sourceRegistryId: SOURCE_ID, jurisdiction: "EU" as const,
      tags: [{ key: "source_type", value: type.toLowerCase() }],
      hash: computeUpdateHash({ type: type === "REGULATION" ? "REGULATION" : "NOTICE", title, sourceName: "ANSM", sourceId: officialId, sourceUrl, publishedAt }),
      retrievedAt: nowUtc(),
    };
  }).filter((item) => item.title && item.sourceUrl);
}

export const AnsmSource: UpdateSource = {
  name: "ANSM",
  async fetchUpdates(ctx) {
    const started = Date.now();
    const items = [];
    for (const url of FEEDS) {
      try {
        if (!isUrlAllowed(url)) throw new Error("ANSM URL not allowed");
        items.push(...parseAnsmRss(await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 2 })));
      } catch (error: any) {
        return { items, health: { name: "ANSM", ok: false, durationMs: Date.now() - started, items: items.length, message: error?.message ?? "error" } };
      }
    }
    return { items, health: { name: "ANSM", ok: true, durationMs: Date.now() - started, items: items.length } };
  },
};
