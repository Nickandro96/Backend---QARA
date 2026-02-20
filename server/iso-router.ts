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
    "risks",
    "riskLevels",
    "tags",
  ];

  for (const f of jsonArrayFields) {
    if (f in out) out[f] = safeJsonArray<any>(out[f]);
  }

  return out;
}

function isNumericString(v: string) {
  return /^\d+$/.test(v);
}

/**
 * Normalise une sélection de processus provenant de l'UI / DB.
 * - accepte: number | string
 * - accepte aussi: { id }, { value }, { processId } (certains composants UI)
 * - ignore les valeurs vides
 */
function normalizeProcessTokens(input: unknown): Array<string | number> {
  const arr = safeJsonArray<any>(input);
  const out: Array<string | number> = [];

  for (const p of arr) {
    if (p == null) continue;
    if (typeof p === "number" || typeof p === "string") {
      const s = String(p).trim();
      if (!s) continue;
      // preserve numeric strings as string here; conversion is handled later
      out.push(typeof p === "number" ? p : s);
      continue;
    }

    if (typeof p === "object") {
      const maybe = (p as any).id ?? (p as any).value ?? (p as any).processId;
      if (maybe == null) continue;
      const s = String(maybe).trim();
      if (!s) continue;
      out.push(isNumericString(s) ? Number(s) : s);
    }
  }

  return out;
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

    try {
      const [audit] = await db
        .select()
        .from(audits)
        .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
        .limit(1);
      if (!audit) throw new Error("Audit introuvable");

      const referentialIds = safeJsonArray<any>((audit as any).referentialIds);
      // ✅ processIds peut parfois contenir des objets (ex: {id,name}) selon l'UI.
      // On normalise pour garantir un filtrage robuste.
      const selectedProcessesRaw = normalizeProcessTokens((audit as any).processIds);

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

      let q = db
        .select()
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

      return { count: normalized.length, questions: normalized };
    } catch (err: any) {
      console.error("[ISO] getQuestionsForAudit error:", err?.stack ?? err);
      throw err;
    }
  }),
});
