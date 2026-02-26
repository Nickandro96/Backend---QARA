import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb, hasColumn, listAuditsByUserId } from "./db";

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
 * - JSON string array
 * - double JSON string (string qui contient du JSON string)
 * - ✅ string simple => [string]
 */
function safeJsonArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // ✅ si ce n'est pas du JSON, on considère que c'est une valeur unique
    const looksLikeJson =
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'));
    if (!looksLikeJson) return [trimmed as any as T];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as T[];

      if (typeof parsed === "string") {
        // cas double-encodé
        const inner = parsed.trim();
        const looksLikeInnerJson =
          (inner.startsWith("[") && inner.endsWith("]")) ||
          (inner.startsWith("{") && inner.endsWith("}")) ||
          (inner.startsWith('"') && inner.endsWith('"'));
        if (!looksLikeInnerJson) return [inner as any as T];

        try {
          const parsed2 = JSON.parse(inner);
          if (Array.isArray(parsed2)) return parsed2 as T[];
          if (typeof parsed2 === "string") return [parsed2 as any as T];
          return [];
        } catch {
          return [];
        }
      }

      // si c'est un objet non-array => rien
      return [];
    } catch {
      // fallback: string simple
      return [trimmed as any as T];
    }
  }

  return [];
}

function normalizeIsoQuestion(row: any) {
  if (!row || typeof row !== "object") return row;

  // Normalize commonly-JSON fields used by the ISO UI (avoid null/undefined in frontend)
  const out: any = { ...row };

  const jsonArrayFields = [
    "applicableProcesses",
    "interviewFunctions",
    "evidences",
    "evidenceDocs",
    "evidenceDocuments",
    "relatedDocuments",
        "riskLevels",
    "tags",
  ];

  for (const f of jsonArrayFields) {
    if (f in out) out[f] = safeJsonArray<any>(out[f]);
  }

  // ✅ Risk field normalization
  // - Some environments only have `risk` (TEXT)
  // - Some legacy DBs also have `risks` (JSON/TEXT)
  // We select both when available and normalize for the frontend.
  if ("risksRaw" in out || "risk" in out) {
    const raw = (out as any).risksRaw ?? (out as any).risks ?? (out as any).risk ?? null;
    out.risk = (out as any).risk ?? null;
    out.risks = normalizeRisksValue(raw);
    delete (out as any).risksRaw;
  }

  return out;
}

function normalizeRisksValue(v: any): any {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
      try {
        return JSON.parse(s);
      } catch {
        return s;
      }
    }
    return s;
  }
  return v;
}

function isNumericString(v: string) {
  return /^\d+$/.test(v);
}

/**
 * Mapping slugs UI (MDR-like) -> libellés utilisés dans applicableProcesses ISO
 * (d'après tes captures: applicableProcesses contient "Gouvernance")
 */
const PROCESS_SLUG_TO_ISO_LABELS: Record<string, string[]> = {
  gov_strat: ["Gouvernance", "Gouvernance & stratégie réglementaire", "Gouvernance & stratégie"],
  ra: ["RA", "Affaires réglementaires", "Affaires réglementaires (RA)"],
  qms: ["QMS", "SMQ", "Système de management qualité", "Système de management qualité (QMS)", "Qualité"],
  risk_mgmt: ["Risques", "Gestion des risques", "Gestion des risques (ISO 14971)"],
  design_dev: ["Conception", "Conception & développement", "Développement"],
  purchasing_suppliers: ["Achats", "Fournisseurs", "Achats & fournisseurs"],
  production_sub: ["Production", "Sous-traitance", "Production & sous-traitance"],
  traceability_udi: ["Traçabilité", "UDI", "Traçabilité / UDI"],
  pms_pmcf: ["PMS", "PMCF", "PMS / PMCF"],
  vigilance_incidents: ["Vigilance", "Incidents", "Vigilance & incidents"],
  distribution_logistics: ["Distribution", "Logistique", "Distribution & logistique"],
  importation: ["Importation"],
  tech_doc: ["Documentation", "Documentation technique"],
  audits_conformity: ["Audits", "Conformité", "Audits & conformité"],
  it_data_cybersecurity: ["IT", "Données", "Cybersécurité", "IT / données / cybersécurité"],
};

/**
 * Construit une liste de candidats de matching pour les filtres JSON_CONTAINS.
 * - inclut toujours la valeur brute (slug / id / nom)
 * - ajoute les labels ISO équivalents quand on détecte un slug connu
 * - si ID DB => ajoute name + lowercase (+ code/slug si dispo)
 */
