import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  audits,
  questions,
  processus,
  mdrRoleQualifications,
  sites,
  auditResponses,
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Define MDR_PROCESSES locally to avoid import issues during build
const MDR_PROCESSES = [
  { id: "gov_strat", name: "Gouvernance & stratégie réglementaire", displayOrder: 1 },
  { id: "ra", name: "Affaires réglementaires (RA)", displayOrder: 2 },
  { id: "qms", name: "Système de management qualité (QMS)", displayOrder: 3 },
  { id: "risk_mgmt", name: "Gestion des risques (ISO 14971)", displayOrder: 4 },
  { id: "design_dev", name: "Conception & développement", displayOrder: 5 },
  { id: "purchasing_suppliers", name: "Achats & fournisseurs", displayOrder: 6 },
  { id: "production_sub", name: "Production & sous-traitance", displayOrder: 7 },
  { id: "traceability_udi", name: "Traçabilité / UDI", displayOrder: 8 },
  { id: "pms_pmcf", name: "PMS / PMCF", displayOrder: 9 },
  { id: "vigilance_incidents", name: "Vigilance & incidents", displayOrder: 10 },
  { id: "distribution_logistics", name: "Distribution & logistique", displayOrder: 11 },
  { id: "importation", name: "Importation", displayOrder: 12 },
  { id: "tech_doc", name: "Documentation technique", displayOrder: 13 },
  { id: "audits_conformity", name: "Audits & conformité", displayOrder: 14 },
  { id: "it_data_cybersecurity", name: "IT / données / cybersécurité", displayOrder: 15 },
];

// Helper to generate a stable questionKey for JSON questions (fallback)
const generateQuestionKey = (question: any): string => {
  const keyString = `${question.article || ""}-${question.processId || ""}-${question.questionText || ""}`;
  return `q_${crypto.createHash("md5").update(keyString).digest("hex")}`;
};

// Helper to load questions from JSON file (fallback only)
const loadQuestionsFromJson = (): any[] => {
  const possiblePaths = [
    path.join(process.cwd(), "server", "all-questions-data.json"),
    path.join(process.cwd(), "dist", "server", "all-questions-data.json"),
  ];

  for (const jsonPath of possiblePaths) {
    if (fs.existsSync(jsonPath)) {
      try {
        const rawData = fs.readFileSync(jsonPath, "utf-8");
        const qs = JSON.parse(rawData);
        console.log(`[MDR] total questions loaded from JSON: ${qs.length} from ${jsonPath}`);
        return (qs || []).map((q: any, idx: number) => ({
          ...q,
          questionKey: q.questionKey || generateQuestionKey(q),
          id: q.id || idx + 1,
        }));
      } catch (e) {
        console.error(`[MDR] Error loading MDR questions from JSON file ${jsonPath}:`, e);
      }
    }
  }
  console.warn("[MDR] all-questions-data.json NOT FOUND in any path.");
  return [];
};

function isNumericString(v: any) {
  return typeof v === "string" && /^[0-9]+$/.test(v);
}

function normalizeEconomicRole(v: any): string {
  if (!v) return "fabricant";
  const s = String(v).toLowerCase().trim();
  if (["fabricant", "importateur", "distributeur", "mandataire"].includes(s)) return s;
  // tolérance EN si jamais
  if (["manufacturer"].includes(s)) return "fabricant";
  if (["importer"].includes(s)) return "importateur";
  if (["distributor"].includes(s)) return "distributeur";
  if (["authorized representative", "authorised representative", "ar"].includes(s)) return "mandataire";
  return "fabricant";
}

/**
 * ✅ IMPORTANT: safeParseArray robuste
 * - supporte JSON array
 * - supporte le cas double-encodé: "\"[\"purchasing_suppliers\"]\""
 */
function safeParseArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;

      // double-encoded array as string
      if (typeof parsed === "string") {
        try {
          const parsed2 = JSON.parse(parsed);
          return Array.isArray(parsed2) ? parsed2 : [];
        } catch {
          return [];
        }
      }

      return [];
    } catch {
      return [];
    }
  }

  // drizzle json() peut remonter un objet non-array
  return [];
}


