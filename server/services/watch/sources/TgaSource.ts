import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { parseRssItems, stableOfficialId, stripHtml, tagValue } from "./SourceParsing";

const SOURCE_ID = "tga";
const FEEDS = [
  { url: "https://www.tga.gov.au/feeds/alert/safety-alerts.xml", sourceType: "alert" },
  { url: "https://www.tga.gov.au/feeds/alert/market-actions.xml", sourceType: "recall" },
  { url: "https://www.tga.gov.au/feeds/guidance.xml", sourceType: "guidance" },
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
    const results = await Promise.allSettled(FEEDS.map(async (feed) => {
      if (!isUrlAllowed(feed.url)) throw new Error("URL de source TGA refusée");
      const xml = await fetchTextWithRetry(feed.url, {
        timeoutMs: Math.min(ctx.timeoutMs, 8_000),
        retries: 0,
      });
      return parseTgaRss(xml, feed.sourceType);
    }));
    const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const errors = results.flatMap((result, index) => {
      if (result.status === "fulfilled") return [];
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      return [`${FEEDS[index].sourceType}: ${message}`];
    });

    if (errors.length === FEEDS.length) {
      return {
        items,
        health: {
          name: "TGA",
          ok: false,
          durationMs: Date.now() - started,
          items: items.length,
          message: errors.join(" | "),
        },
      };
    }

    return {
      items,
      health: {
        name: "TGA",
        ok: true,
        durationMs: Date.now() - started,
        items: items.length,
        message: errors.length ? `Collecte partielle : ${errors.join(" | ")}` : undefined,
      },
    };
  },
};