async function buildProcessCandidates(db: any, processIds: Array<string | number>) {
  if (!processIds?.length) return [] as string[];

  const out: string[] = [];

  const rawStrings = processIds
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean);

  for (const s of rawStrings) {
    out.push(s);
    out.push(s.toLowerCase());

    const mapped = PROCESS_SLUG_TO_ISO_LABELS[s];
    if (mapped?.length) {
      for (const m of mapped) {
        out.push(m);
        out.push(m.toLowerCase());
      }
    }
  }

  const numericIds = rawStrings
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numericIds.length) {
    const rows = await db
      .select({
        id: processus.id,
        name: (processus as any).name,
        // @ts-ignore optional cols
        code: (processus as any).code,
        // @ts-ignore optional cols
        slug: (processus as any).slug,
      })
      .from(processus)
      .where(inArray(processus.id, numericIds));

    for (const p of rows) {
      if (p?.id != null) out.push(String(p.id));
      if ((p as any)?.name) {
        out.push(String((p as any).name));
        out.push(String((p as any).name).toLowerCase());
      }
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
    return db
      .select()
      .from(sites)
      .where(eq((sites as any).userId, ctx.user.id))
      .orderBy((sites as any).name ?? sql`name`);
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
      organizationType: (((row as any).organizationType || "manufacturer") as
        | "manufacturer"
        | "service_provider"
        | "both"),
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

      const rawProcessIds = (input.processes ?? []).map((p) => String(p).trim()).filter(Boolean);
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
        .select(questionSelect)
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

      // ✅ Ownership check via audits table (robust even if schema evolves)
      const [audit] = await db
        .select({ id: (audits as any).id })
        .from(audits)
        .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit introuvable");

      const rows = await db
        .select()
        .from(auditResponses)
        .where(eq((auditResponses as any).auditId, input.auditId))
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
        const [row] = await db.select().from(questions).where(eq((questions as any).id, (input as any).questionId)).limit(1);
        q = row;
      } else {
        const [row] = await db.select().from(questions).where(eq((questions as any).questionKey, (input as any).questionKey)).limit(1);
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
      processIds: z.array(z.union([z.number(), z.string()])).default([]),
      startDate: z.string().optional(),
      endDate: z.string().optional().nullable(),
      auditorName: z.string().optional().default(""),
      auditeeName: z.string().optional().default(""),
      auditeeEmail: z.string().optional().default(""),
      status: z.enum(["draft", "in_progress", "completed"]).optional().default("draft"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const referentialId = referentialIdFromStandard(input.standardCode);

    const inputProcessIdsRaw = Array.isArray(input.processIds) ? input.processIds : [];
    const inputHasSelection = inputProcessIdsRaw.length > 0;

    // ✅ If audit exists and client sends empty processIds, do NOT overwrite stored selection
    let existing: any = null;
    if (input.auditId) {
      const [row] = await db
        .select({ id: (audits as any).id, processIds: (audits as any).processIds })
        .from(audits)
        .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
        .limit(1);
      existing = row ?? null;
      if (!existing) throw new Error("Audit introuvable");
    }

    // ✅ Determine stored processIds
    // - If client selected processes OR mode=select -> store that selection
    // - Else if mode=all -> store ALL process ids (never empty)
    // - Else (update with empty) -> keep existing
    let storedProcessIds: any[] | undefined;

    if (inputHasSelection || input.processMode === "select") {
      storedProcessIds = inputProcessIdsRaw;
    } else if (!input.auditId) {
      const all = await db.select({ id: (processus as any).id }).from(processus);
      storedProcessIds = all.map((p: any) => p.id);
    } else {
      storedProcessIds = safeJsonArray<any>(existing?.processIds);
    }

    const values: any = {
      name: input.name,
      type: "internal",
      userId: ctx.user.id,
      siteId: input.siteId,
      status: input.status ?? "draft",
      economicRole: null,
      processIds: storedProcessIds,
      referentialIds: [referentialId],
      auditorName: (input.auditorName ?? "").trim(),
      auditeeName: (input.auditeeName ?? "").trim(),
      auditeeEmail: (input.auditeeEmail ?? "").trim(),
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
    if (!db) throw new Error("Database not available");
    const hasRisksColumn = await hasColumn("questions", "risks");

    try {
      const [audit] = await db
        .select()
        .from(audits)
        .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit introuvable");

      const referentialIds = safeJsonArray<any>((audit as any).referentialIds);
      const selectedProcessesRaw = safeJsonArray<any>((audit as any).processIds);

      const referentialId = referentialIds?.[0] ? Number(referentialIds[0]) : null;
      if (!referentialId) throw new Error("Référentiel ISO manquant sur l'audit");

      const candidates = await buildProcessCandidates(db, selectedProcessesRaw);

      const selectedDbIds = selectedProcessesRaw
        .map((p: any) => (typeof p === "number" ? p : Number(p)))
        .filter((n: number) => Number.isFinite(n) && n > 0);

      const whereParts: any[] = [eq((questions as any).referentialId, referentialId)];

      const hasProcessSelection =
        selectedProcessesRaw.length > 0 && (selectedDbIds.length > 0 || candidates.length > 0);

      if (hasProcessSelection) {
        const orParts: any[] = [];

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
            // ✅ JSON_CONTAINS(NULL, ...) => NULL. COALESCE to [] to avoid edge cases.
            const ap = sql`COALESCE(${(questions as any).applicableProcesses}, '[]')`;
            if (isNumericString(s)) {
              const n = Number(s);
              return sql`JSON_CONTAINS(${ap}, CAST(${n} AS JSON))`;
            }
            return sql`JSON_CONTAINS(${ap}, JSON_QUOTE(${s}))`;
          });
          orParts.push(sql`(${sql.join(conds, sql` OR `)})`);
        }

        if (orParts.length) whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
      }

      const questionSelect = {
        id: (questions as any).id,
        referentialId: (questions as any).referentialId,
        processId: (questions as any).processId,
        questionKey: (questions as any).questionKey,
        article: (questions as any).article,
        annexe: (questions as any).annexe,
        title: (questions as any).title,
        economicRole: (questions as any).economicRole,
        applicableProcesses: (questions as any).applicableProcesses,
        questionType: (questions as any).questionType,
        questionText: (questions as any).questionText,
        expectedEvidence: (questions as any).expectedEvidence,
        criticality: (questions as any).criticality,
        interviewFunctions: (questions as any).interviewFunctions,
        actionPlan: (questions as any).actionPlan,
        aiPrompt: (questions as any).aiPrompt,
        displayOrder: (questions as any).displayOrder,
        createdAt: (questions as any).createdAt,
        // ✅ Always select the per-question risk text.
        // If legacy column `risks` exists, select it too for richer payloads.
        risk: (questions as any).risk,
        risksRaw: hasRisksColumn ? (questions as any).risks : sql`NULL`,
      };
      let q = db
        .select(questionSelect)
        .from(questions)
        .orderBy(
          sql`${(questions as any).displayOrder} IS NULL, ${(questions as any).displayOrder} ASC, ${(questions as any).id} ASC`
        );

      if (whereParts.length) {
        q = (q as any).where(and(...whereParts));
      }

      const rows: any[] = (await q) as any[];

      console.log(
        `[ISO] getQuestionsForAudit audit=${(audit as any).id} processIds=${JSON.stringify(
          selectedProcessesRaw
        )} selectedDbIds=${JSON.stringify(selectedDbIds)} candidates=${JSON.stringify(
          candidates
        )} referentials=${JSON.stringify(referentialIds)}`
      );
      console.log(`[ISO] DB filtered questions count: ${rows.length}`);

      const normalized = rows.map((r) => normalizeIsoQuestion(r));

      // 🔎 Debug: show a small sample of risks to verify per-question payload
      try {
        const sample = normalized.slice(0, 5).map((x: any) => ({
          questionKey: x.questionKey,
          risk: typeof x.risk === "string" ? x.risk.slice(0, 80) : x.risk,
        }));
        console.log(`[ISO] sample risks: ${JSON.stringify(sample)}`);
      } catch {}

      return { count: normalized.length, questions: normalized };
    } catch (err: any) {
      console.error("[ISO] getQuestionsForAudit error:", err?.stack ?? err);
      throw err;
    }
  }),

  /**
   * List ISO audits for current user (used by review dashboard).
   * Filters audits whose referentialIds contain ISO 9001 (2) or ISO 13485 (3).
   */
  listAudits: protectedProcedure.query(async ({ ctx }) => {
    try {
      const all = await listAuditsByUserId(ctx.user.id);
      const auditsIso = (all || []).filter((a: any) => {
        const refs = safeJsonArray<any>((a as any).referentialIds);
        return refs.includes(2) || refs.includes(3);
      });
      return { audits: auditsIso };
    } catch (e: any) {
      console.error("[ISO] listAudits failed:", e);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e?.message || "Unable to list audits" });
    }
  }),

  /**
   * ✅ Dashboard post-audit aligned with the real drilldown scope (processIds + referentialIds)
   * This fixes the "total questions = all questions in DB" issue.
   */
  getAuditDashboard: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      try {
        const [audit] = await db
          .select({
            id: (audits as any).id,
            name: (audits as any).name,
            status: (audits as any).status,
            createdAt: (audits as any).createdAt,
            updatedAt: (audits as any).updatedAt,
            siteId: (audits as any).siteId,
            referentialIds: (audits as any).referentialIds,
            processIds: (audits as any).processIds,
          })
          .from(audits)
          .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
          .limit(1);

        if (!audit) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });
        }

        const [site] = audit?.siteId
          ? await db
              .select({ id: (sites as any).id, name: (sites as any).name })
              .from(sites)
              .where(eq((sites as any).id, audit.siteId))
              .limit(1)
          : [null];

        const referentialIds = safeJsonArray<any>((audit as any).referentialIds);
        const processIds = safeJsonArray<any>((audit as any).processIds);

        const referentialId = referentialIds?.[0] ? Number(referentialIds[0]) : null;
        if (!referentialId) throw new TRPCError({ code: "BAD_REQUEST", message: "Référentiel ISO manquant sur l'audit" });

        const candidates = await buildProcessCandidates(db, processIds);
        const selectedDbIds = processIds
          .map((p: any) => (typeof p === "number" ? p : Number(p)))
          .filter((n: number) => Number.isFinite(n) && n > 0);

        const whereParts: any[] = [eq((questions as any).referentialId, referentialId)];

        const hasProcessSelection = processIds.length > 0 && (selectedDbIds.length > 0 || candidates.length > 0);
        if (hasProcessSelection) {
          const orParts: any[] = [];
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
              const ap = sql`COALESCE(${(questions as any).applicableProcesses}, '[]')`;
              if (isNumericString(s)) {
                const n = Number(s);
                return sql`JSON_CONTAINS(${ap}, CAST(${n} AS JSON))`;
              }
              return sql`JSON_CONTAINS(${ap}, JSON_QUOTE(${s}))`;
            });
            orParts.push(sql`(${sql.join(conds, sql` OR `)})`);
          }
          if (orParts.length) whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
        }

        const questionRows: any[] = (await db
          .select({
            questionKey: (questions as any).questionKey,
            questionText: (questions as any).questionText,
            article: (questions as any).article,
            annexe: (questions as any).annexe,
            criticality: (questions as any).criticality,
            processId: (questions as any).processId,
            risk: (questions as any).risk,
          })
          .from(questions)
          .where(and(...whereParts))
          .orderBy(
            sql`${(questions as any).displayOrder} IS NULL, ${(questions as any).displayOrder} ASC, ${(questions as any).id} ASC`
          )) as any[];

        const scopedKeys = new Set((questionRows || []).map((q: any) => String(q.questionKey)));
        const totalQuestions = (questionRows || []).length;

        const responseRowsAll = await db
          .select({
            questionKey: (auditResponses as any).questionKey,
            responseValue: (auditResponses as any).responseValue,
            responseComment: (auditResponses as any).responseComment,
            note: (auditResponses as any).note,
            updatedAt: (auditResponses as any).updatedAt,
          })
          .from(auditResponses)
          .where(and(eq((auditResponses as any).auditId, input.auditId), eq((auditResponses as any).userId, ctx.user.id)));

        const responseRows = (responseRowsAll || []).filter((r: any) => scopedKeys.has(String(r.questionKey)));

        const qMap = new Map((questionRows || []).map((q: any) => [String(q.questionKey), q]));

        const stats = {
          totalQuestions,
          answered: 0,
          compliant: 0,
          partial: 0,
          non_compliant: 0,
          not_applicable: 0,
          in_progress: 0,
          score: 100,
        } as any;

        const byProcess: Record<
          string,
          { compliant: number; partial: number; non_compliant: number; not_applicable: number; in_progress: number }
        > = {};

        const byCriticality: Record<string, { non_compliant: number; partial: number }> = {};

        const scoreMap: Record<string, number> = {
          compliant: 100,
          partial: 60,
          non_compliant: 20,
          not_applicable: 100,
          in_progress: 50,
        };

        let scoreTotal = 0;
        let scoreCount = 0;

        for (const r of responseRows || []) {
          const status = String(r.responseValue || "in_progress");
          if (!(status in stats)) continue;

          stats[status] += 1;
          if (status !== "in_progress") stats.answered += 1;

          scoreTotal += scoreMap[status] ?? 50;
          scoreCount += 1;

          const q = qMap.get(String(r.questionKey));
          const pid = String((q as any)?.processId ?? "non_renseigne");
          if (!byProcess[pid]) byProcess[pid] = { compliant: 0, partial: 0, non_compliant: 0, not_applicable: 0, in_progress: 0 };
          (byProcess[pid] as any)[status] += 1;

          const crit = String((q as any)?.criticality || "unknown").toLowerCase();
          if (!byCriticality[crit]) byCriticality[crit] = { non_compliant: 0, partial: 0 };
          if (status === "non_compliant") byCriticality[crit].non_compliant += 1;
          if (status === "partial") byCriticality[crit].partial += 1;
        }

        stats.score = Math.round((scoreTotal / (scoreCount || 1)) || 0);

        // questions in scope - responses saved
        const respondedCount = responseRows.length;
        stats.in_progress = Math.max(totalQuestions - respondedCount, 0);

        const topRisks = (responseRows || [])
          .filter((r: any) => r.responseValue === "non_compliant" || r.responseValue === "partial")
          .map((r: any) => {
            const q = qMap.get(String(r.questionKey)) || {};
            return {
              questionKey: r.questionKey,
              questionText: (q as any).questionText ?? "Question",
              article: (q as any).article ?? null,
              annexe: (q as any).annexe ?? null,
              criticality: (q as any).criticality ?? "unknown",
              responseValue: r.responseValue,
              note: r.note ?? "",
              responseComment: r.responseComment ?? "",
              updatedAt: r.updatedAt ?? null,
            };
          })
          .slice(0, 10);

        const timeline = (responseRows || [])
          .filter((r: any) => r.updatedAt)
          .map((r: any) => ({ date: r.updatedAt, status: r.responseValue }))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
          audit: {
            id: Number((audit as any).id),
            name: (audit as any).name ?? `Audit #${input.auditId}`,
            status: (audit as any).status ?? "draft",
            createdAt: (audit as any).createdAt ?? null,
            updatedAt: (audit as any).updatedAt ?? null,
            siteId: (audit as any).siteId ?? null,
            siteName: (site as any)?.name ?? null,
            referentialIds,
            processIds,
          },
          stats,
          breakdown: {
            status: {
              compliant: stats.compliant,
              partial: stats.partial,
              non_compliant: stats.non_compliant,
              not_applicable: stats.not_applicable,
              in_progress: stats.in_progress,
            },
            criticality: byCriticality,
            process: byProcess,
          },
          topRisks,
          timeline,
        };
      } catch (e: any) {
        const mysql = e?.cause ?? e;
        console.error("[ISO] getAuditDashboard failed:", {
          message: e?.message,
          code: mysql?.code,
          sqlMessage: mysql?.sqlMessage,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: mysql?.sqlMessage || e?.message || "Unable to load audit dashboard",
        });
      }
    }),

  /**
   * ✅ IRCA-like report data for a single ISO audit (download/export)
   * Returns ONLY the questions in the audit scope (drilldown) with their responses.
   */
  getAuditReport: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      try {
        const [audit] = await db
          .select({
            id: (audits as any).id,
            name: (audits as any).name,
            status: (audits as any).status,
            createdAt: (audits as any).createdAt,
            updatedAt: (audits as any).updatedAt,
            siteId: (audits as any).siteId,
            referentialIds: (audits as any).referentialIds,
            processIds: (audits as any).processIds,
          })
          .from(audits)
          .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
          .limit(1);

        if (!audit) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });
        }

        const [site] = audit?.siteId
          ? await db
              .select({ id: (sites as any).id, name: (sites as any).name })
              .from(sites)
              .where(eq((sites as any).id, audit.siteId))
              .limit(1)
          : [null];

        const referentialIds = safeJsonArray<any>((audit as any).referentialIds);
        const processIds = safeJsonArray<any>((audit as any).processIds);

        const referentialId = referentialIds?.[0] ? Number(referentialIds[0]) : null;
        if (!referentialId) throw new TRPCError({ code: "BAD_REQUEST", message: "Référentiel ISO manquant sur l'audit" });

        const candidates = await buildProcessCandidates(db, processIds);
        const selectedDbIds = processIds
          .map((p: any) => (typeof p === "number" ? p : Number(p)))
          .filter((n: number) => Number.isFinite(n) && n > 0);

        const whereParts: any[] = [eq((questions as any).referentialId, referentialId)];

        const hasProcessSelection = processIds.length > 0 && (selectedDbIds.length > 0 || candidates.length > 0);
        if (hasProcessSelection) {
          const orParts: any[] = [];
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
              const ap = sql`COALESCE(${(questions as any).applicableProcesses}, '[]')`;
              if (isNumericString(s)) {
                const n = Number(s);
                return sql`JSON_CONTAINS(${ap}, CAST(${n} AS JSON))`;
              }
              return sql`JSON_CONTAINS(${ap}, JSON_QUOTE(${s}))`;
            });
            orParts.push(sql`(${sql.join(conds, sql` OR `)})`);
          }
          if (orParts.length) whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
        }

        const hasRisksColumn = await hasColumn("questions", "risks");

        const questionRows: any[] = (await db
          .select({
            id: (questions as any).id,
            questionKey: (questions as any).questionKey,
            referentialId: (questions as any).referentialId,
            processId: (questions as any).processId,
            article: (questions as any).article,
            annexe: (questions as any).annexe,
            title: (questions as any).title,
            questionType: (questions as any).questionType,
            questionText: (questions as any).questionText,
            expectedEvidence: (questions as any).expectedEvidence,
            criticality: (questions as any).criticality,
            interviewFunctions: (questions as any).interviewFunctions,
            risk: (questions as any).risk,
            risksRaw: hasRisksColumn ? (questions as any).risks : sql`NULL`,
            displayOrder: (questions as any).displayOrder,
          })
          .from(questions)
          .where(and(...whereParts))
          .orderBy(
            sql`${(questions as any).displayOrder} IS NULL, ${(questions as any).displayOrder} ASC, ${(questions as any).id} ASC`
          )) as any[];

        const scopedKeys = new Set((questionRows || []).map((q: any) => String(q.questionKey)));

        const responseRowsAll = await db
          .select({
            questionKey: (auditResponses as any).questionKey,
            responseValue: (auditResponses as any).responseValue,
            responseComment: (auditResponses as any).responseComment,
            note: (auditResponses as any).note,
            answeredBy: (auditResponses as any).answeredBy,
            answeredAt: (auditResponses as any).answeredAt,
            updatedAt: (auditResponses as any).updatedAt,
          })
          .from(auditResponses)
          .where(and(eq((auditResponses as any).auditId, input.auditId), eq((auditResponses as any).userId, ctx.user.id)));

        const responseRows = (responseRowsAll || []).filter((r: any) => scopedKeys.has(String(r.questionKey)));
        const responsesByKey = new Map((responseRows || []).map((r: any) => [String(r.questionKey), r]));

        const questionsOut = (questionRows || []).map((q: any) => {
          const merged = { ...q, ...(responsesByKey.get(String(q.questionKey)) || {}) };
          const normalized = normalizeIsoQuestion(merged);
          return {
            ...normalized,
            responseValue: (merged as any)?.responseValue ?? "in_progress",
            responseComment: (merged as any)?.responseComment ?? "",
            note: (merged as any)?.note ?? "",
          };
        });

        return {
          audit: {
            id: Number((audit as any).id),
            name: (audit as any).name ?? `Audit #${input.auditId}`,
            status: (audit as any).status ?? "draft",
            createdAt: (audit as any).createdAt ?? null,
            updatedAt: (audit as any).updatedAt ?? null,
            siteId: (audit as any).siteId ?? null,
            siteName: (site as any)?.name ?? null,
            referentialIds,
            processIds,
          },
          questions: questionsOut,
        };
      } catch (e: any) {
        const mysql = e?.cause ?? e;
        console.error("[ISO] getAuditReport failed:", {
          message: e?.message,
          code: mysql?.code,
          sqlMessage: mysql?.sqlMessage,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: mysql?.sqlMessage || e?.message || "Unable to build audit report",
        });
      }
    }),

});
