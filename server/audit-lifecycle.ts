import { TRPCError } from "@trpc/server";
import { calculateAuditProgress } from "./audit-progress";

export function isAuditClosed(status: unknown): boolean {
  return status === "completed" || status === "closed";
}

export function assertAuditMutable(audit: { status?: unknown }): void {
  if (isAuditClosed(audit.status)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Cet audit est terminé. Réouvrez-le explicitement avant toute modification.",
    });
  }
}

export function assertAuditDeletable(evidence: { responses: number; capas: number }): void {
  if (evidence.responses > 0 || evidence.capas > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Suppression refusée : cet audit contient des réponses ou des preuves de traitement CAPA.",
    });
  }
}

export function assertAuditCanStart(audit: { status?: unknown }): void {
  assertAuditMutable(audit);
  if (audit.status === "cancelled") {
    throw new TRPCError({ code: "CONFLICT", message: "Un audit annulé ne peut pas être démarré." });
  }
}

export function assertAuditCanComplete(audit: { status?: unknown }): void {
  if (isAuditClosed(audit.status)) {
    throw new TRPCError({ code: "CONFLICT", message: "Cet audit est déjà terminé." });
  }
  if (audit.status !== "in_progress") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Seul un audit en cours peut être terminé.",
    });
  }
}

export function assertAuditCanReopen(audit: { status?: unknown }, reason?: string): void {
  if (audit.status === "closed") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Un audit clôturé ne peut pas être rouvert." });
  }
  if (audit.status === "completed" && !reason?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Un motif de réouverture est obligatoire." });
  }
}

export function assertQuestionBelongsToAudit(
  questionKey: string,
  scopedQuestions: Array<{ questionKey?: unknown }>
): void {
  const found = scopedQuestions.some((question) => question.questionKey === questionKey);
  if (!found) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cette question n’appartient pas au questionnaire de l’audit.",
    });
  }
}

export function resolveAuditProcessId(
  questionKey: string,
  requestedProcessId: unknown,
  scopedQuestions: Array<{ questionKey?: unknown; processId?: unknown }>
): number | null {
  assertQuestionBelongsToAudit(questionKey, scopedQuestions);
  const question = scopedQuestions.find((item) => item.questionKey === questionKey);
  const expected = Number(question?.processId);
  const requested = Number(requestedProcessId);
  const expectedId = Number.isInteger(expected) && expected > 0 ? expected : null;
  const requestedId = Number.isInteger(requested) && requested > 0 ? requested : null;
  if (requestedProcessId !== null && requestedProcessId !== undefined && requestedProcessId !== "" && requestedId === null) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Le processus fourni doit être un identifiant numérique valide." });
  }
  if (expectedId !== null && requestedId !== null && expectedId !== requestedId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Le processus fourni ne correspond pas à la question de l’audit.",
    });
  }
  return expectedId ?? requestedId;
}

export function assertAuditComplete(
  scopedQuestions: Array<{ questionKey?: unknown }>,
  responses: Array<{ questionKey?: unknown; responseValue?: unknown }>
): { answered: number; expected: number } {
  const requiredKeys = new Set(
    scopedQuestions.map((question) => String(question.questionKey ?? "").trim()).filter(Boolean)
  );
  if (requiredKeys.size === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Impossible de terminer un audit sans questionnaire applicable.",
    });
  }

  const progress = calculateAuditProgress(
    requiredKeys,
    responses.map((response) => ({
      questionKey: String(response.questionKey ?? "").trim(),
      responseValue: String(response.responseValue ?? "").toLowerCase(),
    })),
  );
  if (!progress.isComplete) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Audit incomplet : ${progress.finalApplicableResponses}/${progress.totalApplicableQuestions} questions applicables finalisées.`,
    });
  }
  return { answered: progress.finalApplicableResponses, expected: progress.totalApplicableQuestions };
}
