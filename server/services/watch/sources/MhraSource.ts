import type { UpdateSource } from "../types";
import { computeUpdateHash } from "../enrichment/Dedupe";
import { isUrlAllowed, nowUtc, safeText } from "../utils";
import { fetchTextWithRetry } from "./_http";
import { linkHref, parseAtomEntries, stableOfficialId, stripHtml, tagValue } from "./SourceParsing";

const SOURCE_ID = "mhra";
const ATOM_URL = "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom";

export function parseMhraAtom(xml: string) {
  return parseAtomEntries(xml).map((entry) => {
    const title = safeText(tagValue(entry, "title"));
    const sourceUrl = safeText(linkHref(entry));
    const rawContent = stripHtml(tagValue(entry, "summary") || tagValue(entry, "content"));
    const dateValue = tagValue(entry, "published") || tagValue(entry, "updated");
    const parsedDate = dateValue ? new Date(dateValue) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const officialId = safeText(tagValue(entry, "id")) || sourceUrl || stableOfficialId(SOURCE_ID, title, publishedAt);
    const haystack = `${title} ${rawContent}`.toLowerCase();
    const sourceType = haystack.includes("safety alert") ? "alert" : haystack.includes("guidance") ? "guidance" : haystack.includes("consultation") ? "notice" : "notice";
    // DB mapping: official_id <- officialId, language_source <- languageSource.
    return {
      type: sourceType === "guidance" ? "GUIDANCE" as const : "NOTICE" as const,
      title, publishedAt, effectiveAt: null, status: "NEW" as const,
      sourceName: "MHRA", sourceUrl, sourceId: officialId, officialId, rawContent,
      languageSource: "en", sourceRegistryId: SOURCE_ID, jurisdiction: "UK" as const,
      tags: [{ key: "source_type", value: sourceType }],
      hash: computeUpdateHash({ type: sourceType === "guidance" ? "GUIDANCE" : "NOTICE", title, sourceName: "MHRA", sourceId: officialId, sourceUrl, publishedAt }),
      retrievedAt: nowUtc(),
    };
  }).filter((item) => item.title && item.sourceUrl);
}

export const MhraSource: UpdateSource = {
  name: "MHRA",
  async fetchUpdates(ctx) {
    const started = Date.now();
    try {
      const url = process.env.WATCH_MHRA_ATOM_URL ?? ATOM_URL;
      if (!isUrlAllowed(url)) throw new Error("MHRA URL not allowed");
      const items = parseMhraAtom(await fetchTextWithRetry(url, { timeoutMs: ctx.timeoutMs, retries: 3 }));
      return { items, health: { name: "MHRA", ok: true, durationMs: Date.now() - started, items: items.length } };
    } catch (error: any) {
      return { items: [], health: { name: "MHRA", ok: false, durationMs: Date.now() - started, items: 0, message: error?.message ?? "error" } };
    }
  },
};
