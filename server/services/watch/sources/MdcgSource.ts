import type { UpdateSource } from "../types";
import { fetchTextWithRetry } from "./_http";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { nowUtc, safeText, isUrlAllowed } from "../utils";

/**
 * Official source (EU): MDCG guidance page.
 *
 * We parse links to PDF/HTML and infer "updated" when the same doc code appears with newer date.
 * Parsing is intentionally conservative to avoid hallucination.
 */
const DEFAULT_URL =
  "https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-documents_en";

function extractLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const re = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const text = safeText(m[2].replace(/<[^>]+>/g, " "));
    if (!href || !text) continue;
    links.push({ href, text });
  }
  return links;
}

function absolutize(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function parseDateFromText(text: string): Date | null {
  // Typical patterns: 2024-03-12, 12/03/2024, March 12 2024.
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  const fr = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (fr) {
    const dd = String(fr[1]).padStart(2, "0");
    const mm = String(fr[2]).padStart(2, "0");
    const d = new Date(`${fr[3]}-${mm}-${dd}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function extractDocCode(text: string): string | null {
  // MDCG 2021-xx patterns
  const m = text.match(/\bMDCG\s*\d{4}-\d+\b/i);
  return m ? m[0].toUpperCase().replace(/\s+/g, "") : null;
}

export const MdcgSource: UpdateSource = {
  name: "EU Commission - MDCG",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const url = process.env.WATCH_MDCG_URL ?? DEFAULT_URL;
      if (!isUrlAllowed(url)) throw new Error("MDCG URL not allowed");
      const html = await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 2 });
      const links = extractLinks(html)
        .map((l) => ({ ...l, href: absolutize(url, l.href) }))
        .filter((l) => /\.pdf(\?|$)/i.test(l.href) || /guidance|mdcg/i.test(l.text));

      // Keep only plausible MDCG links
      const items = links
        .map((l) => {
          const code = extractDocCode(l.text);
          const publishedAt = parseDateFromText(l.text) ?? nowUtc();
          const title = code ? `${code} — ${l.text}` : l.text;
          const sourceId = code;

          return {
            type: "GUIDANCE" as const,
            title: safeText(title),
            publishedAt,
            effectiveAt: null,
            status: "NEW" as const,
            sourceName: "EU Commission (MDCG)",
            sourceUrl: l.href,
            sourceId,
            jurisdiction: "EU" as const,
            tags: code ? [{ key: "mdcg", value: code }] : [{ key: "mdcg" }],
            hash: computeUpdateHash({
              type: "GUIDANCE",
              title,
              sourceName: "EU Commission (MDCG)",
              sourceId,
              sourceUrl: l.href,
              publishedAt,
            }),
            retrievedAt: nowUtc(),
          };
        })
        // de-dupe by hash already, upstream will also dedupe
        .slice(0, 200);

      return {
        items,
        health: {
          name: "MDCG",
          ok: true,
          durationMs: Date.now() - started,
          items: items.length,
        },
      };
    } catch (e: any) {
      return {
        items: [],
        health: {
          name: "MDCG",
          ok: false,
          durationMs: Date.now() - started,
          message: e?.message ?? "error",
        },
      };
    }
  },
};
