import type { UpdateSource } from "../types";
import { fetchTextWithRetry } from "./_http";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { nowUtc, safeText, isUrlAllowed } from "../utils";

/**
 * Official EU list of harmonised standards (Medical Devices).
 *
 * The Commission page changes structure from time to time.
 * We parse conservatively:
 * - find occurrences of EN ISO xxxx:yyyy (+Amendments)
 * - try to capture dates nearby (JO L reference sometimes)
 */
const DEFAULT_URL = "https://single-market-economy.ec.europa.eu/single-market/european-standards/harmonised-standards/medical-devices_en";

function extractEnIsoTokens(html: string): string[] {
  const set = new Set<string>();
  const re = /\bEN\s+ISO\s+\d{3,6}(?:-\d+)?\s*:\s*\d{4}(?:\+A\d+)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    set.add(safeText(m[0]).replace(/\s+/g, " "));
  }
  return Array.from(set);
}

function parsePublishedAt(html: string): Date {
  // fallback: today
  // Some pages include "Last update".
  const m = html.match(/Last\s+update\s*:?\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/i);
  if (m) {
    const d = new Date(`${m[1]} ${m[2]} ${m[3]} UTC`);
    if (!isNaN(d.getTime())) return d;
  }
  return nowUtc();
}

export const HarmonisedStandardsSource: UpdateSource = {
  name: "EU Commission - Harmonised Standards",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const url = process.env.WATCH_HARMONISED_STANDARDS_URL ?? DEFAULT_URL;
      if (!isUrlAllowed(url)) throw new Error("Standards URL not allowed");
      const html = await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 2 });
      const tokens = extractEnIsoTokens(html);
      const publishedAt = parsePublishedAt(html);

      const items = tokens.slice(0, 250).map((token) => {
        const title = `${token} — Harmonised standard (MDR)`;
        return {
          type: "STANDARD" as const,
          title: safeText(title),
          publishedAt,
          effectiveAt: null,
          status: "NEW" as const,
          sourceName: "EU Commission (Harmonised standards)",
          sourceUrl: url,
          sourceId: token,
          jurisdiction: "EU" as const,
          tags: [{ key: "standard", value: token }],
          hash: computeUpdateHash({
            type: "STANDARD",
            title,
            sourceName: "EU Commission (Harmonised standards)",
            sourceId: token,
            sourceUrl: url,
            publishedAt,
          }),
          retrievedAt: nowUtc(),
        };
      });

      return {
        items,
        health: {
          name: "HarmonisedStandards",
          ok: true,
          durationMs: Date.now() - started,
          items: items.length,
        },
      };
    } catch (e: any) {
      return {
        items: [],
        health: {
          name: "HarmonisedStandards",
          ok: false,
          durationMs: Date.now() - started,
          message: e?.message ?? "error",
        },
      };
    }
  },
};
