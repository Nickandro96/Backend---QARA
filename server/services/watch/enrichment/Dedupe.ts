import type { RegulatoryUpdate } from "../types";
import { sha256, safeText } from "../utils";

export function computeUpdateHash(input: {
  type: RegulatoryUpdate["type"];
  title: string;
  sourceName: string;
  sourceId: string | null;
  sourceUrl: string;
  publishedAt: Date;
}): string {
  // Stable hash for dedupe across refresh runs.
  const key = [
    input.type,
    safeText(input.title).toLowerCase(),
    input.sourceName.toLowerCase(),
    (input.sourceId ?? "").toLowerCase(),
    input.sourceUrl.toLowerCase(),
    input.publishedAt.toISOString().slice(0, 10),
  ].join("|");
  return sha256(key);
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