function extractProcessToken(x: any): string {
  if (x === null || x === undefined) return "";
  if (typeof x === "string" || typeof x === "number") return String(x).trim();

  // sometimes stored as objects in audits.processIds: {id, slug, value, processId, name}
  if (typeof x === "object") {
    const cand =
      (x as any).slug ??
      (x as any).id ??
      (x as any).value ??
      (x as any).processId ??
      (x as any).process ??
      "";
    if (cand) return String(cand).trim();
  }
  return "";
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

/**
 * Normalize audit row for frontend:
 * - auditId MUST be a number
 * - referentialIds/processIds MUST be arrays (not JSON strings)
 */
function normalizeAuditForFrontend(audit: any) {
  const referentialIds = safeParseArray(audit?.referentialIds)
    .map((n: any) => Number(n))
    .filter((n: any) => !Number.isNaN(n));

  const processIds = safeParseArray(audit?.processIds).map(extractProcessToken).filter(Boolean);

  return {
    ...audit,
    id: Number(audit?.id),
    userId: Number(audit?.userId),
    siteId: audit?.siteId === null || audit?.siteId === undefined ? null : Number(audit?.siteId),
    referentialIds,
    processIds,
    clientOrganization: (audit as any)?.clientOrganization ?? null,
    siteLocation: (audit as any)?.siteLocation ?? null,
    auditorName: (audit as any)?.auditorName ?? null,
    auditorEmail: (audit as any)?.auditorEmail ?? null,
    status: audit?.status ?? "draft",
  };
}

/**
 * ✅ RÉSOUDRE les process sélectionnés en IDs DB (processus.id)
 * - entrée: slugs (distribution_logistics) et/ou IDs numériques (string)
 * - sortie: array number[] (IDs DB)
 */
async function resolveProcessDbIds(db: any, selected: string[]): Promise<number[]> {
  const sel = (selected || []).map((x) => String(x)).filter(Boolean);
  if (sel.length === 0) return [];

  // 1) IDs numériques directement fournis
  const numericIds = sel.filter((x) => isNumericString(x)).map((x) => Number(x));

  // 2) slugs -> names (via MDR_PROCESSES)
  const slugs = sel.filter((x) => !isNumericString(x) && x !== "all");
  const names = slugs
    .map((slug) => MDR_PROCESSES.find((p) => p.id === slug)?.name)
    .filter(Boolean) as string[];

  let dbIds: number[] = [...numericIds];

  // 3) names -> ids via DB (processus)
  if (names.length > 0) {
    try {
      // ⚠️ IMPORTANT: select UNIQUEMENT id/name pour éviter l'erreur updatedAt manquant
      const rows = await db
        .select({
          id: (processus as any).id,
          name: (processus as any).name,
        })
        .from(processus)
        .where(
          sql`${(processus as any).name} in (${sql.join(
            names.map((n) => sql`${n}`),
            sql`, `
          )})`
        );

      dbIds.push(...(rows || []).map((r: any) => Number(r.id)));
    } catch (e) {
      console.warn("[MDR] resolveProcessDbIds failed (names->ids):", e);
    }
  }

  // dedupe + keep finite
  dbIds = Array.from(new Set(dbIds)).filter((n) => Number.isFinite(n));
  return dbIds;
}

/**
 * ✅ Build process candidates matching questions.applicableProcesses
 * - tokens + canonical names
 * - numeric ids -> DB processus.name
 */
async function buildApplicableProcessCandidates(db: any, selected: string[]) {
  if (!selected || selected.length === 0) return [];

  const tokens = selected
    .filter((x) => x && x !== "all" && !isNumericString(String(x)))
    .map(String);

  const numeric = selected
    .filter((x) => x && x !== "all" && isNumericString(String(x)))
    .map((x) => Number(x));

  const candidates: string[] = [];

  // 1) tokens + names
  for (const t of tokens) {
    candidates.push(t);
    const p = MDR_PROCESSES.find((x) => x.id === t);
    if (p?.name) candidates.push(p.name);
  }

  // 2) numeric -> processus.name (safe select id/name only)
  if (numeric.length > 0) {
    try {
      const rows = await db
        .select({
          id: (processus as any).id,
          name: (processus as any).name,
        })
        .from(processus)
        .where(
          sql`${(processus as any).id} in (${sql.join(
            numeric.map((n) => sql`${n}`),
            sql`, `
          )})`
        );

      for (const r of rows || []) {
        if ((r as any)?.name) candidates.push(String((r as any).name));
      }
    } catch (e) {
      console.warn("[MDR] Unable to map numeric process IDs to names via `processus`:", e);
    }
  }

  // 3) ALSO add numeric strings as candidates (au cas où applicableProcesses stocke "11" en string)
  for (const n of numeric) candidates.push(String(n));

  return [...new Set(candidates.map((s) => String(s).trim()).filter(Boolean))];
}

// Internal helper: get audit context WITHOUT calling tRPC endpoints
async function getAuditContextInternal(db: any, userId: number, auditId: number) {
  const [audit] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);

  if (!audit) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Audit not found or does not belong to user",
    });
  }

  let economicRole = normalizeEconomicRole((audit as any).economicRole);

  // fallback: try MDR qualification profile
  if (!economicRole) {
    const [qualification] = await db
      .select()
      .from(mdrRoleQualifications)
      .where(eq(mdrRoleQualifications.userId, userId))
      .limit(1);

    economicRole = normalizeEconomicRole(qualification?.economicRole);
  }

  const processIds = safeParseArray((audit as any).processIds).map(String);

  const referentialIds = safeParseArray((audit as any).referentialIds)
    .map((n: any) => Number(n))
    .filter((n: any) => !Number.isNaN(n));

  return {
    audit,
    auditId: Number((audit as any).id),
    siteId: (audit as any).siteId,
    economicRole,
    processIds,
    referentialIds,
  };
}


