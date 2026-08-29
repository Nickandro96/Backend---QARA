import type { RegulatoryUpdate } from "../types";
import { sha256, safeText } from "../utils";

export function computeUpdateHash(input: {
  type: RegulatoryUpdate["type"];
  title: string;
  sourceName: string;
  sourceId: string | null;
  sourceUrl: string;
  publishedAt: Date | null;
}): string {
  // Stable hash for dedupe across refresh runs.
  const key = [
    input.type,
    safeText(input.title).toLowerCase(),
    input.sourceName.toLowerCase(),
    (input.sourceId ?? "").toLowerCase(),
    input.sourceUrl.toLowerCase(),
    input.publishedAt?.toISOString().slice(0, 10) ?? "unknown-date",
  ].join("|");
  return sha256(key);
}

export function computeOfficialDedupeKey(input: {
  sourceRegistryId: string | null;
  officialId: string | null;
  hash: string;
}): string {
  return input.sourceRegistryId && input.officialId
    ? `${input.sourceRegistryId}::${input.officialId}`
    : `legacy::${input.hash}`;
}

export function dedupeByHash<T extends { hash: string }>(items: T[]): { unique: T[]; duplicates: T[] } {
  const seen = new Set<string>();
  const unique: T[] = [];
  const duplicates: T[] = [];

  for (const it of items) {
    if (seen.has(it.hash)) duplicates.push(it);
    else {
      seen.add(it.hash);
      unique.push(it);
    }
  }
  return { unique, duplicates };
}
