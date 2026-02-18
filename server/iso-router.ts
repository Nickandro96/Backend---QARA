import { z } from "zod";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";

import {
  audits,
  auditResponses,
  isoQualifications,
  questions,
  processus,
  sites,
} from "../drizzle/schema";

/**
 * ISO Router
 *
 * This router is used by BOTH:
 * - the "ISO Qualification" and "ISO Audit" pages (wouter app)
 * - the "ISOAuditWizard" page (react-router-dom wizard)
 *
 * We expose a superset of fields to keep both front UIs compatible.
 */

const ISO_STANDARDS = [
  {
    code: "9001" as const,
    standardCode: "ISO9001" as const,
    name: "ISO 9001:2015",
    label: "ISO 9001",
    description: "Systèmes de management de la qualité - Exigences générales",
    referentialId: 2,
  },
  {
    code: "13485" as const,
    standardCode: "ISO13485" as const,
    name: "ISO 13485:2016",
    label: "ISO 13485",
    description: "Dispositifs médicaux - Systèmes de management de la qualité",
    referentialId: 3,
  },
];

function referentialIdFromStandard(input: "9001" | "13485" | "ISO9001" | "ISO13485"): number {
  const s = String(input);
  if (s === "9001" || s === "ISO9001") return 2;
  return 3;
}

function safeJsonArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const isoRouter = router({
  // ---------------------------------------------------------------------------
  // Standards & lookup
  // ---------------------------------------------------------------------------
  getStandards: publicProcedure.query(() => ISO_STANDARDS),

  getProcesses: protectedProcedure.query(async () => {
    const db = await getDb();
    return db.select().from(processus).orderBy(processus.name);
  }),

  getSites: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return db.select().from(sites).where(eq(sites.userId, ctx.user.id)).orderBy(sites.name);
  }),

  // ---------------------------------------------------------------------------
  // Qualification (persisted)
  // ---------------------------------------------------------------------------
  getQualification: protectedProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(isoQualifications)
      .where(eq(isoQualifications.userId, ctx.user.id))
      .limit(1);

    if (!row) {
      return {
        id: null,
        userId: ctx.user.id,
        targetStandards: ["9001"],
        organizationType: "manufacturer" as const,
        economicRole: null,
        processes: [],
        certificationScope: null,
        excludedClauses: [],
        createdAt: null,
        updatedAt: null,
      };
    }

    return {
      id: row.id,
      userId: row.userId,
      targetStandards: safeJsonArray<string>(row.targetStandards),
      organizationType: (row.organizationType || "manufacturer") as
        | "manufacturer"
        | "service_provider"
        | "both",
      economicRole: row.economicRole,
      processes: safeJsonArray<string>(row.processes),
      certificationScope: row.certificationScope,
      excludedClauses: safeJsonArray<string>(row.excludedClauses),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }),

  saveQualification: protectedProcedure
    .input(
      z.object({
        targetStandards: z.array(z.enum(["9001", "13485"])).min(1),
        organizationType: z.enum(["manufacturer", "service_provider", "both"]),
        economicRole: z
          .enum(["fabricant", "importateur", "distributeur", "mandataire"])
          .optional()
          .nullable(),
        processes: z.array(z.string()).optional().default([]),
        certificationScope: z.string().optional().nullable(),
        excludedClauses: z.array(z.string()).optional().default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const values: any = {
        userId: ctx.user.id,
        targetStandards: input.targetStandards,
        organizationType: input.organizationType,
        economicRole: input.economicRole ?? null,
        processes: input.processes ?? [],
        certificationScope: input.certificationScope ?? null,
        excludedClauses: input.excludedClauses ?? [],
        updatedAt: new Date(),
      };

      const [existing] = await db
        .select({ id: isoQualifications.id })
        .from(isoQualifications)
        .where(eq(isoQualifications.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await db.update(isoQualifications).set(values).where(eq(isoQualifications.id, existing.id));
        return { success: true as const, message: "Qualification mise à jour." };
      }

      await db.insert(isoQualifications).values({ ...values, createdAt: new Date() });
      return { success: true as const, message: "Qualification enregistrée." };
    }),

  // ---------------------------------------------------------------------------
  // Questions (simple ISO audit page)
  // ---------------------------------------------------------------------------
  getQuestions: protectedProcedure
    .input(
      z.object({
        standard: z.enum(["9001", "13485"]),
        economicRole: z
          .enum(["fabricant", "importateur", "distributeur"])
          .optional()
          .nullable(),
        // UI sends string process identifiers; we accept anything and best-effort map.
        processes: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const referentialId = referentialIdFromStandard(input.standard);

      // Best-effort: if processes contain numeric strings, filter by processId
      const numericProcessIds = (input.processes ?? [])
        .map((p) => Number(p))
        .filter((n) => Number.isFinite(n) && n > 0);

      const whereParts: any[] = [eq(questions.referentialId, referentialId)];

      if (input.economicRole) {
        // include generic questions (null role) OR role-specific questions
        whereParts.push(or(isNull(questions.economicRole), eq(questions.economicRole, input.economicRole)));
      }

      if (numericProcessIds.length > 0) {
        whereParts.push(or(isNull(questions.processId), inArray(questions.processId, numericProcessIds)));
      }

      const rows = await db
        .select()
        .from(questions)
        .where(and(...whereParts))
        .orderBy(sql`${questions.displayOrder} IS NULL, ${questions.displayOrder} ASC, ${questions.id} ASC`);

      return { count: rows.length, questions: rows };
    }),

  saveResponse: protectedProcedure
    .input(
      z.object({
        auditId: z.number().int().positive(),
        questionId: z.number().int().positive(),
        responseValue: z.enum(["compliant", "non_compliant", "partial", "not_applicable"]),
        responseComment: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [q] = await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
      if (!q) throw new Error("Question introuvable");

      const [a] = await db
        .select({ id: audits.id })
        .from(audits)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!a) throw new Error("Audit introuvable");

      await db
        .insert(auditResponses)
        .values({
          userId: ctx.user.id,
          auditId: input.auditId,
          questionId: q.id,
          questionKey: q.questionKey || `q_${q.id}`,
          responseValue: input.responseValue,
          responseComment: input.responseComment ?? null,
          role: q.economicRole ?? null,
          processId: q.processId ?? null,
          evidenceFiles: null,
          answeredBy: ctx.user.id,
          answeredAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .onDuplicateKeyUpdate({
          set: {
            responseValue: input.responseValue,
            responseComment: input.responseComment ?? null,
            answeredBy: ctx.user.id,
            answeredAt: new Date(),
            updatedAt: new Date(),
          },
        } as any);

      return { success: true as const };
    }),

  // ---------------------------------------------------------------------------
  // Wizard: draft audit + drilldown
  // ---------------------------------------------------------------------------
  createOrUpdateAuditDraft: protectedProcedure
    .input(
      z.object({
        auditId: z.number().optional(),
        standardCode: z.enum(["ISO9001", "ISO13485"]),
        siteId: z.number().int().positive(),
        name: z.string().min(1),
        processMode: z.enum(["all", "select"]).default("all"),
        processIds: z.array(z.number()).default([]),
        startDate: z.string().optional(),
        endDate: z.string().optional().nullable(),
        auditorName: z.string().optional().default(""),
        auditeeName: z.string().optional().default(""),
        auditeeEmail: z.string().optional().default(""),
        status: z.enum(["draft", "in_progress", "completed"]).optional(),

        // extra wizard fields (ignored but accepted)
        organisationId: z.any().optional(),
        scope: z.any().optional(),
        method: z.any().optional(),
        entityName: z.any().optional(),
        address: z.any().optional(),
        exclusions: z.any().optional(),
        productFamilies: z.any().optional(),
        markets: z.any().optional(),
        auditTeam: z.any().optional(),
        standardsVersion: z.any().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const referentialId = referentialIdFromStandard(input.standardCode);
      const processIds = input.processMode === "select" ? input.processIds : [];

      const values: any = {
        name: input.name,
        type: "internal",
        userId: ctx.user.id,
        siteId: input.siteId,
        status: input.status ?? "draft",
        economicRole: null,
        processIds,
        referentialIds: [referentialId],
        auditorName: input.auditorName || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        updatedAt: new Date(),
      };

      if (input.auditId) {
        await db
          .update(audits)
          .set(values)
          .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)));
        return { auditId: input.auditId };
      }

      const res: any = await db.insert(audits).values({ ...values, createdAt: new Date() });
      const insertedId = res?.[0]?.insertId ?? res?.insertId ?? null;

      if (!insertedId) {
        const [row] = await db
          .select({ id: audits.id })
          .from(audits)
          .where(and(eq(audits.userId, ctx.user.id), eq(audits.name, input.name)))
          .orderBy(sql`${audits.id} DESC`)
          .limit(1);
        return { auditId: row?.id ?? 0 };
      }

      return { auditId: insertedId };
    }),

  getQuestionsForAudit: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const [audit] = await db
        .select()
        .from(audits)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit introuvable");

      const referentialIds = safeJsonArray<number>(audit.referentialIds);
      const selectedProcesses = safeJsonArray<number>(audit.processIds);
      const referentialId = referentialIds?.[0];

      const whereParts: any[] = [];
      if (referentialId) whereParts.push(eq(questions.referentialId, Number(referentialId)));
      if (selectedProcesses.length > 0) {
        whereParts.push(or(isNull(questions.processId), inArray(questions.processId, selectedProcesses)));
      }

      const rows = await db
        .select()
        .from(questions)
        .where(whereParts.length ? and(...whereParts) : undefined)
        .orderBy(sql`${questions.displayOrder} IS NULL, ${questions.displayOrder} ASC, ${questions.id} ASC`);

      return { count: rows.length, questions: rows };
    }),
});
