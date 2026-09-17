export type CanonicalResponseValue =
  | "compliant"
  | "partial"
  | "non_compliant"
  | "not_applicable"
  | "in_progress";

/** Canonicalise les valeurs historiques/françaises avant tout calcul métier. */
export function normalizeResponseValue(value: unknown): CanonicalResponseValue | string {
  const normalized = String(value ?? "in_progress").trim().toLowerCase().replace(/[ -]+/g, "_");
  if (["partial", "partiel", "partially_compliant", "partiellement_conforme"].includes(normalized)) return "partial";
  if (["non_compliant", "non_conforme", "nonconforme", "noncompliant", "nok", "nc"].includes(normalized)) return "non_compliant";
  if (["compliant", "conforme", "yes", "oui"].includes(normalized)) return "compliant";
  if (["not_applicable", "non_applicable", "na", "n_a"].includes(normalized)) return "not_applicable";
  if (["in_progress", "draft", "brouillon"].includes(normalized)) return "in_progress";
  return normalized;
}

export function classifyNonConformityValue(value: unknown): "non_conforme" | "partiel" | null {
  const normalized = normalizeResponseValue(value);
  if (normalized === "partial") return "partiel";
  if (normalized === "non_compliant") return "non_conforme";
  return null;
}
