import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { parseRssItems, stableOfficialId, stripHtml, tagValue } from "./SourceParsing";

const SOURCE_ID = "tga";
const FEEDS = [
  { path: "/feeds/alert/safety-alerts.xml", relayPath: "/tga/safety", sourceType: "alert" },
  { path: "/feeds/alert/market-actions.xml", relayPath: "/tga/market-actions", sourceType: "recall" },
  { path: "/feeds/guidance.xml", relayPath: "/tga/guidance", sourceType: "guidance" },
];

export function tgaFeedRequest(feed: (typeof FEEDS)[number], env: NodeJS.ProcessEnv = process.env): { url: string; token?: string } {
  const authorizedBase = env.WATCH_TGA_FEED_BASE_URL?.replace(/\/$/, "");
  if (authorizedBase) {
    return { url: `${authorizedBase}${feed.path}`, token: env.WATCH_TGA_FEED_TOKEN };
  }
  const relay = env.WATCH_RELAY_BASE_URL?.replace(/\/$/, "");
  if (relay) return { url: `${relay}${feed.relayPath}`, token: env.WATCH_RELAY_TOKEN };
  return { url: `https://www.tga.gov.au${feed.path}` };
}

function isConfiguredTgaUrlAllowed(url: string): boolean {
  if (isUrlAllowed(url)) return true;
  const configuredBase = process.env.WATCH_TGA_FEED_BASE_URL;
  if (!configuredBase) return false;
  try {
    return new URL(url).origin === new URL(configuredBase).origin;
  } catch {
    return false;
  }
}

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
      languageSource: "en", sourceRegistryId: SOURCE_ID, jurisdiction: "AU" as const,
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
      const { url, token } = tgaFeedRequest(feed);
      if (!isConfiguredTgaUrlAllowed(url)) throw new Error("URL de source TGA refusée");
      const xml = await fetchTextWithRetry(url, {
        timeoutMs: Math.max(ctx.timeoutMs, 20_000),
        retries: 1,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
