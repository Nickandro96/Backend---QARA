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
 * Objectifs:
 * - Alimenter le Wizard ISO (création audit draft)
 * - Alimenter un drilldown ISO identique au MDR (UI premium)
 * - Maintenir la page "ISO Qualification" existante
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

function isNumericString(v: string) {
  return /^\d+$/.test(v);
}

async function buildProcessCandidates(db: any, processIds: number[]) {
  if (!processIds.length) return [] as string[];

  const rows = await db
    .select({ id: processus.id, name: processus.name })
    .from(processus)
    .where(inArray(processus.id, processIds));

  const out: string[] = [];
  for (const p of rows) {
    if (p?.id != null) out.push(String(p.id));
    if (p?.name) {
      out.push(String(p.name));
      out.push(String(p.name).toLowerCase());
    }
  }
  return Array.from(new Set(out)).filter(Boolean);
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
      organizationType: (row.organizationType || "manufacturer") as "manufacturer" | "service_provider" | "both",
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
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "mandataire"]).optional().nullable(),
        processes: z.array(z.string()).optional().default([]),
        certificationScope: z.string().optional().nullable(),
        excludedClauses: z.array(z.string()).optional().default([]),
      })
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
  // Questions (legacy simple page)
  // ---------------------------------------------------------------------------
  getQuestions: protectedProcedure
    .input(
      z.object({
        standard: z.enum(["9001", "13485"]),
        economicRole: z.enum(["fabricant", "importateur", "distributeur"]).optional().nullable(),
        processes: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const referentialId = referentialIdFromStandard(input.standard);

      const numericProcessIds = (input.processes ?? [])
        .map((p) => Number(p))
        .filter((n) => Number.isFinite(n) && n > 0);

      const candidates = await buildProcessCandidates(db, numericProcessIds);

      const whereParts: any[] = [eq(questions.referentialId, referentialId)];

      if (input.economicRole) {
        // include generic questions (null role) OR role-specific questions
        whereParts.push(or(isNull(questions.economicRole), eq(questions.economicRole, input.economicRole)));
      }

      const hasAnyProcessFilter = numericProcessIds.length > 0 || candidates.length > 0;
      if (hasAnyProcessFilter) {
        const orParts: any[] = [];

        if (numericProcessIds.length > 0) {
          orParts.push(
            sql`${(questions as any).processId} in (${sql.join(
              numericProcessIds.map((n: number) => sql`${n}`),
              sql`, `
            )})`
          );
        }


        if (candidates.length > 0) {
          const conds = candidates.map((cand) => {
            const s = String(cand);
            if (isNumericString(s)) {
              const n = Number(s);
              return sql`JSON_CONTAINS(${(questions as any).applicableProcesses}, CAST(${n} AS JSON))`;
            }
            return sql`JSON_CONTAINS(${(questions as any).applicableProcesses}, JSON_QUOTE(${s}))`;
          });
          orParts.push(sql`(${sql.join(conds, sql` OR `)})`);
        }

        whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
      }

      const rows = await db
        .select()
        .from(questions)
        .where(and(...whereParts))
        .orderBy(sql`${questions.displayOrder} IS NULL, ${questions.displayOrder} ASC, ${questions.id} ASC`);

      return { count: rows.length, questions: rows };
    }),

  // ---------------------------------------------------------------------------
  // Audit context / responses (for premium drilldown UI)
  // ---------------------------------------------------------------------------
  getAuditContext: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const [a] = await db
        .select()
        .from(audits)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!a) throw new Error("Audit introuvable");

      return {
        auditId: a.id,
        auditName: a.name,
        userId: a.userId,
        siteId: a.siteId,
        status: a.status,
        economicRole: a.economicRole,
        processIds: safeJsonArray<any>(a.processIds).map(String),
        referentialIds: safeJsonArray<any>(a.referentialIds),
        startDate: a.startDate,
        endDate: a.endDate,
      };
    }),

  getResponses: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(auditResponses)
        .where(and(eq(auditResponses.auditId, input.auditId), eq(auditResponses.userId, ctx.user.id)))
        .orderBy(sql`${auditResponses.id} ASC`);
      return rows;
    }),

  completeAudit: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db
        .update(audits)
        .set({ status: "completed", updatedAt: new Date() } as any)
        .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)));
      return { success: true as const };
    }),

  // ---------------------------------------------------------------------------
  // Responses save (accepts MDR-style payload too)
  // ---------------------------------------------------------------------------
  saveResponse: protectedProcedure
    .input(
      z.union([
        // ✅ MDR-style payload
        z.object({
          auditId: z.number().int().positive(),
          questionKey: z.string().min(1),
          responseValue: z
            .enum(["compliant", "non_compliant", "partial", "not_applicable", "in_progress"])
            .default("in_progress"),
          responseComment: z.string().optional().default(""),
          note: z.string().optional().default(""),
          evidenceFiles: z.array(z.string()).optional().default([]),
          role: z.string().optional().nullable(),
          processId: z.any().optional().nullable(),
          answeredBy: z.any().optional().nullable(),
          answeredAt: z.string().optional().nullable(),
        }),
        // legacy payload (kept for backward compatibility)
        z.object({
          auditId: z.number().int().positive(),
          questionId: z.number().int().positive(),
          responseValue: z.enum(["compliant", "non_compliant", "partial", "not_applicable"]),
          responseComment: z.string().optional().nullable(),
        }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [a] = await db
        .select({ id: audits.id })
        .from(audits)
        .where(and(eq(audits.id, (input as any).auditId), eq(audits.userId, ctx.user.id)))
        .limit(1);
      if (!a) throw new Error("Audit introuvable");

      let q: any = null;
      if ((input as any).questionId) {
        const [row] = await db.select().from(questions).where(eq(questions.id, (input as any).questionId)).limit(1);
        q = row;
      } else {
        const [row] = await db
          .select()
          .from(questions)
          .where(eq(questions.questionKey, (input as any).questionKey))
          .limit(1);
        q = row;
      }

      if (!q) throw new Error("Question introuvable");

      const questionKey = (q.questionKey || (input as any).questionKey || `q_${q.id}`) as string;

      const v = (input as any).processId;
      const n = typeof v === "string" ? Number(v) : v;
      const resolvedProcessId = Number.isFinite(n) && n > 0 ? Number(n) : q.processId ?? null;

      const payload: any = {
        userId: ctx.user.id,
        auditId: (input as any).auditId,
        questionId: q.id,
        questionKey,
        responseValue: (input as any).responseValue ?? "in_progress",
        responseComment: (input as any).responseComment ?? "",
        note: (input as any).note ?? "",
        evidenceFiles: (input as any).evidenceFiles ?? [],
        role: (input as any).role ?? (q.economicRole ?? null),
        processId: resolvedProcessId,
        answeredBy: ctx.user.id,
        answeredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db
        .insert(auditResponses)
        .values(payload)
        .onDuplicateKeyUpdate({
          set: {
            responseValue: payload.responseValue,
            responseComment: payload.responseComment,
            note: payload.note,
            evidenceFiles: payload.evidenceFiles,
            role: payload.role,
            processId: payload.processId,
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
      })
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

      const selectedDbIds = selectedProcesses.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
      const candidates = await buildProcessCandidates(db, selectedDbIds);

      const hasAnyProcessFilter = selectedDbIds.length > 0 || candidates.length > 0;

      if (hasAnyProcessFilter) {
        const orParts: any[] = [];

        if (selectedDbIds.length > 0) {
          orParts.push(
            sql`${(questions as any).processId} in (${sql.join(selectedDbIds.map((n: number) => sql`${n}`), sql`, `)})`
          );
        }


        if (candidates.length > 0) {
          const conds = candidates.map((cand) => {
            const s = String(cand);
            if (isNumericString(s)) {
              const n = Number(s);
              return sql`JSON_CONTAINS(${(questions as any).applicableProcesses}, CAST(${n} AS JSON))`;
            }
            return sql`JSON_CONTAINS(${(questions as any).applicableProcesses}, JSON_QUOTE(${s}))`;
          });
          orParts.push(sql`(${sql.join(conds, sql` OR `)})`);
        }

        whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
      }

      const rows = await db
        .select()
        .from(questions)
        .where(whereParts.length ? and(...whereParts) : undefined)
        .orderBy(sql`${questions.displayOrder} IS NULL, ${questions.displayOrder} ASC, ${questions.id} ASC`);

      return { count: rows.length, questions: rows };
    }),
});
