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

  const processIds = safeParseArray(audit?.processIds).map((x: any) => String(x));

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
 *
 * NOTE: matching robuste (accents/espaces/variantes)
 */
async function resolveProcessDbIds(db: any, selected: string[]): Promise<number[]> {
  const sel = (selected || []).map((x) => String(x)).filter(Boolean);
  if (sel.length === 0) return [];

  // 1) IDs numériques directement fournis
  const numericIds = sel.filter((x) => isNumericString(x)).map((x) => Number(x));

  // 2) slugs -> names (via MDR_PROCESSES)
  const slugs = sel.filter((x) => !isNumericString(x) && x !== "all");
  const targetNames = slugs
    .map((slug) => MDR_PROCESSES.find((p) => p.id === slug)?.name)
    .filter(Boolean) as string[];

  let dbIds: number[] = [...numericIds];

  if (targetNames.length === 0) {
    return Array.from(new Set(dbIds)).filter((n) => Number.isFinite(n));
  }

  const norm = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/\s+/g, " ");

  try {
    // ⚠️ IMPORTANT: select UNIQUEMENT id/name pour éviter l'erreur updatedAt manquant
    const rows = await db
      .select({
        id: (processus as any).id,
        name: (processus as any).name,
      })
      .from(processus);

    const mapNormToId = new Map<string, number>();
    for (const r of rows || []) {
      const n = (r as any)?.name ? norm(String((r as any).name)) : "";
      const id = Number((r as any)?.id);
      if (n && Number.isFinite(id)) mapNormToId.set(n, id);
    }

    // exact match (normalized)
    for (const tn of targetNames) {
      const hit = mapNormToId.get(norm(tn));
      if (hit) dbIds.push(hit);
    }

    // fuzzy inclusion (fallback)
    for (const tn of targetNames) {
      const ntn = norm(tn);
      if (mapNormToId.has(ntn)) continue;

      for (const [k, id] of mapNormToId.entries()) {
        if (k.includes(ntn) || ntn.includes(k)) {
          dbIds.push(id);
          break;
        }
      }
    }
  } catch (e) {
    console.warn("[MDR] resolveProcessDbIds failed:", e);
  }

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

  // 3) ALSO add numeric strings as candidates (au cas où applicableProcesses stocke "7" en string)
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

  // ✅ IMPORTANT: processIds/referentialIds are JSON columns -> they must be arrays
  // but can be double-encoded in old data => safeParseArray handles it.
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

