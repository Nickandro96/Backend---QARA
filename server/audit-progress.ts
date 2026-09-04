export const FINAL_RESPONSE_VALUES = new Set([
  "compliant", "partial", "non_compliant", "not_applicable",
  "0", "1", "2", "3", "4", "5",
]);

export type AuditProgress = {
  totalScopedQuestions: number;
  totalApplicableQuestions: number;
  finalApplicableResponses: number;
  draftResponses: number;
  notApplicableQuestions: number;
  unansweredApplicableQuestions: number;
  percentage: number;
  isComplete: boolean;
};

/** Source unique et pure du calcul d'avancement d'un audit. */
export function calculateAuditProgress(
  scopedQuestionKeys: Iterable<string>,
  responses: Array<{ questionKey: string; responseValue?: string | null }>,
): AuditProgress {
  const keys = new Set(Array.from(scopedQuestionKeys, String));
  const responseByKey = new Map<string, string>();
  for (const response of responses) {
    const key = String(response.questionKey);
    if (!keys.has(key) || responseByKey.has(key)) continue;
    responseByKey.set(key, String(response.responseValue ?? "in_progress"));
  }

  let finalApplicableResponses = 0;
  let draftResponses = 0;
  let notApplicableQuestions = 0;
  for (const key of keys) {
    const value = responseByKey.get(key);
    if (value === "not_applicable") notApplicableQuestions += 1;
    else if (value && FINAL_RESPONSE_VALUES.has(value)) finalApplicableResponses += 1;
    else if (value) draftResponses += 1;
  }

  const totalApplicableQuestions = keys.size - notApplicableQuestions;
  const unansweredApplicableQuestions = Math.max(totalApplicableQuestions - finalApplicableResponses, 0);
  const percentage = totalApplicableQuestions === 0
    ? (keys.size > 0 && notApplicableQuestions === keys.size ? 100 : 0)
    : Math.round((finalApplicableResponses / totalApplicableQuestions) * 10_000) / 100;

  return {
    totalScopedQuestions: keys.size,
    totalApplicableQuestions,
    finalApplicableResponses,
    draftResponses,
    notApplicableQuestions,
    unansweredApplicableQuestions,
    percentage,
    isComplete: keys.size > 0 && unansweredApplicableQuestions === 0,
  };
}
