import type { UpdateSource, RegulatoryUpdateType } from "../types";
import { fetchTextWithRetry } from "./_http";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";

const ENDPOINT = "https://www.federalregister.gov/api/v1/documents.json";

export function parseFederalRegisterPayload(raw: string) {
  const data = JSON.parse(raw) as { results?: any[] };
  return (data.results ?? []).filter((row) => row.document_number && row.title && row.html_url).map((row) => {
    const publishedAt = row.publication_date ? new Date(`${row.publication_date}T00:00:00Z`) : null;
    const type: RegulatoryUpdateType = row.type === "Rule" ? "REGULATION" : row.type === "Proposed Rule" ? "CONSULTATION" : "NOTICE";
    const title = safeText(row.title);
    const sourceUrl = String(row.html_url);
    const officialId = String(row.document_number);
    return {
      type, title, publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      effectiveAt: row.effective_on ? new Date(`${row.effective_on}T00:00:00Z`) : null,
      status: "NEW" as const, sourceName: "US Federal Register", sourceUrl, sourceId: officialId,
      jurisdiction: "US" as const, tags: [{ key: "agency", value: (row.agencies ?? []).map((a: any) => a.name).join(", ") }],
      hash: computeUpdateHash({ type, title, sourceName: "US Federal Register", sourceId: officialId, sourceUrl, publishedAt }),
      retrievedAt: nowUtc(),
    };
  });
}

export const FederalRegisterSource: UpdateSource = {
  name: "US Federal Register",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const params = new URLSearchParams();
      params.set("per_page", "100");
      params.append("conditions[agencies][]", "food-and-drug-administration");
      params.append("conditions[term]", "medical device");
      const url = `${process.env.WATCH_FEDERAL_REGISTER_URL ?? ENDPOINT}?${params}`;
      if (!isUrlAllowed(url)) throw new Error("Federal Register URL not allowed");
      const items = parseFederalRegisterPayload(await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 3 }));
      return { items, health: { name: "FederalRegister", ok: true, durationMs: Date.now() - started, items: items.length } };
    } catch (error: any) {
      return { items: [], health: { name: "FederalRegister", ok: false, durationMs: Date.now() - started, items: 0, message: error?.message ?? "error" } };
    }
  },
};
