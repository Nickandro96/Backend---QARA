/** Normalise les références du corpus ISO historique pour toutes les routes UI. */
export function normalizeIsoReference<T extends Record<string, any>>(row: T): T {
  if (!row || String(row.article ?? "").trim()) return row;

  const key = String(row.questionKey ?? "");
  const title = String(row.title ?? "").trim();
  const clause = title.match(/^(?:ISO\s*(?:13485|9001)(?::\d{4})?\s*)?(\d+(?:\.\d+){0,3})\b/i)?.[1];
  if (!clause) return row;

  const standard = /^Q-13485-/i.test(key)
    ? "ISO 13485:2016"
    : /^Q-9001-/i.test(key)
      ? "ISO 9001:2015"
      : null;
  if (!standard) return row;

  return { ...row, article: `${standard} §${clause}` };
}
