import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { audits, auditResponses, processus, questions, referentiels, sites } from "./db/schema";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const ISO_STANDARD_MAP = {
  ISO9001: { label: "ISO 9001", referentialId: 2 },
  ISO13485: { label: "ISO 13485", referentialId: 3 },
} as const;

type IsoCode = keyof typeof ISO_STANDARD_MAP;

const safeParseArray = (value: unknown): number[] => {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return safeParseArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
};

export const isoRouter = router({
  getStandards: publicProcedure.query(() =>
    (Object.entries(ISO_STANDARD_MAP) as [IsoCode, (typeof ISO_STANDARD_MAP)[IsoCode]][]).map(([code, cfg]) => ({
      code,
      label: cfg.label,
      referentialId: cfg.referentialId,
    })),
  ),

  getProcesses: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(processus).orderBy(processus.name);
  }),

  getSites: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(sites).orderBy(sites.name);
  }),

  createOrUpdateAuditDraft: protectedProcedure
    .input(
      z.object({
        auditId: z.number().optional(),
        standardCode: z.enum(["ISO9001", "ISO13485"]),
        siteId: z.number(),
        organisationId: z.number().nullable().optional(),
        name: z.string().min(1),
        scope: z.string().min(1),
        method: z.string().min(1),
        processMode: z.enum(["all", "select"]),
        processIds: z.array(z.number()).default([]),
        startDate: z.string(),
        endDate: z.string().optional().nullable(),
        auditorName: z.string().min(1),
        auditeeName: z.string().min(1),
        auditeeEmail: z.string().email(),
        entityName: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        exclusions: z.string().optional().nullable(),
        productFamilies: z.string().optional().nullable(),
        markets: z.string().optional().nullable(),
        auditTeam: z.string().optional().nullable(),
        standardsVersion: z.string().optional().nullable(),
        status: z.enum(["draft", "in_progress", "completed"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.processMode === "select" && input.processIds.length === 0) {
        throw new Error("processIds is required when processMode=select");
      }
      const referentialId = ISO_STANDARD_MAP[input.standardCode].referentialId;
      const payload = {
        userId: ctx.session.user.id,
        siteId: input.siteId,
        organisationId: input.organisationId ?? null,
        name: input.name,
        scope: input.scope,
        method: input.method,
        referentialIds: JSON.stringify([referentialId]),
        processIds: JSON.stringify(input.processMode === "all" ? [] : input.processIds),
        economicRole: null,
        status: input.status ?? "draft",
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        auditorName: input.auditorName,
        auditeeName: input.auditeeName,
        auditeeEmail: input.auditeeEmail,
        entityName: input.entityName ?? null,
        address: input.address ?? null,
        exclusions: input.exclusions ?? null,
        productFamilies: input.productFamilies ?? null,
        markets: input.markets ?? null,
        auditTeam: input.auditTeam ?? null,
        standardsVersion: input.standardsVersion ?? null,
      };

      if (input.auditId) {
        await ctx.db.update(audits).set(payload).where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.session.user.id)));
        return { auditId: input.auditId };
      }

      const inserted = await ctx.db.insert(audits).values(payload).$returningId();
      return { auditId: inserted[0].id };
    }),

  getQuestionsForAudit: protectedProcedure.input(z.object({ auditId: z.number() })).query(async ({ ctx, input }) => {
    const [audit] = await ctx.db
      .select()
      .from(audits)
      .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.session.user.id)));

    if (!audit) throw new Error("Audit introuvable");

    const referentialIds = safeParseArray(audit.referentialIds);
    const selectedProcesses = safeParseArray(audit.processIds);
    const referentialId = referentialIds[0];

    if (!referentialId) return { count: 0, questions: [] };

    const whereClause =
      selectedProcesses.length === 0
        ? eq(questions.referentialId, referentialId)
        : and(eq(questions.referentialId, referentialId), inArray(questions.processId, selectedProcesses));

    const rows = await ctx.db
      .select()
      .from(questions)
      .where(whereClause)
      .orderBy(questions.processId, questions.article, questions.displayOrder);

    return { count: rows.length, questions: rows };
  }),

  saveResponse: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        questionKey: z.string(),
        status: z.enum(["OK", "PARTIAL", "NOK", "NA"]),
        comment: z.string().optional(),
        evidence: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(auditResponses)
        .values({
          userId: ctx.session.user.id,
          auditId: input.auditId,
          questionKey: input.questionKey,
          status: input.status,
          comment: input.comment ?? null,
          evidence: input.evidence ?? null,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: input.status,
            comment: input.comment ?? null,
            evidence: input.evidence ?? null,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
      return { ok: true };
    }),

  listMyIsoAudits: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(audits).where(eq(audits.userId, ctx.session.user.id));
    return rows.filter((a) => {
      const ids = safeParseArray(a.referentialIds);
      return ids.includes(2) || ids.includes(3);
    });
  }),
});
