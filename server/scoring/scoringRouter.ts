import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { audits, audit_responses, questions, processus, referentiels } from "../../drizzle/schema";
import { buildScoringResult } from "./scoringEngine";
import type { ScoringQuestion, ScoringResponse, ResponseValue } from "./types";

/**
 * Reconstruit les objets `ScoringQuestion`/`ScoringResponse` (voir ./types.ts)
 * à partir des lignes DB, pour les passer au moteur pur (./scoringEngine.ts).
 *
 * Convention de stockage pour les questions `maturity_0_5` : `responseValue`
 * porte soit `not_applicable`/`in_progress`, soit le niveau 0-5 sous forme de
 * chaîne ("0".."5") — il n'existe pas de colonne numérique dédiée dans
 * `audit_responses` (voir docs/audit/08-moteur-scoring.md).
 */
function toScoringResponse(row: { questionKey: string; responseValue: string | null }): ScoringResponse {
  const raw = row.responseValue ?? "in_progress";
  if (raw === "not_applicable" || raw === "in_progress") {
    return { questionKey: row.questionKey, responseValue: raw as ResponseValue };
  }
  const level = Number(raw);
  if (!Number.isNaN(level) && level >= 0 && level <= 5) {
    return { questionKey: row.questionKey, responseValue: "in_progress", maturityLevel: level };
  }
  return { questionKey: row.questionKey, responseValue: raw as ResponseValue };
}

/**
 * Reconstruit le contexte de scoring d'un audit (questions + réponses au
 * format du moteur pur) à partir des lignes DB. Partagé avec
 * server/capa/capaRouter.ts (Lot 3), qui a besoin des mêmes questions/réponses
 * pour générer le plan d'action depuis les écarts détectés.
 */
export async function loadAuditScoringContext(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  auditId: number,
  userId: number
) {
  const [audit] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);
  if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });

  const referentialIds: number[] = safeJsonParse(audit.referentialIds, []);
  if (referentialIds.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cet audit n'a aucun référentiel associé (audits.referentialIds vide).",
    });
  }

  const questionRows = await db.select().from(questions).where(inArray(questions.referentialId, referentialIds));
  const processRows = await db.select().from(processus);
  const processNameById = new Map(processRows.map((p) => [p.id, p.name]));

  const referentialRows = await db.select().from(referentiels).where(inArray(referentiels.id, referentialIds));
  const referentialCodeById = new Map(referentialRows.map((r) => [r.id, r.code ?? String(r.id)]));

  const scoringQuestions: ScoringQuestion[] = questionRows
    .filter((q) => q.questionKey && q.criticality && q.questionType)
    .map((q) => ({
      questionKey: q.questionKey!,
      referentialCode: q.referentialId !== null ? referentialCodeById.get(q.referentialId) ?? String(q.referentialId) : "?",
      processName: q.processId !== null ? processNameById.get(q.processId) ?? null : null,
      criticality: q.criticality as ScoringQuestion["criticality"],
      questionType: q.questionType as ScoringQuestion["questionType"],
      typicalNc: safeJsonParse(q.typicalNc, []),
      mappings: safeJsonParse(q.mappings, []),
    }));

  const responseRows = await db
    .select()
    .from(audit_responses)
    .where(and(eq(audit_responses.auditId, auditId), eq(audit_responses.userId, userId)));

  const scoringResponses: ScoringResponse[] = responseRows.map((r) =>
    toScoringResponse({ questionKey: r.questionKey, responseValue: r.responseValue })
  );

  return { scoringQuestions, scoringResponses, questionRows };
}

export const scoringRouter = router({
  compute: protectedProcedure.input(z.object({ auditId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const { scoringQuestions, scoringResponses } = await loadAuditScoringContext(db, input.auditId, ctx.user.id);

    return buildScoringResult(scoringQuestions, scoringResponses);
  }),
});
