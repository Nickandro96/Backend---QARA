import type { UpdateSource } from "../types";
import { fetchTextWithRetry } from "./_http";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { nowUtc, safeText, isUrlAllowed } from "../utils";

// ISO publishes various RSS feeds; this one is public and stable-ish.
const DEFAULT_RSS = "https://www.iso.org/contents/data/publication_feeds/iso_rss.xml";
const NEWS_URL = "https://www.iso.org/home/insights-news/news/standards-world/news-list.html";

function extractRssItems(xml: string): { title: string; link: string; pubDate?: Date }[] {
  const items: { title: string; link: string; pubDate?: Date }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const chunk = m[1];
    const title = chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1]
      ?? chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
      ?? "";
    const link = chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const pub = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];
    const pubDate = pub ? new Date(pub) : undefined;
    if (!title || !link) continue;
    items.push({ title: safeText(title), link: safeText(link), pubDate: pubDate && !isNaN(pubDate.getTime()) ? pubDate : undefined });
  }
  return items;
}

export function extractIsoNews(html: string): { title: string; link: string; pubDate?: Date }[] {
  const items: { title: string; link: string; pubDate?: Date }[] = [];
  const seen = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const title = safeText(match[2].replace(/<[^>]+>/g, " "));
    if (!/\bISO\s*(9001|13485)\b|quality\s+management/i.test(title)) continue;
    const link = new URL(match[1], NEWS_URL).toString();
    if (seen.has(link)) continue;
    seen.add(link);
    items.push({ title, link });
  }
  return items;
}

export const IsoNewsSource: UpdateSource = {
  name: "ISO (public RSS)",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const url = process.env.WATCH_ISO_RSS ?? DEFAULT_RSS;
      if (!isUrlAllowed(url)) throw new Error("URL de source ISO refusée");
      let parsed: { title: string; link: string; pubDate?: Date }[];
      try {
        const xml = await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 1 });
        parsed = extractRssItems(xml);
      } catch (rssError) {
        if (process.env.WATCH_ISO_RSS) throw rssError;
        const html = await fetchTextWithRetry(NEWS_URL, { timeoutMs: ctx.timeoutMs, retries: 1 });
        parsed = extractIsoNews(html);
      }

      // Keep only likely ISO 9001 / ISO 13485 signals to stay relevant.
      const filtered = parsed.filter((it) => /\bISO\s*(9001|13485)\b/i.test(it.title) || /quality\s+management/i.test(it.title));

      const items = filtered.slice(0, 50).map((it) => {
        const publishedAt = it.pubDate ?? null;
        if (!publishedAt) console.warn("[Watch][ISO] publication date absent; preserving null", { sourceUrl: it.link });
        const title = it.title;
        return {
          type: "QUALITY" as const,
          title,
          publishedAt,
          effectiveAt: null,
          status: "NEW" as const,
          sourceName: "ISO",
          sourceUrl: it.link,
          sourceId: it.link,
          jurisdiction: "EU" as const,
          tags: [{ key: "iso" }],
          hash: computeUpdateHash({
            type: "QUALITY",
            title,
            sourceName: "ISO",
            sourceId: it.link,
            sourceUrl: it.link,
            publishedAt,
          }),
          retrievedAt: nowUtc(),
        };
      });

      return {
        items,
        health: { name: "ISO", ok: true, durationMs: Date.now() - started, items: items.length },
      };
    } catch (e: any) {
      return {
        items: [],
        health: { name: "ISO", ok: false, durationMs: Date.now() - started, message: e?.message ?? "error" },
      };
    }
  },
};
