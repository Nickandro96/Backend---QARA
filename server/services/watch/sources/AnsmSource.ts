import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { parseRssItems, stableOfficialId, stripHtml, tagValue } from "./SourceParsing";

const SOURCE_ID = "ansm";
const NEWS_URL = "https://ansm.sante.fr/actualites/";

export function parseAnsmNewsPage(html: string) {
  const items: any[] = [];
  const seen = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']*\/actualites\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const sourceUrl = new URL(match[1], NEWS_URL).toString();
    const title = safeText(stripHtml(match[2]));
    if (!title || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const officialId = stableOfficialId(SOURCE_ID, title, null);
    items.push({ type: "NOTICE" as const, title, publishedAt: null, effectiveAt: null, status: "NEW" as const, sourceName: "ANSM", sourceUrl, sourceId: officialId, officialId, rawContent: title, languageSource: "fr", sourceRegistryId: SOURCE_ID, jurisdiction: "EU" as const, tags: [{ key: "source_type", value: "notice" }], hash: computeUpdateHash({ type: "NOTICE", title, sourceName: "ANSM", sourceId: officialId, sourceUrl, publishedAt: null }), retrievedAt: nowUtc() });
  }
  return items.slice(0, 100);
}

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
    try {
      if (!isUrlAllowed(NEWS_URL)) throw new Error("URL de source ANSM refusée");
      const items = parseAnsmNewsPage(await fetchTextWithRetry(NEWS_URL, { timeoutMs: ctx.timeoutMs, retries: 2 }));
      if (!items.length) throw new Error("ANSM : aucune actualité reconnue dans la page officielle");
      return { items, health: { name: "ANSM", ok: true, durationMs: Date.now() - started, items: items.length } };
    } catch (error: any) {
      return { items: [], health: { name: "ANSM", ok: false, durationMs: Date.now() - started, items: 0, message: error?.message ?? "error" } };
    }
  },
};
