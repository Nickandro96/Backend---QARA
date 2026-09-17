import { z } from "zod";
import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { audit_responses, questions, processus, referentiels } from "../../drizzle/schema";
import { buildScoringResult } from "./scoringEngine";
import type { ScoringQuestion, ScoringResponse, ResponseValue } from "./types";
import { fetchAuditScopedQuestions, getAuditContextInternal } from "../mdr-router";
import { normalizeResponseValue } from "../response-values";

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
  const raw = normalizeResponseValue(row.responseValue);
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
  const auditContext = await getAuditContextInternal(db, userId, auditId);
  const referentialIds: number[] = auditContext.referentialIds;
  if (referentialIds.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cet audit n'a aucun référentiel associé (audits.referentialIds vide).",
    });
  }

  // Source unique du périmètre : exactement les mêmes filtres rôle/processus/
  // échantillonnage que le questionnaire et la progression de l'audit.
  // L'ancienne requête prenait toutes les questions actives du référentiel
  // (71 pour l'audit 41) alors que le questionnaire n'en exposait que 65.
  const questionRows: Array<typeof questions.$inferSelect> = await fetchAuditScopedQuestions(db, {
    auditId,
    userId,
    economicRole: auditContext.economicRole,
    economicRolesFromOnboarding: auditContext.economicRolesFromOnboarding,
    situationTags: auditContext.situationTags,
    processIds: auditContext.processIds,
    referentialIds,
    select: getTableColumns(questions),
  });
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
