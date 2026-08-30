import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { stableOfficialId } from "./SourceParsing";

const SOURCE_ID = "fda-medwatch";
const ENDPOINT = "https://api.fda.gov/device/enforcement.json";
const RECALLS_URL = "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts";

function parseYyyyMmDd(value: string | undefined): Date | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseFdaMedwatchPayload(raw: string) {
  const data = JSON.parse(raw) as { results?: any[] };
  return (data.results ?? []).map((row) => {
    const publishedAt = parseYyyyMmDd(row.recall_initiation_date);
    const title = safeText(`Rappel DM - ${row.product_description ?? "produit non renseigne"}`).slice(0, 200);
    const officialId = safeText(row.recall_number) || stableOfficialId(SOURCE_ID, title, publishedAt);
    const sourceUrl = row.url ? safeText(String(row.url)) : RECALLS_URL;
    const rawContent = safeText([
      `Motif : ${row.reason_for_recall ?? ""}`,
      `Produit : ${row.product_description ?? ""}`,
      `Distribution : ${row.distribution_pattern ?? ""}`,
      `Classe : ${row.classification ?? ""}`,
    ].join("\n"));
    // DB mapping: official_id <- officialId, language_source <- languageSource.
    return {
      type: "NOTICE" as const, title, publishedAt, effectiveAt: null, status: "NEW" as const,
      sourceName: "FDA MedWatch", sourceUrl, sourceId: officialId, officialId, rawContent,
      languageSource: "en", sourceRegistryId: SOURCE_ID, jurisdiction: "US" as const,
      tags: [{ key: "source_type", value: "recall" }, { key: "classification", value: row.classification ?? "" }],
      hash: computeUpdateHash({ type: "NOTICE", title, sourceName: "FDA MedWatch", sourceId: officialId, sourceUrl, publishedAt }),
      retrievedAt: nowUtc(),
    };
  }).filter((item) => item.officialId && item.sourceUrl);
}

export const FdaMedwatchSource: UpdateSource = {
  name: "FDA MedWatch",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const params = new URLSearchParams({ limit: "20", sort: "recall_initiation_date:desc", search: "status:Ongoing" });
      const url = `${process.env.WATCH_FDA_MEDWATCH_URL ?? ENDPOINT}?${params}`;
      if (!isUrlAllowed(url)) throw new Error("FDA MedWatch URL not allowed");
      const items = parseFdaMedwatchPayload(await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 3 }));
      return { items, health: { name: "FDA MedWatch", ok: true, durationMs: Date.now() - started, items: items.length } };
    } catch (error: any) {
      return { items: [], health: { name: "FDA MedWatch", ok: false, durationMs: Date.now() - started, items: 0, message: error?.message ?? "error" } };
    }
  },
};
