// Backend---QARA-main/server/audit-router.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb, createAudit, getAudits, getAuditById, deleteAudit } from "./db";
import { audits, sites } from "../drizzle/schema";
import { computeGenericAuditStats } from "./audit-scoring";
import { safeParseArray } from "./mdr-router";

/**
 * Filtre en mémoire par referentialId : AuditSelector.tsx (frontend) passe
 * `referentialId` à `audit.list`, mais db.getAudits() ne filtre que par
 * status/siteId — le paramètre était silencieusement ignoré (zod sans
 * .strict() ne rejette pas les clés inconnues, donc aucune erreur, juste un
 * filtre qui ne filtrait rien). Le champ `referentialIds` est un JSON stocké
 * en chaîne (voir safeParseArray) ; filtrer en JS ici plutôt qu'en SQL,
 * volumes par utilisateur trop faibles pour que ça compte.
 */
function filterByReferentialId(rows: any[], referentialId?: number) {
  if (referentialId === undefined) return rows;
  return rows.filter((a: any) => safeParseArray(a.referentialIds).map(Number).includes(referentialId));
}

export const auditRouter = router({
  /**
   * Frontend expects: trpc.audit.getRecentAudits({ limit })
   */
  getRecentAudits: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(5) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select({
          id: audits.id,
          name: audits.name,
          auditType: audits.type,
          status: audits.status,
          startDate: audits.startDate,
          endDate: audits.endDate,
          siteName: sites.name,
        })
        .from(audits)
        .leftJoin(sites, eq(audits.siteId, sites.id))
        .where(eq(audits.userId, ctx.user.id))
        .orderBy(desc(audits.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /**
   * IMPORTANT: several frontend pages/components call `trpc.audit.create`.
   * Without this procedure, the UI loops with NOT_FOUND 404.
   *
   * This procedure is a thin wrapper over db.createAudit().
   */
  create: protectedProcedure
    .input(
      z.object({
        auditType: z.string().min(1),
        name: z.string().min(2),
        referentialIds: z.array(z.number()).default([]),
        siteId: z.number().int().positive().optional(),
        economicRole: z.string().optional(),
        processIds: z.array(z.number()).optional(),
        auditorName: z.string().optional(),
        auditorEmail: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = await createAudit({
        userId: ctx.user.id,
        name: input.name,
        type: input.auditType,
        siteId: input.siteId ?? null,
        status: "draft",
        economicRole: input.economicRole ?? null,
        processIds: input.processIds ?? null,
        referentialIds: input.referentialIds ?? null,
        auditorName: input.auditorName ?? null,
        auditorEmail: input.auditorEmail ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        // notes can be stored later; ignored safely for now
      });

      return { auditId: created.id };
    }),

  /**
   * Frontend expects: trpc.audit.list() (AuditSelector.tsx) et
   * trpc.audit.listAudits() (AuditsList.tsx) — deux noms différents pour le
   * même besoin côté frontend legacy. Alias, tous deux vers db.getAudits
   * (déjà utilisée par audits.list, le routeur pluriel).
   */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "planned", "in_progress", "completed", "closed", "cancelled"]).optional(),
          siteId: z.number().int().positive().optional(),
          referentialId: z.number().int().positive().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const rows = await getAudits({ userId: ctx.user.id, status: input?.status, siteId: input?.siteId });
      return filterByReferentialId(rows, input?.referentialId);
    }),

  listAudits: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "planned", "in_progress", "completed", "closed", "cancelled"]).optional(),
          siteId: z.number().int().positive().optional(),
          referentialId: z.number().int().positive().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const rows = await getAudits({ userId: ctx.user.id, status: input?.status, siteId: input?.siteId });
      return filterByReferentialId(rows, input?.referentialId);
    }),

  /**
   * Frontend expects: trpc.audit.getById({ id }) (AuditDetail.tsx)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const audit = await getAuditById(input.id, ctx.user.id);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit non trouvé" });
      return audit;
    }),

  /**
   * Frontend expects: trpc.audit.delete({ id }) (AuditHistory.tsx). Vérifie
   * la propriété avant suppression (db.deleteAudit ne filtre pas par
   * userId — voir server/db.ts).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const audit = await getAuditById(input.id, ctx.user.id);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit non trouvé" });
      await deleteAudit(input.id);
      return { success: true };
    }),

  /**
   * Frontend expects: trpc.audit.get({ auditId }) (AuditResults.tsx) — audit
   * + score calculé à la volée (même barème que mdr/iso getAuditDashboard),
   * scopé dynamiquement par référentiel/rôle (jamais d'ID en dur).
   */
  get: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { audit, stats, score } = await computeGenericAuditStats(db, ctx.user.id, input.auditId);
      return { ...audit, score, stats };
    }),

  /**
   * Frontend expects: trpc.audit.getStats({ auditId }) (AuditResults.tsx)
   */
  getStats: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { stats, score } = await computeGenericAuditStats(db, ctx.user.id, input.auditId);
      return { ...stats, score };
    }),

  /**
   * Frontend expects: trpc.audit.getScore({ auditId }) (Reports.tsx) —
   * MAIS l'appel réel (Reports.tsx:18) est `getScore.useQuery({}, ...)`,
   * sans auditId : la page veut un score global agrégé (variable nommée
   * `globalScore`, champs lus ensuite : `.score`, `.conforme`, `.nok`,
   * `.na` — voir Reports.tsx:95-107), pas le score d'un audit précis.
   * auditId rendu optionnel : fourni -> score de cet audit ; omis -> moyenne
   * sur tous les audits de l'utilisateur, agrégée avec les noms de champs
   * exacts attendus par cette page.
   */
  getScore: protectedProcedure
    .input(z.object({ auditId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (input?.auditId !== undefined) {
        const { score, stats } = await computeGenericAuditStats(db, ctx.user.id, input.auditId);
        return {
          score,
          total: stats.totalQuestions,
          answered: stats.answered,
          conforme: stats.compliant,
          nok: stats.non_compliant,
          na: stats.not_applicable,
          progress: stats.totalQuestions > 0 ? Math.round((stats.answered / stats.totalQuestions) * 1000) / 10 : 0,
        };
      }

      const userAudits = await getAudits({ userId: ctx.user.id });
      let conforme = 0;
      let nok = 0;
      let na = 0;
      let total = 0;
      let answered = 0;
      const scores: number[] = [];

      for (const audit of userAudits) {
        try {
          const { score, stats } = await computeGenericAuditStats(db, ctx.user.id, (audit as any).id);
          if (stats.answered === 0) continue;
          scores.push(score);
          conforme += stats.compliant;
          nok += stats.non_compliant;
          na += stats.not_applicable;
          total += stats.totalQuestions;
          answered += stats.answered;
        } catch {
          // audit sans scope résolvable (ex. brouillon jamais rattaché à un
          // référentiel) : exclu de l'agrégat plutôt que de faire échouer
          // toute la page.
        }
      }

      const score = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : 0;
      const progress = total > 0 ? Math.round((answered / total) * 1000) / 10 : 0;
      return { score, conforme, nok, na, total, answered, progress };
    }),
});
