import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { audits, sites, capa_actions } from "../../drizzle/schema";
import { buildScoringResult } from "../scoring/scoringEngine";
import { loadAuditScoringContext } from "../scoring/scoringRouter";
import { DEFAULT_SCORING_CONFIG } from "../scoring/types";
import { buildAuditReport } from "./reportBuilder";
import { buildGapRegisterCsv, buildActionPlanCsv } from "./csvExport";
import type { CapaAction, CapaReferentielImpacte } from "../capa/types";
import type { CapaStatus } from "../capa/types";
import type { QuestionRichFields } from "./types";

function toCapaAction(row: typeof capa_actions.$inferSelect): CapaAction {
  return {
    id: row.id,
    auditId: row.auditId,
    questionKey: row.questionKey,
    referentialCode: row.referentialCode,
    processName: row.processName,
    gravite: row.gravite as CapaAction["gravite"],
    criticality: row.criticality as CapaAction["criticality"],
    ecartIdentifie: row.ecartIdentifie,
    analyseCauseRacine: row.analyseCauseRacine,
    actionRecommandee: row.actionRecommandee,
    actionRetenue: row.actionRetenue,
    responsible: row.responsible,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    statut: row.statut as CapaStatus,
    preuveRealisation: row.preuveRealisation,
    dateVerificationEfficacite: row.dateVerificationEfficacite
      ? row.dateVerificationEfficacite.toISOString()
      : null,
    preuveEfficacite: row.preuveEfficacite,
    resultatEfficacite: row.resultatEfficacite as CapaAction["resultatEfficacite"],
    referentielsImpactes: safeJsonParse<CapaReferentielImpacte[]>(row.referentielsImpactes, []),
    priorite: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadReportInputs(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, auditId: number, userId: number) {
  const [audit] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);
  if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });

  const [site] = audit.siteId
    ? await db.select().from(sites).where(eq(sites.id, audit.siteId)).limit(1)
    : [null];

  const { scoringQuestions, scoringResponses, questionRows } = await loadAuditScoringContext(db, auditId, userId);
  const scoringResult = buildScoringResult(scoringQuestions, scoringResponses);

  const questionsByKey = new Map<string, QuestionRichFields>(
    questionRows
      .filter((q) => q.questionKey)
      .map((q) => [
        q.questionKey!,
        {
          auditVerifies: q.auditVerifies ?? null,
          explanationSimple: q.explanationSimple ?? null,
          concreteExample: q.concreteExample ?? null,
          conformityCriteria: safeJsonParse<Record<string, string> | null>(q.conformityCriteria, null),
          referenceStatus: q.referenceStatus ?? null,
          officialSource: q.officialSource ?? null,
        },
      ])
  );

  const capaRows = await db
    .select()
    .from(capa_actions)
    .where(and(eq(capa_actions.auditId, auditId), eq(capa_actions.userId, userId)));

  return { audit, site, scoringResult, capaActions: capaRows.map(toCapaAction), questionsByKey };
}

export const reportRouter = router({
  /** Génère le rapport d'audit complet (§2 SPEC-3), en un appel, sans saisie manuelle. */
  generate: protectedProcedure
    .input(
      z.object({
        auditId: z.number().int().positive(),
        niveau: z.enum(["synthetique", "detaille"]).default("detaille"),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { audit, site, scoringResult, capaActions, questionsByKey } = await loadReportInputs(
        db,
        input.auditId,
        ctx.user.id
      );

      const report = buildAuditReport({
        meta: {
          auditId: audit.id,
          organisationName: audit.clientOrganization ?? null,
          siteName: site?.name ?? audit.siteLocation ?? null,
          economicRole: audit.economicRole ?? null,
          referentialCodes: scoringResult.parReferentiel.map((r) => r.referentialCode),
          auditorName: audit.auditorName ?? null,
          auditorEmail: audit.auditorEmail ?? null,
          startDate: audit.startDate ? audit.startDate.toISOString() : null,
          endDate: audit.endDate ? audit.endDate.toISOString() : null,
          niveau: input.niveau,
        },
        scoringResult,
        capaActions,
        config: DEFAULT_SCORING_CONFIG,
        questionsByKey,
      });

      if (input.niveau === "synthetique") {
        return {
          meta: report.meta,
          syntheseExecutive: report.syntheseExecutive,
          radarParProcessus: report.radarParProcessus,
          mentionLegale: report.mentionLegale,
        };
      }

      return report;
    }),

  /** Export CSV du registre des écarts (§4/§5 SPEC-3). */
  exportGapRegisterCsv: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { scoringResult } = await loadReportInputs(db, input.auditId, ctx.user.id);
      return { csv: buildGapRegisterCsv(scoringResult.ecarts) };
    }),

  /** Export CSV du plan d'action CAPA (§4/§6 SPEC-3). */
  exportActionPlanCsv: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { capaActions } = await loadReportInputs(db, input.auditId, ctx.user.id);
      return { csv: buildActionPlanCsv(capaActions) };
    }),
});