async function loadQuestionsFromDb(db: any) {
  try {
    const rows = await db.select().from(questions);
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

      /**
       * ✅ IMPORTANT:
       * processIds / referentialIds are JSON columns => store ARRAYS, NOT JSON strings
       */
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

      /**
       * ✅ IMPORTANT: targetMarkets/deviceClasses are JSON columns => store arrays, not JSON strings
       */
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
   * select only needed columns
   */
  getResponses: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // ownership check
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
            updatedAt: (auditResponses as any).updatedAt,
          })
          .from(auditResponses)
          .where(
            and(
              eq((auditResponses as any).auditId, input.auditId),
              eq((auditResponses as any).userId, ctx.user.id)
            )
          );

        return (rows || []).map((r: any) => ({
          questionKey: r.questionKey,
          responseValue: r.responseValue,
          responseComment: r.responseComment ?? "",
          note: r.note ?? "",
          evidenceFiles: safeParseArray(r.evidenceFiles),
          role: r.role ?? null,
          processId: r.processId ?? null,
          updatedAt: r.updatedAt ?? null,
        }));
      } catch (e: any) {
        console.error("[MDR] getResponses failed:", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to load responses" });
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
        processId: z.string().optional().nullable(), // token or numeric string
        evidenceFiles: z.array(z.string()).optional().default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // ownership check
      await getAuditContextInternal(db, ctx.user.id, input.auditId);

      const now = new Date();
      const normalizedProcessId = input.processId && isNumericString(input.processId) ? Number(input.processId) : null;

      /**
       * ✅ IMPORTANT: evidenceFiles is JSON column => store array (not JSON.stringify)
       */
      const values: any = {
        auditId: input.auditId,
        questionKey: input.questionKey,
        responseValue: input.responseValue,
        responseComment: input.responseComment ?? "",
        note: input.note ?? "",
        evidenceFiles: input.evidenceFiles ?? [],
        role: input.role ?? null,
        processId: normalizedProcessId,
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
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: mysql?.sqlMessage || e?.message || "Unable to save response",
        });
      }
    }),

  /**
   * Get questions for a given MDR audit, filtered BY DB
   * economicRole is VARCHAR in DB
   *
   * ✅ FIXES:
   * - mapping slug -> processDbIds (robuste)
   * - filtres "NULL-friendly" (si la DB n'a pas tagué processId/referentialId => on n'exclut pas)
   * - JSON applicableProcesses conservé
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

      // ✅ slug(s) -> IDs DB (robuste)
      const processDbIds = await resolveProcessDbIds(db, normalizedProcessIds);

      // ✅ candidates (utile si applicableProcesses est utilisé)
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

        // economicRole VARCHAR (or nullable)
        if (economicRole && economicRole !== "all") {
          whereParts.push(
            sql`(
              ${(questions as any).economicRole} IS NULL
              OR ${(questions as any).economicRole} = ''
              OR LOWER(${(questions as any).economicRole}) = LOWER(${economicRole})
            )`
          );
        }

        // referentials filter (NULL-friendly)
        if (referentialIds && referentialIds.length > 0) {
          whereParts.push(
            sql`(
              ${(questions as any).referentialId} IS NULL
              OR ${(questions as any).referentialId} in (${sql.join(
                referentialIds.map((n: number) => sql`${n}`),
                sql`, `
              )})
            )`
          );
        }

        // processId FK filter (NULL-friendly)
        if (processDbIds.length > 0) {
          whereParts.push(
            sql`(
              ${(questions as any).processId} IS NULL
              OR ${(questions as any).processId} in (${sql.join(
                processDbIds.map((n: number) => sql`${n}`),
                sql`, `
              )})
            )`
          );
        }

        // applicableProcesses JSON filter (NULL/empty-friendly)
        if (processCandidates.length > 0) {
          const conds = processCandidates.map((cand) => {
            const s = String(cand);
            const candJson = JSON.stringify(s); // => '"token"'
            return sql`JSON_CONTAINS(${(questions as any).applicableProcesses}, CAST(${candJson} AS JSON))`;
          });

          whereParts.push(
            sql`(
              ${(questions as any).applicableProcesses} IS NULL
              OR JSON_LENGTH(${(questions as any).applicableProcesses}) = 0
              OR (${sql.join(conds, sql` OR `)})
            )`
          );
        }

        const finalWhere = whereParts.length > 0 ? and(...whereParts) : undefined;

        const rows = finalWhere
          ? await db
              .select()
              .from(questions)
              .where(finalWhere)
              .orderBy((questions as any).displayOrder, (questions as any).id)
          : await db
              .select()
              .from(questions)
              .orderBy((questions as any).displayOrder, (questions as any).id);

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

          risks: normalizeRisksValue(q.risks ?? q.risk ?? null),

          interviewFunctions: safeParseArray(q.interviewFunctions),
          economicRole: q.economicRole ?? null,
          applicableProcesses: safeParseArray(q.applicableProcesses),

          referentialId: q.referentialId ?? null,
          processId: q.processId ?? null,

          displayOrder: q.displayOrder ?? null,
        }));

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
        return { questions: [] as any[], meta: { auditId, total: 0, filteredByDb: false } };
      }

      // ✅ Fallback "safe": ne PAS exclure si fields manquants en DB
      let filtered = allQuestions;

      // role (NULL-friendly)
      if (economicRole && economicRole !== "all") {
        filtered = filtered.filter((q: any) => {
          if (!q.economicRole) return true;
          return String(q.economicRole).toLowerCase().trim() === economicRole.toLowerCase().trim();
        });
      }

      // referential (NULL-friendly)
      if (referentialIds && referentialIds.length > 0) {
        filtered = filtered.filter((q: any) => {
          if (q.referentialId === null || q.referentialId === undefined || q.referentialId === "") return true;
          return referentialIds.includes(Number(q.referentialId));
        });
      }

      // process (NULL-friendly)
      if (processDbIds.length > 0) {
        filtered = filtered.filter((q: any) => {
          if (q.processId === null || q.processId === undefined || q.processId === "") return true;
          return processDbIds.includes(Number(q.processId));
        });
      } else if (processCandidates.length > 0) {
        const wanted = processCandidates.map((x) => String(x).toLowerCase());
        filtered = filtered.filter((q: any) => {
          if (!q.applicableProcesses) return true;
          const qApplicable = safeParseArray(q.applicableProcesses).map((p: any) => String(p).toLowerCase());
          return wanted.some((w) => qApplicable.includes(w));
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
        risks: normalizeRisksValue((q as any).risks ?? (q as any).risk ?? null),
        interviewFunctions: safeParseArray(q.interviewFunctions),
        economicRole: q.economicRole ?? null,
        applicableProcesses: safeParseArray(q.applicableProcesses),
        referentialId: q.referentialId ?? null,
        processId: q.processId ?? null,
        displayOrder: q.displayOrder ?? null,
      }));

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
