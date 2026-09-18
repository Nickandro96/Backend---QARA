import type { UpdateSource } from "../types";
import { fetchTextWithRetry } from "./_http";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { nowUtc, safeText, isUrlAllowed } from "../utils";

const OPEN_DATA_URL = "https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl";
const RELEVANT = /\b(?:ISO(?:\/IEC)?\s*)?(?:9001|13485|14971|19011|10993|11607|14155|15223|20417|62304|62366|27001)\b/i;

type IsoRow = { id?: number; reference?: string; title?: Record<string, string>; publicationDate?: string; currentStage?: number; edition?: number };

export function parseIsoOpenData(jsonl: string): IsoRow[] {
  const rows: IsoRow[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as IsoRow;
      if (RELEVANT.test(row.reference ?? "")) rows.push(row);
    } catch { /* one malformed row must not discard the daily dataset */ }
  }
  return rows;
}

export const IsoNewsSource: UpdateSource = {
  name: "ISO Open Data",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const url = process.env.WATCH_ISO_OPEN_DATA_URL ?? OPEN_DATA_URL;
      if (!isUrlAllowed(url)) throw new Error("URL ISO Open Data refusée");
      const payload = await fetchTextWithRetry(url, { timeoutMs: Math.max(ctx.timeoutMs, 30_000), retries: 1 });
      const items = parseIsoOpenData(payload).slice(0, 100).map((row) => {
        const reference = safeText(row.reference ?? `ISO-${row.id}`);
        const label = safeText(row.title?.fr ?? row.title?.en ?? "Métadonnées de norme ISO");
        const parsedDate = row.publicationDate ? new Date(row.publicationDate) : null;
        const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
        const sourceUrl = `https://www.iso.org/search.html?q=${encodeURIComponent(reference)}`;
        const title = `${reference} — ${label}`;
        return {
          type: "STANDARD" as const, title, publishedAt, effectiveAt: null, status: "UPDATED" as const,
          sourceName: "ISO Open Data", sourceUrl, sourceId: String(row.id ?? reference), jurisdiction: "EU" as const,
          tags: [{ key: "licence", value: "ODC-By-1.0" }, { key: "stage", value: String(row.currentStage ?? "") }, { key: "edition", value: String(row.edition ?? "") }],
          hash: computeUpdateHash({ type: "STANDARD", title: `${title}|${row.currentStage ?? ""}|${row.edition ?? ""}`, sourceName: "ISO Open Data", sourceId: String(row.id ?? reference), sourceUrl, publishedAt }),
          retrievedAt: nowUtc(),
        };
      });
      return { items, health: { name: "ISO Open Data", ok: true, durationMs: Date.now() - started, items: items.length } };
    } catch (e: any) {
      return { items: [], health: { name: "ISO Open Data", ok: false, durationMs: Date.now() - started, message: e?.message ?? "error" } };
    }
  },
};
