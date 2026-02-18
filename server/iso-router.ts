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

/**
 * Parse robuste d'array:
 * - array natif
 * - JSON string
 * - double JSON string (string qui contient du JSON string)
 */
function safeJsonArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as T[];

      // cas double-encodé: "\"[1,2,3]\""
      if (typeof parsed === "string") {
        try {
          const parsed2 = JSON.parse(parsed);
          return Array.isArray(parsed2) ? (parsed2 as T[]) : [];
        } catch {
          return [];
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  return [];
}

function isNumericString(v: string) {
  return /^\d+$/.test(v);
}

/**
 * IMPORTANT:
 * Dans MDR, audit.processIds peut contenir des "slugs" (ex: "pms_pmcf")
 * OU des IDs DB.
 *
 * Pour maximiser les chances de filtrage ISO:
 * - On reconstruit des candidats à partir:
 *   - des IDs DB => name + lowercase + (code/slug si présent)
 *   - des strings => elles-mêmes
 */
async function buildProcessCandidates(db: any, processIds: Array<string | number>) {
  if (!processIds?.length) return [] as string[];

  // 1) on sépare numeric ids vs strings
  const numericIds = processIds
    .map((p) => (typeof p === "number" ? p : Number(p)))
    .filter((n) => Number.isFinite(n) && n > 0);

  const stringIds = processIds
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter((s) => s.length > 0);

  const out: string[] = [];

  // 2) toujours ajouter les strings brutes (slugs)
  for (const s of stringIds) out.push(s);

  // 3) si on a des IDs DB => charger processus.name (+ code/slug si existe)
  if (numericIds.length) {
    const rows = await db
      .select({
        id: processus.id,
        name: (processus as any).name,
        // @ts-ignore (si la colonne existe)
        code: (processus as any).code,
        // @ts-ignore (si la colonne existe)
        slug: (processus as any).slug,
      })
      .from(processus)
      .where(inArray(processus.id, numericIds));

    for (const p of rows) {
      if (p?.id != null) out.push(String(p.id));
      if (p?.name) {
        out.push(String(p.name));
        out.push(String(p.name).toLowerCase());
      }
      // si tu as code/slug en DB, ça aide énormément le JSON_CONTAINS
      if ((p as any)?.code) {
        out.push(String((p as any).code));
        out.push(String((p as any).code).toLowerCase());
      }
      if ((p as any)?.slug) {
        out.push(String((p as any).slug));
        out.push(String((p as any).slug).toLowerCase());
      }
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
    return db.select().from(processus).orderBy((processus as any).name ?? sql`name`);
  }),

  getSites: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return db.select().from(sites).where(eq((sites as any).userId, ctx.user.id)).orderBy((sites as any).name ?? sql`name`);
  }),

  // ---------------------------------------------------------------------------
  // Qualification (persisted)
  // ---------------------------------------------------------------------------
  getQualification: protectedProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(isoQualifications)
      .where(eq((isoQualifications as any).userId, ctx.user.id))
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
      id: (row as any).id,
      userId: (row as any).userId,
      targetStandards: safeJsonArray<string>((row as any).targetStandards),
      organizationType: (((row as any).organizationType || "manufacturer") as "manufacturer" | "service_provider" | "both"),
      economicRole: (row as any).economicRole,
      processes: safeJsonArray<string>((row as any).processes),
      certificationScope: (row as any).certificationScope,
      excludedClauses: safeJsonArray<string>((row as any).excludedClauses),
      createdAt: (row as any).createdAt,
      updatedAt: (row as any).updatedAt,
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
        .select({ id: (isoQualifications as any).id })
        .from(isoQualifications)
        .where(eq((isoQualifications as any).userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await db.update(isoQualifications).set(values).where(eq((isoQualifications as any).id, (existing as any).id));
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

      // NOTE: legacy "processes" arrive souvent en string (slug ou id)
      const rawProcessIds = (input.processes ?? []).map((p) => String(p));

      // candidates inclut slugs + noms + lowercase + code/slug DB si dispo
      const candidates = await buildProcessCandidates(db, rawProcessIds);

      const whereParts: any[] = [eq((questions as any).referentialId, referentialId)];

      if (input.economicRole) {
        whereParts.push(or(isNull((questions as any).economicRole), eq((questions as any).economicRole, input.economicRole)));
      }

      const numericProcessIds = rawProcessIds
        .map((p) => Number(p))
        .filter((n) => Number.isFinite(n) && n > 0);

      const hasAnyProcessFilter = numericProcessIds.length > 0 || candidates.length > 0;

      if (hasAnyProcessFilter) {
        const orParts: any[] = [];

        // ✅ FIX: parenthèse fermante du IN (...)
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
        .orderBy(sql`${(questions as any).displayOrder} IS NULL, ${(questions as any).displayOrder} ASC, ${(questions as any).id} ASC`);

      return { count: (rows as any[]).length, questions: rows };
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
        .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
        .limit(1);

      if (!a) throw new Error("Audit introuvable");

      return {
        auditId: (a as any).id,
        auditName: (a as any).name,
        userId: (a as any).userId,
        siteId: (a as any).siteId,
        status: (a as any).status,
        economicRole: (a as any).economicRole,
        processIds: safeJsonArray<any>((a as any).processIds).map(String),
        referentialIds: safeJsonArray<any>((a as any).referentialIds),
        startDate: (a as any).startDate,
        endDate: (a as any).endDate,
      };
    }),

  getResponses: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(auditResponses)
        .where(and(eq((auditResponses as any).auditId, input.auditId), eq((auditResponses as any).userId, ctx.user.id)))
        .orderBy(sql`${(auditResponses as any).id} ASC`);

      return rows;
    }),

  completeAudit: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db
        .update(audits)
        .set({ status: "completed", updatedAt: new Date() } as any)
        .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)));

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
        .select({ id: (audits as any).id })
        .from(audits)
        .where(and(eq((audits as any).id, (input as any).auditId), eq((audits as any).userId, ctx.user.id)))
        .limit(1);
      if (!a) throw new Error("Audit introuvable");

      let q: any = null;

      if ((input as any).questionId) {
        const [row] = await db
          .select()
          .from(questions)
          .where(eq((questions as any).id, (input as any).questionId))
          .limit(1);
        q = row;
      } else {
        const [row] = await db
          .select()
          .from(questions)
          .where(eq((questions as any).questionKey, (input as any).questionKey))
          .limit(1);
        q = row;
      }

      if (!q) throw new Error("Question introuvable");

      const questionKey = (q.questionKey || (input as any).questionKey || `q_${q.id}`) as string;

      const v = (input as any).processId;
      const n = typeof v === "string" ? Number(v) : v;
      const resolvedProcessId = Number.isFinite(n) && n > 0 ? Number(n) : (q as any).processId ?? null;

      const payload: any = {
        userId: ctx.user.id,
        auditId: (input as any).auditId,
        questionId: (q as any).id,
        questionKey,
        responseValue: (input as any).responseValue ?? "in_progress",
        responseComment: (input as any).responseComment ?? "",
        note: (input as any).note ?? "",
        evidenceFiles: (input as any).evidenceFiles ?? [],
        role: (input as any).role ?? ((q as any).economicRole ?? null),
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

        // ✅ IMPORTANT: accepte maintenant string OU number (slug MDR OU id DB)
        processIds: z.array(z.union([z.number(), z.string()])).default([]),

        startDate: z.string().optional(),
        endDate: z.string().optional().nullable(),

        // ✅ IMPORTANT: toujours string (pas null) pour éviter les BAD_REQUEST
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

      // ✅ On stocke tel quel (slug MDR ou ID DB), comme MDR.
      const storedProcessIds = input.processMode === "select" ? input.processIds : [];

      const values: any = {
        name: input.name,
        type: "internal",
        userId: ctx.user.id,
        siteId: input.siteId,
        status: input.status ?? "draft",
        economicRole: null,
        processIds: storedProcessIds,
        referentialIds: [referentialId],

        // auditorName en string (pas null)
        auditorName: (input.auditorName ?? "").trim(),

        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        updatedAt: new Date(),
      };

      if (input.auditId) {
        await db
          .update(audits)
          .set(values)
          .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)));
        return { auditId: input.auditId };
      }

      const res: any = await db.insert(audits).values({ ...values, createdAt: new Date() });
      const insertedId = res?.[0]?.insertId ?? res?.insertId ?? null;

      if (!insertedId) {
        const [row] = await db
          .select({ id: (audits as any).id })
          .from(audits)
          .where(and(eq((audits as any).userId, ctx.user.id), eq((audits as any).name, input.name)))
          .orderBy(sql`${(audits as any).id} DESC`)
          .limit(1);
        return { auditId: (row as any)?.id ?? 0 };
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
        .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit introuvable");

      const referentialIds = safeJsonArray<any>((audit as any).referentialIds);
      const selectedProcessesRaw = safeJsonArray<any>((audit as any).processIds);

      const referentialId = referentialIds?.[0] ? Number(referentialIds[0]) : null;

      const whereParts: any[] = [];
      if (referentialId) {
        whereParts.push(eq((questions as any).referentialId, referentialId));
      }

      // ✅ candidates: slugs + noms + lowercase + code/slug db si dispo
      const candidates = await buildProcessCandidates(db, selectedProcessesRaw);

      // IDs DB si le processIds contient des numerics (ou si JSON contient des ids)
      const selectedDbIds = selectedProcessesRaw
        .map((p: any) => (typeof p === "number" ? p : Number(p)))
        .filter((n: number) => Number.isFinite(n) && n > 0);

      const hasAnyProcessFilter = selectedProcessesRaw.length > 0 && (selectedDbIds.length > 0 || candidates.length > 0);

      if (hasAnyProcessFilter) {
        const orParts: any[] = [];

        // ✅ FIX: parenthèse fermante IN (...)
        if (selectedDbIds.length > 0) {
          orParts.push(
            sql`${(questions as any).processId} in (${sql.join(
              selectedDbIds.map((n: number) => sql`${n}`),
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

        // si orParts vide (cas edge) => pas de filtre
        if (orParts.length) {
          whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
        }
      }

      const rows = await db
        .select()
        .from(questions)
        .where(whereParts.length ? and(...whereParts) : undefined)
        .orderBy(sql`${(questions as any).displayOrder} IS NULL, ${(questions as any).displayOrder} ASC, ${(questions as any).id} ASC`);

      return { count: (rows as any[]).length, questions: rows };
    }),
});
