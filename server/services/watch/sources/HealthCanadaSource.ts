import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { stableOfficialId } from "./SourceParsing";

const SOURCE_ID = "health-canada";
const ENDPOINT = "https://recalls-rappels.canada.ca/en/api/recall-alert";

function firstValue(row: any, keys: string[]): string {
  for (const key of keys) if (row[key]) return String(row[key]);
  return "";
}

export function parseHealthCanadaPayload(raw: string) {
  const data = JSON.parse(raw);
  const rows = Array.isArray(data) ? data : data.results ?? data.data ?? [];
  return rows.map((row: any) => {
    const officialId = safeText(firstValue(row, ["recall_id", "id", "recallId"])) || stableOfficialId(SOURCE_ID, firstValue(row, ["title", "title_en", "title_fr"]), null);
    const title = safeText(firstValue(row, ["title", "title_en", "title_fr"]));
    const dateValue = firstValue(row, ["date_issued", "date", "published_date"]);
    const parsedDate = dateValue ? new Date(Number.isFinite(Number(dateValue)) ? Number(dateValue) * 1000 : dateValue) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const sourceUrl = `https://recalls-rappels.canada.ca/en/alert-recall/${officialId}`;
    const rawContent = safeText(`${firstValue(row, ["description", "summary", "description_en"])}\n${firstValue(row, ["corrective_action", "correctiveAction"])}`);
    const haystack = `${title} ${rawContent}`.toLowerCase();
    const sourceType = haystack.includes("recall") || haystack.includes("rappel") ? "recall" : haystack.includes("safety") ? "alert" : "notice";
    // DB mapping: official_id <- officialId, language_source <- languageSource.
    return {
      type: "NOTICE" as const, title, publishedAt, effectiveAt: null, status: "NEW" as const,
      sourceName: "Health Canada", sourceUrl, sourceId: officialId, officialId, rawContent,
      languageSource: "en", sourceRegistryId: SOURCE_ID, jurisdiction: "UK" as const,
      tags: [{ key: "market", value: "CA" }, { key: "source_type", value: sourceType }],
      hash: computeUpdateHash({ type: "NOTICE", title, sourceName: "Health Canada", sourceId: officialId, sourceUrl, publishedAt }),
      retrievedAt: nowUtc(),
    };
  }).filter((item: any) => item.officialId && item.title);
}

export const HealthCanadaSource: UpdateSource = {
  name: "Health Canada",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const params = new URLSearchParams({ cat: "3", lim: "20", iss: "desc" });
      const url = `${process.env.WATCH_HEALTH_CANADA_URL ?? ENDPOINT}?${params}`;
      if (!isUrlAllowed(url)) throw new Error("Health Canada URL not allowed");
      const items = parseHealthCanadaPayload(await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 3 }));
      return { items, health: { name: "Health Canada", ok: true, durationMs: Date.now() - started, items: items.length } };
    } catch (error: any) {
      return { items: [], health: { name: "Health Canada", ok: false, durationMs: Date.now() - started, items: 0, message: error?.message ?? "error" } };
    }
  },
};
