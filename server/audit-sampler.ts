export const SAMPLER_VERSION = "1.0";

export type SampleMode = "rapid" | "standard" | "in_depth" | "complete";

const TARGETS: Record<Exclude<SampleMode, "complete">, number> = {
  rapid: 14,
  standard: 30,
  in_depth: 50,
};

function rank(question: any): number {
  const criticality = String(question.criticality ?? "").toLowerCase();
  const priority = criticality === "critical" ? 0 : criticality === "high" ? 1 : criticality === "medium" ? 2 : 3;
  return priority * 1_000_000 + Number(question.displayOrder ?? question.id ?? 0);
}

/** Échantillonnage stable : une question par processus, puis priorité à la criticité. */
export function sampleAuditQuestions<T extends Record<string, any>>(questions: T[], mode: SampleMode | null | undefined): T[] {
  const normalizedMode: SampleMode = mode === "rapid" || mode === "standard" || mode === "in_depth" ? mode : "complete";
  if (normalizedMode === "complete") return [...questions];
  const target = Math.min(TARGETS[normalizedMode], questions.length);
  if (questions.length <= target) return [...questions];

  const sorted = [...questions].sort((a, b) => rank(a) - rank(b));
  const selected: T[] = [];
  const selectedIds = new Set<unknown>();
  const processes = new Set<unknown>();
  for (const question of sorted) {
    const process = question.processId ?? "generic";
    if (!processes.has(process)) {
      processes.add(process);
      selected.push(question);
      selectedIds.add(question.id ?? question.questionKey);
      if (selected.length === target) return selected.sort((a, b) => rank(a) - rank(b));
    }
  }
  for (const question of sorted) {
    const id = question.id ?? question.questionKey;
    if (!selectedIds.has(id)) {
      selected.push(question);
      selectedIds.add(id);
      if (selected.length === target) break;
    }
  }
  return selected.sort((a, b) => rank(a) - rank(b));
}