const QUESTION_SELECT = {
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

  // ✅ single source of truth in DB is `risk`
  risk: (questions as any).risk,
  // ✅ backward-compatible alias for older front code
  risks: (questions as any).risk,

  interviewFunctions: (questions as any).interviewFunctions,
  actionPlan: (questions as any).actionPlan,
  aiPrompt: (questions as any).aiPrompt,

  displayOrder: (questions as any).displayOrder,
  createdAt: (questions as any).createdAt,
} as const;

async function loadQuestionsFromDb(db: any) {
  try {
    const rows = await db.select(QUESTION_SELECT).from(questions);
    console.log("[MDR] total questions loaded from DB:", rows.length);
    return rows;
  } catch (e) {
    console.warn("[MDR] Unable to load questions from DB table `questions`:", e);
    return [];
  }
}

// shared zod enum used by frontend buttons
const ResponseValueEnum = z.enum(["compliant", "non_compliant", "not_applicable", "partial", "in_progress"]);

export const mdrRouter = router({
  /**
   * Get user's sites
   */
  getSites: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const anyDb: any = db as any;
    if (typeof anyDb.getSites === "function") {
      return anyDb.getSites(ctx.user.id);
    }

    try {
      // must be user-scoped
      const rows = await db.select().from(sites).where(eq(sites.userId, ctx.user.id));
      return rows;
    } catch (e) {
      console.error("[MDR] getSites fallback failed:", e);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to load sites" });
    }
  }),

  /**
   * Get canonical list of MDR processes
   */
  getProcesses: protectedProcedure.query(() => {
    console.log("[MDR] processes returned:", MDR_PROCESSES.length);
    return { processes: MDR_PROCESSES };
  }),

  /**
   * Step 1 Wizard: Create or Update draft audit
   */
  createOrUpdateAuditDraft: protectedProcedure
    .input(
      z.object({
        auditId: z.number().optional(),
        siteId: z.number(),
        name: z.string().min(1),

        // accept both
        auditType: z.string().optional(),
        type: z.string().optional(),

        status: z.string().default("draft"),
        referentialIds: z.array(z.number()).default([]),
        processIds: z.array(z.string()).default([]),

        clientOrganization: z.string().nullable().optional(),
        siteLocation: z.string().nullable().optional(),
        auditorName: z.string().nullable().optional(),
        auditorEmail: z.string().nullable().optional(),

        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),

        economicRole: z.enum(["fabricant", "importateur", "distributeur", "mandataire"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const now = new Date();

      const resolvedType = String(input.type ?? input.auditType ?? "internal");
      const resolvedStartDate = input.startDate ? new Date(input.startDate) : now;
      const resolvedEndDate = input.endDate ? new Date(input.endDate) : null;

      const valuesToSave: any = {
        userId: ctx.user.id,
        siteId: input.siteId,
        name: input.name,

        type: resolvedType,
        status: input.status,

        referentialIds: input.referentialIds ?? [],
        processIds: input.processIds ?? [],

        clientOrganization: input.clientOrganization ?? null,
        siteLocation: input.siteLocation ?? null,
        auditorName: input.auditorName ?? null,
        auditorEmail: input.auditorEmail ?? null,

        startDate: resolvedStartDate,
        endDate: resolvedEndDate,

        economicRole: input.economicRole ?? null,
        updatedAt: now,
      };

      const insertValues: any = { ...valuesToSave, createdAt: now };

      try {
        if (input.auditId) {
          const [existing] = await db
            .select()
            .from(audits)
            .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
            .limit(1);

          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Audit not found or not owned by user" });
          }

          await db.update(audits).set(valuesToSave).where(eq(audits.id, input.auditId));

          const [updated] = await db
            .select()
            .from(audits)
            .where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id)))
            .limit(1);

          const normalized = normalizeAuditForFrontend(updated);
          return { auditId: Number(normalized.id), audit: normalized };
        }

        await db.insert(audits).values(insertValues);

        const [created] = await db
          .select()
          .from(audits)
          .where(and(eq(audits.userId, ctx.user.id), eq(audits.siteId, input.siteId), eq(audits.name, input.name)))
          .orderBy(sql`${audits.id} desc`)
          .limit(1);

        if (!created) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Audit created but could not be fetched" });
        }

        const normalized = normalizeAuditForFrontend(created);
        return { auditId: Number(normalized.id), audit: normalized };
      } catch (e: any) {
        const mysql = e?.cause ?? e;
        console.error("[MDR] createOrUpdateAuditDraft failed:", {
          message: e?.message,
          errno: mysql?.errno,
          code: mysql?.code,
          sqlState: mysql?.sqlState,
          sqlMessage: mysql?.sqlMessage,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: mysql?.sqlMessage || e?.message || "Unable to create/update audit",
        });
      }
    }),

  /**
   * REQUIRED by frontend
   */
  getAuditContext: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const auditContext = await getAuditContextInternal(db, ctx.user.id, input.auditId);

      return {
        auditId: Number(auditContext.auditId),
        siteId: auditContext.siteId,
        economicRole: auditContext.economicRole,
        processIds: Array.isArray(auditContext.processIds)
          ? auditContext.processIds
          : safeParseArray(auditContext.processIds).map(String),
        referentialIds: Array.isArray(auditContext.referentialIds)
          ? auditContext.referentialIds
          : safeParseArray(auditContext.referentialIds)
              .map((n: any) => Number(n))
              .filter((n: any) => !Number.isNaN(n)),
        auditName: (auditContext.audit as any)?.name ?? null,
      };
    }),

  /**
   * Save MDR Role Qualification
   */
  saveQualification: protectedProcedure
    .input(
      z.object({
        siteId: z.number().optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "mandataire"]),
        hasAuthorizedRepresentative: z.boolean().default(false),
        targetMarkets: z.array(z.string()).optional(),
        deviceClasses: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database not available" };

      const [existing] = await db
        .select()
        .from(mdrRoleQualifications)
        .where(
          input.siteId
            ? and(eq(mdrRoleQualifications.userId, ctx.user.id), eq(mdrRoleQualifications.siteId, input.siteId))
            : eq(mdrRoleQualifications.userId, ctx.user.id)
        )
        .limit(1);

      const qualificationData = {
        economicRole: input.economicRole,
        hasAuthorizedRepresentative: input.hasAuthorizedRepresentative,
        targetMarkets: input.targetMarkets ?? [],
        deviceClasses: input.deviceClasses ?? [],
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(mdrRoleQualifications).set(qualificationData).where(eq(mdrRoleQualifications.id, existing.id));
      } else {
        await db.insert(mdrRoleQualifications).values({
          userId: ctx.user.id,
          siteId: input.siteId || null,
          ...qualificationData,
        });
      }

      return {
        success: true,
        economicRole: input.economicRole,
        message: `Profil MDR enregistré : ${input.economicRole}`,
      };
    }),

  /**
   * Get user's MDR qualification profile
   */
  getQualification: protectedProcedure
    .input(z.object({ siteId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      let qualification = null;
      if (db) {
        try {
          [qualification] = await db
            .select()
            .from(mdrRoleQualifications)
            .where(
              input.siteId
                ? and(eq(mdrRoleQualifications.userId, ctx.user.id), eq(mdrRoleQualifications.siteId, input.siteId))
                : eq(mdrRoleQualifications.userId, ctx.user.id)
            )
            .limit(1);
        } catch (e) {
          console.error("Error fetching MDR qualification:", e);
        }
      }

      return {
        economicRole: qualification?.economicRole || null,
        hasAuthorizedRepresentative: qualification?.hasAuthorizedRepresentative || false,
        targetMarkets: safeParseArray(qualification?.targetMarkets),
        deviceClasses: safeParseArray(qualification?.deviceClasses),
      };
    }),

  /**
   * Get existing responses for this audit (for current user)
   */
  getResponses: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await getAuditContextInternal(db, ctx.user.id, input.auditId);

      try {
        const rows = await db
          .select({
            questionKey: (auditResponses as any).questionKey,
            responseValue: (auditResponses as any).responseValue,
            responseComment: (auditResponses as any).responseComment,
            note: (auditResponses as any).note,
            evidenceFiles: (auditResponses as any).evidenceFiles,
            role: (auditResponses as any).role,
            processId: (auditResponses as any).processId,
            answeredBy: (auditResponses as any).answeredBy,
            answeredAt: (auditResponses as any).answeredAt,
            updatedAt: (auditResponses as any).updatedAt,
          })
          .from(auditResponses)
          .where(
            and(
              eq((auditResponses as any).auditId, input.auditId),
              eq((auditResponses as any).userId, ctx.user.id)
            )
          );

        return {
          responses: (rows || []).map((r: any) => ({
            questionKey: r.questionKey,
            responseValue: r.responseValue,
            responseComment: r.responseComment ?? "",
            note: r.note ?? "",
            evidenceFiles: safeParseArray(r.evidenceFiles),
            role: r.role ?? null,
            processId: r.processId ?? null,
            answeredBy: r.answeredBy ?? null,
            answeredAt: r.answeredAt ?? null,
            updatedAt: r.updatedAt ?? null,
          })),
        };
      } catch (e: any) {
        console.error("[MDR] getResponses failed:", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to load responses" });
      }
    }),


  /**
   * List audits for current user (history / dashboard)
   */
  listAudits: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    try {
      const rows = await db
        .select({
          id: (audits as any).id,
          name: (audits as any).name,
          status: (audits as any).status,
          createdAt: (audits as any).createdAt,
          updatedAt: (audits as any).updatedAt,
          siteId: (audits as any).siteId,
          economicRole: (audits as any).economicRole,
          referentialIds: (audits as any).referentialIds,
        })
        .from(audits)
        .where(eq((audits as any).userId, ctx.user.id))
        .orderBy(sql`${(audits as any).updatedAt} desc, ${(audits as any).id} desc`);

      return {
        audits: (rows || []).map((a: any) => ({
          id: Number(a.id),
          name: a.name ?? `Audit #${a.id}`,
          status: a.status ?? "draft",
          createdAt: a.createdAt ?? null,
          updatedAt: a.updatedAt ?? null,
          siteId: a.siteId ?? null,
          economicRole: a.economicRole ?? null,
          referentialIds: safeParseArray(a.referentialIds).map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)),
        })),
      };
    } catch (e: any) {
      console.error("[MDR] listAudits failed:", e);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to list audits" });
    }
  }),

  /**
   * Mark audit as completed (optional, safe fallback)
   */
  completeAudit: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await getAuditContextInternal(db, ctx.user.id, input.auditId);

      try {
        await db
          .update(audits)
          .set({ status: "completed", updatedAt: new Date() } as any)
          .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)));

        return { success: true };
      } catch (e: any) {
        const mysql = e?.cause ?? e;
        console.error("[MDR] completeAudit failed:", {
          message: e?.message,
          code: mysql?.code,
          sqlMessage: mysql?.sqlMessage,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: mysql?.sqlMessage || e?.message || "Unable to complete audit",
        });
      }
    }),

  /**
   * Dashboard aggregates for a single audit
   */
  getAuditDashboard: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await getAuditContextInternal(db, ctx.user.id, input.auditId);

      try {
        const [audit] = await db
          .select({
            id: (audits as any).id,
            name: (audits as any).name,
            status: (audits as any).status,
            createdAt: (audits as any).createdAt,
            updatedAt: (audits as any).updatedAt,
            siteId: (audits as any).siteId,
            economicRole: (audits as any).economicRole,
            referentialIds: (audits as any).referentialIds,
          })
          .from(audits)
          .where(and(eq((audits as any).id, input.auditId), eq((audits as any).userId, ctx.user.id)))
          .limit(1);

        const [site] = audit?.siteId
          ? await db
              .select({ id: (sites as any).id, name: (sites as any).name })
              .from(sites)
              .where(eq((sites as any).id, audit.siteId))
              .limit(1)
          : [null];

        const questionRows = await db
          .select({
            questionKey: (questions as any).questionKey,
            questionText: (questions as any).questionText,
            article: (questions as any).article,
            criticality: (questions as any).criticality,
            processId: (questions as any).processId,
          })
          .from(questions);

        const responseRows = await db
          .select({
            questionKey: (auditResponses as any).questionKey,
            responseValue: (auditResponses as any).responseValue,
            responseComment: (auditResponses as any).responseComment,
            note: (auditResponses as any).note,
            updatedAt: (auditResponses as any).updatedAt,
          })
          .from(auditResponses)
          .where(
            and(
              eq((auditResponses as any).auditId, input.auditId),
              eq((auditResponses as any).userId, ctx.user.id)
            )
          );

        const qMap = new Map((questionRows || []).map((q: any) => [q.questionKey || generateQuestionKey(q), q]));
        const totalQuestions = (questionRows || []).length;

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

        const byCriticality: Record<string, { non_compliant: number; partial: number }> = {};
        const byProcess: Record<string, { compliant: number; partial: number; non_compliant: number; not_applicable: number; in_progress: number }> = {};

        const scoreMap: Record<string, number> = {
          compliant: 100,
          partial: 60,
          non_compliant: 20,
          not_applicable: 100,
          in_progress: 50,
        };

        let scoreTotal = 0;

        for (const r of responseRows || []) {
          const status = String(r.responseValue || "in_progress");
          if (!(status in stats)) continue;

          stats[status] += 1;
          stats.answered += status === "in_progress" ? 0 : 1;
          scoreTotal += scoreMap[status] ?? 50;

          const q = qMap.get(r.questionKey);
          const crit = String((q as any)?.criticality || "unknown").toLowerCase();
          if (!byCriticality[crit]) byCriticality[crit] = { non_compliant: 0, partial: 0 };
          if (status === "non_compliant") byCriticality[crit].non_compliant += 1;
          if (status === "partial") byCriticality[crit].partial += 1;

          const pid = String((q as any)?.processId ?? "non_renseigne");
          if (!byProcess[pid]) {
            byProcess[pid] = { compliant: 0, partial: 0, non_compliant: 0, not_applicable: 0, in_progress: 0 };
          }
          (byProcess[pid] as any)[status] += 1;
        }

        const denominator = (responseRows || []).length || 1;
        stats.score = Math.round(scoreTotal / denominator);
        stats.in_progress = Math.max(totalQuestions - (responseRows || []).length, 0);

        const topRisks = (responseRows || [])
          .filter((r: any) => r.responseValue === "non_compliant" || r.responseValue === "partial")
          .map((r: any) => {
            const q = qMap.get(r.questionKey) || {};
            return {
              questionKey: r.questionKey,
              questionText: (q as any).questionText ?? "Question",
              article: (q as any).article ?? null,
              criticality: (q as any).criticality ?? "unknown",
              responseValue: r.responseValue,
              note: r.note ?? "",
              responseComment: r.responseComment ?? "",
              updatedAt: r.updatedAt ?? null,
            };
          })
          .sort((a: any, b: any) => {
            const rank = (c: string) => {
              const v = String(c || "").toLowerCase();
              if (v.includes("critical") || v.includes("high") || v.includes("élev")) return 3;
              if (v.includes("medium") || v.includes("moy")) return 2;
              return 1;
            };
            return rank(b.criticality) - rank(a.criticality);
          })
          .slice(0, 10);

        const timeline = (responseRows || [])
          .filter((r: any) => r.updatedAt)
          .map((r: any) => ({ date: r.updatedAt, status: r.responseValue }))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
          audit: {
            id: Number(audit?.id),
            name: audit?.name ?? `Audit #${input.auditId}`,
            status: audit?.status ?? "draft",
            createdAt: audit?.createdAt ?? null,
            updatedAt: audit?.updatedAt ?? null,
            siteId: audit?.siteId ?? null,
            siteName: (site as any)?.name ?? null,
            economicRole: audit?.economicRole ?? null,
            referentialIds: safeParseArray((audit as any)?.referentialIds),
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
        console.error("[MDR] getAuditDashboard failed:", {
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
   * Save response (upsert) for current user + audit
   */
  saveResponse: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        questionKey: z.string().min(1),
        responseValue: ResponseValueEnum,
        responseComment: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
        role: z.string().optional().nullable(),
        processId: z.string().optional().nullable(),
        evidenceFiles: z.array(z.string()).optional().default([]),
        answeredBy: z.union([z.number(), z.string()]).optional().nullable(),
        answeredAt: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await getAuditContextInternal(db, ctx.user.id, input.auditId);

      const now = new Date();
      const normalizedProcessId = input.processId && isNumericString(input.processId) ? Number(input.processId) : null;
      const normalizedAnsweredBy =
        input.answeredBy === null || input.answeredBy === undefined || input.answeredBy === ""
          ? ctx.user.id
          : Number(input.answeredBy);

      const parsedAnsweredAt = input.answeredAt ? new Date(input.answeredAt) : null;
      const normalizedAnsweredAt =
        parsedAnsweredAt && !Number.isNaN(parsedAnsweredAt.getTime()) ? parsedAnsweredAt : now;

      const values: any = {
        auditId: input.auditId,
        questionKey: input.questionKey,
        responseValue: input.responseValue,
        responseComment: input.responseComment ?? "",
        note: input.note ?? "",
        evidenceFiles: input.evidenceFiles ?? [],
        role: input.role ?? null,
        processId: normalizedProcessId,
        answeredBy: Number.isFinite(normalizedAnsweredBy) ? normalizedAnsweredBy : ctx.user.id,
        answeredAt: normalizedAnsweredAt,
        updatedAt: now,
        userId: ctx.user.id,
      };

      try {
        const whereExpr = and(
          eq((auditResponses as any).auditId, input.auditId),
          eq((auditResponses as any).questionKey, input.questionKey),
          eq((auditResponses as any).userId, ctx.user.id)
        );

        const [existing] = await db
          .select({ id: (auditResponses as any).id })
          .from(auditResponses)
          .where(whereExpr)
          .limit(1);

        if (existing?.id) {
          await db.update(auditResponses).set(values).where(eq((auditResponses as any).id, existing.id));
          return { success: true, mode: "updated" as const };
        }

        const insertValues: any = { ...values, createdAt: now };
        await db.insert(auditResponses).values(insertValues);
        return { success: true, mode: "created" as const };
      } catch (e: any) {
        const mysql = e?.cause ?? e;
        console.error("[MDR] saveResponse failed:", {
          message: e?.message,
          errno: mysql?.errno,
          code: mysql?.code,
          sqlState: mysql?.sqlState,
          sqlMessage: mysql?.sqlMessage,
          payload: {
            auditId: input.auditId,
            questionKey: input.questionKey,
            responseValue: input.responseValue,
            answeredBy: values?.answeredBy,
            answeredAt: values?.answeredAt,
            userId: ctx.user.id,
          },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: mysql?.sqlMessage || e?.message || "Unable to save response",
        });
      }
    }),

  /**
   * ✅ Get questions for a given MDR audit, filtered BY DB
   */
  getQuestionsForAudit: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { auditId, economicRole, processIds, referentialIds } = await getAuditContextInternal(
        db,
        ctx.user.id,
        input.auditId
      );

      const normalizedProcessIds = (processIds || []).map(String);

      // slug(s) -> IDs DB
      const processDbIds = await resolveProcessDbIds(db, normalizedProcessIds);

      // candidates for applicableProcesses JSON matching (names + tokens)
      const processCandidates = await buildApplicableProcessCandidates(db, normalizedProcessIds);

      console.log(
        `[MDR] getQuestionsForAudit audit=${auditId} role=${economicRole} processIds=${JSON.stringify(
          normalizedProcessIds
        )} processDbIds=${JSON.stringify(processDbIds)} processCandidates=${JSON.stringify(
          processCandidates
        )} referentials=${JSON.stringify(referentialIds)}`
      );

      // ---- DB-first ----
      try {
        const whereParts: any[] = [];

        // economicRole VARCHAR (or nullable) – accept generic questions too
        // NOTE: if this filter yields 0 results, we will fallback to "no role filter" (safe mode)
        let economicRoleClause: any | null = null;
        if (economicRole && economicRole !== "all") {
          economicRoleClause = sql`(
              ${(questions as any).economicRole} IS NULL
              OR ${(questions as any).economicRole} = ''
              OR LOWER(${(questions as any).economicRole}) = LOWER(${economicRole})
              OR (
                LOWER(${(questions as any).economicRole}) = 'distributor' AND LOWER(${economicRole}) = 'distributeur'
              )
              OR (
                LOWER(${(questions as any).economicRole}) = 'importer' AND LOWER(${economicRole}) = 'importateur'
              )
              OR (
                LOWER(${(questions as any).economicRole}) = 'manufacturer' AND LOWER(${economicRole}) = 'fabricant'
              )
              OR (
                (LOWER(${(questions as any).economicRole}) = 'authorized representative'
                 OR LOWER(${(questions as any).economicRole}) = 'authorised representative'
                 OR LOWER(${(questions as any).economicRole}) = 'ar')
                AND LOWER(${economicRole}) = 'mandataire'
              )
            )`;
          whereParts.push(economicRoleClause);
        }

        // referentials filter
        if (referentialIds && referentialIds.length > 0) {
          whereParts.push(
            sql`${(questions as any).referentialId} in (${sql.join(
              referentialIds.map((n: number) => sql`${n}`),
              sql`, `
            )})`
          );
        }

        /**
         * ✅ FIX IMPORTANT:
         * On ne fait PAS:
         *   processId IN (...)  AND  JSON_CONTAINS(...)
         * car ça tue tout si la DB n’a pas les deux tags.
         *
         * On fait un SEUL bloc OR:
         * - match via questions.processId
         * - OU questions.applicableProcesses vide/null
         * - OU JSON_CONTAINS(applicableProcesses, candidate)
         */
        const hasAnyProcessFilter = processDbIds.length > 0 || processCandidates.length > 0;

        if (hasAnyProcessFilter) {
          const orParts: any[] = [];

          if (processDbIds.length > 0) {
            orParts.push(
              sql`${(questions as any).processId} in (${sql.join(
                processDbIds.map((n: number) => sql`${n}`),
                sql`, `
              )})`
            );
          }

          // allow generic (no applicableProcesses) questions
          orParts.push(
            sql`${(questions as any).applicableProcesses} IS NULL OR JSON_LENGTH(${(questions as any).applicableProcesses}) = 0`
          );

          if (processCandidates.length > 0) {
            const conds = processCandidates.map((cand) => {
              const s = String(cand);
              if (isNumericString(s)) {
                const n = Number(s);
                return sql`JSON_CONTAINS(${(questions as any).applicableProcesses}, CAST(${n} AS JSON))`;
              }
              const candJson = JSON.stringify(s); // => '"Distribution & logistique"'
              return sql`JSON_CONTAINS(${(questions as any).applicableProcesses}, CAST(${candJson} AS JSON))`;
            });

            orParts.push(sql`(${sql.join(conds, sql` OR `)})`);
          }

          whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
        }

        const finalWhere = whereParts.length > 0 ? and(...whereParts) : undefined;

        let rows = finalWhere
          ? await db
              .select()
              .from(questions)
              .where(finalWhere)
              .orderBy((questions as any).displayOrder, (questions as any).id)
          : await db
              .select()
              .from(questions)
              .orderBy((questions as any).displayOrder, (questions as any).id);

        // Fallback: if role-specific filter yields nothing, retry without role filter.
        if (rows.length === 0 && economicRoleClause) {
          const wherePartsNoRole = whereParts.filter((p) => p !== economicRoleClause);
          const finalWhereNoRole = wherePartsNoRole.length > 0 ? and(...wherePartsNoRole) : undefined;

          rows = finalWhereNoRole
            ? await db
                .select()
                .from(questions)
                .where(finalWhereNoRole)
                .orderBy((questions as any).displayOrder, (questions as any).id)
            : await db
                .select()
                .from(questions)
                .orderBy((questions as any).displayOrder, (questions as any).id);

          console.log(`[MDR] role-filter returned 0 → fallback without role filter (role=${economicRole}) => ${rows.length}`);
        }

        console.log(`[MDR] DB filtered questions count: ${rows.length}`);

        const out = (rows || []).map((q: any) => ({
          id: q.id,
          questionKey: q.questionKey || generateQuestionKey(q),
          questionText: q.questionText,
          questionType: q.questionType ?? null,
          article: q.article,
          annexe: q.annexe,
          title: q.title,

          expectedEvidence: q.expectedEvidence ?? null,
          criticality: q.criticality ?? null,

          risks: normalizeRisksValue((q as any).risk ?? null),

          interviewFunctions: safeParseArray(q.interviewFunctions),
          economicRole: q.economicRole ?? null,
          applicableProcesses: safeParseArray(q.applicableProcesses),

          referentialId: q.referentialId ?? null,
          processId: q.processId ?? null,

          displayOrder: q.displayOrder ?? null,
        }));

        // ✅ Standard return shape for frontend (wizard expects { questions })
        return {
          questions: out,
          meta: {
            auditId,
            economicRole,
            selectedProcessIds: normalizedProcessIds,
            processDbIds,
            processCandidates,
            referentialIds: referentialIds || [],
            total: out.length,
            filteredByDb: true,
          },
        };
      } catch (e: any) {
        console.warn("[MDR] DB filtering failed, fallback to JSON. Error:", e?.message ?? e);
      }

      // ---- Fallback ----
      let allQuestions = await loadQuestionsFromDb(db);
      if (allQuestions.length === 0) allQuestions = loadQuestionsFromJson();

      if (allQuestions.length === 0) {
        console.warn("[MDR] No questions found in DB or JSON file.");
        return {
          questions: [] as any[],
          meta: { auditId, total: 0, filteredByDb: false },
        };
      }

      let filtered = allQuestions;

      // role filter
      if (economicRole && economicRole !== "all") {
        filtered = filtered.filter((q: any) => {
          if (!q.economicRole) return true;
          const v = String(q.economicRole).toLowerCase().trim();
          const r = String(economicRole).toLowerCase().trim();
          if (v === r) return true;
          if (v === "distributor" && r === "distributeur") return true;
          if (v === "importer" && r === "importateur") return true;
          if (v === "manufacturer" && r === "fabricant") return true;
          if ((v === "authorized representative" || v === "authorised representative" || v === "ar") && r === "mandataire") return true;
          return false;
        });
      }

      if (referentialIds && referentialIds.length > 0) {
        filtered = filtered.filter((q: any) => {
          if (!q.referentialId) return true;
          return referentialIds.includes(Number(q.referentialId));
        });
      }

      // process filter fallback: OR logic too
      if (processDbIds.length > 0 || processCandidates.length > 0) {
        const wanted = processCandidates.map((x) => String(x).toLowerCase());
        filtered = filtered.filter((q: any) => {
          const pidOk =
            processDbIds.length > 0 &&
            q.processId !== null &&
            q.processId !== undefined &&
            processDbIds.includes(Number(q.processId));

          const ap = safeParseArray(q.applicableProcesses).map((p: any) => String(p).toLowerCase());
          const apOk =
            !q.applicableProcesses ||
            ap.length === 0 ||
            (wanted.length > 0 && wanted.some((w) => ap.includes(w)));

          return pidOk || apOk;
        });
      }

      const out = filtered.map((q: any) => ({
        id: q.id,
        questionKey: q.questionKey || generateQuestionKey(q),
        questionText: q.questionText,
        questionType: q.questionType ?? null,
        article: q.article,
        annexe: q.annexe,
        title: q.title,
        expectedEvidence: q.expectedEvidence ?? null,
        criticality: q.criticality ?? null,
        risks: normalizeRisksValue((q as any).risk ?? null),
        interviewFunctions: safeParseArray(q.interviewFunctions),
        economicRole: q.economicRole ?? null,
        applicableProcesses: safeParseArray(q.applicableProcesses),
        referentialId: q.referentialId ?? null,
        processId: q.processId ?? null,
        displayOrder: q.displayOrder ?? null,
      }));

      // ✅ Standard return shape for frontend (wizard expects { questions })
      return {
        questions: out,
        meta: {
          auditId,
          economicRole,
          selectedProcessIds: normalizedProcessIds,
          processDbIds,
          processCandidates,
          referentialIds: referentialIds || [],
          total: out.length,
          filteredByDb: false,
        },
      };
    }),
});
