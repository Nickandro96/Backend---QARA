import type { UpdateSource } from "../types";
import { fetchTextWithRetry } from "./_http";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { nowUtc, safeText, isUrlAllowed } from "../utils";

/**
 * EUR-Lex (official): uses the MDR base act page and extracts "Corrigendum" and related documents.
 *
 * This is NOT a full legal graph crawler. It is designed to be:
 * - deterministic
 * - resilient
 * - "good enough" to detect new corrigenda / consolidated updates.
 */

const MDR_CELEX_URL = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0745";

function extractRelated(html: string): { title: string; href: string }[] {
  const out: { title: string; href: string }[] = [];
  const re = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const text = safeText(m[2].replace(/<[^>]+>/g, " "));
    if (!href || !text) continue;
    if (!/corrigendum|amend|modif|rectif/i.test(text)) continue;
    out.push({ href, title: text });
  }
  return out;
}

function absolutize(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export const EurLexMdrSource: UpdateSource = {
  name: "EUR-Lex (MDR)",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const enabled = (process.env.WATCH_ENABLE_EURLEX ?? "true").toLowerCase() === "true";
      if (!enabled) {
        return {
          items: [],
          health: { name: "EUR-Lex", ok: true, durationMs: Date.now() - started, items: 0, message: "disabled" },
        };
      }

      const url = process.env.WATCH_EURLEX_MDR_URL ?? MDR_CELEX_URL;
      if (!isUrlAllowed(url)) throw new Error("EUR-Lex URL not allowed");
      const html = await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 2 });
      const rel = extractRelated(html).slice(0, 100);
      const publishedAt = nowUtc();

      const items = rel.map((r) => {
        const abs = absolutize(url, r.href);
        const title = `MDR 2017/745 — ${r.title}`;
        const isCorr = /corrigendum|rectif/i.test(r.title);
        return {
          type: "REGULATION" as const,
          title: safeText(title),
          publishedAt,
          effectiveAt: null,
          status: isCorr ? ("CORRIGENDUM" as const) : ("UPDATED" as const),
          sourceName: "EUR-Lex",
          sourceUrl: abs,
          sourceId: abs,
          jurisdiction: "EU" as const,
          tags: [{ key: "mdr", value: "2017/745" }],
          hash: computeUpdateHash({
            type: "REGULATION",
            title,
            sourceName: "EUR-Lex",
            sourceId: abs,
            sourceUrl: abs,
            publishedAt,
          }),
          retrievedAt: nowUtc(),
        };
      });

      return {
        items,
        health: { name: "EUR-Lex", ok: true, durationMs: Date.now() - started, items: items.length },
      };
    } catch (e: any) {
      return {
        items: [],
        health: { name: "EUR-Lex", ok: false, durationMs: Date.now() - started, message: e?.message ?? "error" },
      };
    }
  },
};
