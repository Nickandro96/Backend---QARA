import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { parseRssItems, stableOfficialId, stripHtml, tagValue } from "./SourceParsing";

const SOURCE_ID = "tga";
const FEEDS = [
  { url: "https://www.tga.gov.au/rss/alerts", sourceType: "alert" },
  { url: "https://www.tga.gov.au/rss/market-actions", sourceType: "recall" },
  { url: "https://www.tga.gov.au/rss/publications-and-consultations", sourceType: "guidance" },
];

export function parseTgaRss(xml: string, sourceType = "notice") {
  return parseRssItems(xml).map((item) => {
    const title = safeText(tagValue(item, "title"));
    const sourceUrl = safeText(tagValue(item, "link"));
    const rawContent = stripHtml(tagValue(item, "description"));
    const dateValue = tagValue(item, "pubDate") || tagValue(item, "dc:date");
    const parsedDate = dateValue ? new Date(dateValue) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const officialId = safeText(tagValue(item, "guid")) || sourceUrl || stableOfficialId(SOURCE_ID, title, publishedAt);
    // DB mapping: official_id <- officialId, language_source <- languageSource.
    return {
      type: sourceType === "guidance" ? "GUIDANCE" as const : "NOTICE" as const,
      title, publishedAt, effectiveAt: null, status: "NEW" as const,
      sourceName: "TGA", sourceUrl, sourceId: officialId, officialId, rawContent,
      languageSource: "en", sourceRegistryId: SOURCE_ID, jurisdiction: "UK" as const,
      tags: [{ key: "market", value: "AU" }, { key: "source_type", value: sourceType }],
      hash: computeUpdateHash({ type: sourceType === "guidance" ? "GUIDANCE" : "NOTICE", title, sourceName: "TGA", sourceId: officialId, sourceUrl, publishedAt }),
      retrievedAt: nowUtc(),
    };
  }).filter((item) => item.title && item.sourceUrl);
}

export const TgaSource: UpdateSource = {
  name: "TGA",
  async fetchUpdates(ctx) {
    const started = Date.now();
    const items = [];
    for (const feed of FEEDS) {
      try {
        if (!isUrlAllowed(feed.url)) throw new Error("TGA URL not allowed");
        items.push(...parseTgaRss(await fetchTextWithRetry(feed.url, { timeoutMs: ctx.timeoutMs, retries: 2 }), feed.sourceType));
      } catch (error: any) {
        return { items, health: { name: "TGA", ok: false, durationMs: Date.now() - started, items: items.length, message: error?.message ?? "error" } };
      }
    }
    return { items, health: { name: "TGA", ok: true, durationMs: Date.now() - started, items: items.length } };
  },
};
