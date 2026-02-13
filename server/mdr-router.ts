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
  users,
  referentials,
  auditResponses, // ✅ NEW: required for saveResponse/getResponses
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
        const questions = JSON.parse(rawData);
        console.log(`[MDR] total questions loaded from JSON: ${questions.length} from ${jsonPath}`);
        return questions.map((q: any, idx: number) => ({
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

function safeParseArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
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
    clientOrganization: audit?.clientOrganization ?? null,
    siteLocation: audit?.siteLocation ?? null,
    auditorName: audit?.auditorName ?? null,
    auditorEmail: audit?.auditorEmail ?? null,
    status: audit?.status ?? "draft",
  };
}

// Map selected process tokens from frontend (string IDs) -> numeric processIds in DB
async function mapSelectedProcessesToDbProcessIds(db: any, selected: string[]) {
  if (!selected || selected.length === 0) return [];

  const numericIds = selected
    .filter((x) => typeof x === "number" || isNumericString(x))
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n));

  const stringTokens = selected
    .filter((x) => typeof x === "string" && !isNumericString(x))
    .map((x) => String(x));

  if (stringTokens.length === 0) return numericIds;

  const expectedNames: string[] = [];
  for (const token of stringTokens) {
    const byId = MDR_PROCESSES.find((p) => p.id === token);
    if (byId) expectedNames.push(byId.name);
    else expectedNames.push(token);
  }

  try {
    const allProcs = await db.select().from(processus);
    const nameToId = new Map<string, number>();
    for (const p of allProcs) {
      if (!p?.name) continue;
      nameToId.set(String(p.name).toLowerCase(), Number(p.id));
    }

    const mappedIds: number[] = [];
    for (const nm of expectedNames) {
      const id = nameToId.get(String(nm).toLowerCase());
      if (id && !Number.isNaN(id)) mappedIds.push(id);
    }

    return [...new Set([...numericIds, ...mappedIds])];
  } catch (e) {
    console.warn("[MDR] Unable to map processes via DB table `processus`:", e);
    return numericIds;
  }
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

// ✅ shared zod enum used by frontend buttons
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
      const rows = await db.select().from(sites);
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
   * ✅ Step 1 Wizard: Create or Update draft audit
   */
  createOrUpdateAuditDraft: protectedProcedure
    .input(
      z.object({
        auditId: z.number().optional(),
        siteId: z.number(),
        name: z.string().min(1),
        auditType: z.string().default("internal"),
        status: z.string().default("draft"),
        referentialIds: z.array(z.number()).default([]),
        processIds: z.array(z.string()).default([]),

        clientOrganization: z.string().nullable().optional(),
        siteLocation: z.string().nullable().optional(),
        auditorName: z.string().nullable().optional(),
        auditorEmail: z.string().nullable().optional(),

        economicRole: z.enum(["fabricant", "importateur", "distributeur", "mandataire"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const now = new Date();

      const valuesToSave: any = {
        userId: ctx.user.id,
        siteId: input.siteId,
        name: input.name,
        auditType: input.auditType,
        status: input.status,

        referentialIds: JSON.stringify(input.referentialIds ?? []),
        processIds: JSON.stringify(input.processIds ?? []),

        clientOrganization: input.clientOrganization ?? null,
        siteLocation: input.siteLocation ?? null,
        auditorName: input.auditorName ?? null,
        auditorEmail: input.auditorEmail ?? null,

        economicRole: input.economicRole ?? null,

        updatedAt: now,
      };

      const insertValues: any = { ...valuesToSave, createdAt: now };

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
    }),

  /**
   * ✅ REQUIRED by frontend
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
        // helpful for UI title if you want it
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
        targetMarkets: input.targetMarkets ? JSON.stringify(input.targetMarkets) : null,
        deviceClasses: input.deviceClasses ? JSON.stringify(input.deviceClasses) : null,
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
   * ✅ NEW: Get existing responses for this audit (for current user)
   */
  getResponses: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // ownership check
      await getAuditContextInternal(db, ctx.user.id, input.auditId);

      try {
        // Prefer filtering by auditId; user scoping enforced by ownership already.
        // But if your audit_responses has userId, we also filter by userId (more strict).
        const rows = await db
          .select()
          .from(auditResponses)
          // @ts-ignore (some schemas may not have userId; keep auditId filter minimum)
          .where(
            (auditResponses as any).userId
              ? and(eq((auditResponses as any).auditId, input.auditId), eq((auditResponses as any).userId, ctx.user.id))
              : eq((auditResponses as any).auditId, input.auditId)
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
   * ✅ NEW: Save response (upsert) for current user + audit
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // ownership check
      await getAuditContextInternal(db, ctx.user.id, input.auditId);

      const now = new Date();

      // build values
      const values: any = {
        auditId: input.auditId,
        questionKey: input.questionKey,
        responseValue: input.responseValue,
        responseComment: input.responseComment ?? "",
        note: input.note ?? "",
        evidenceFiles: JSON.stringify(input.evidenceFiles ?? []),
        role: input.role ?? null,
        processId: input.processId ?? null,
        updatedAt: now,
      };

      // if table has userId column, persist it
      // @ts-ignore
      if ((auditResponses as any).userId) values.userId = ctx.user.id;

      try {
        // Try to find existing row (safe even without unique index)
        const whereExpr =
          // @ts-ignore
          (auditResponses as any).userId
            ? and(
                eq((auditResponses as any).auditId, input.auditId),
                eq((auditResponses as any).questionKey, input.questionKey),
                eq((auditResponses as any).userId, ctx.user.id)
              )
            : and(eq((auditResponses as any).auditId, input.auditId), eq((auditResponses as any).questionKey, input.questionKey));

        const [existing] = await db.select().from(auditResponses).where(whereExpr).limit(1);

        if (existing) {
          await db.update(auditResponses).set(values).where(eq((auditResponses as any).id, (existing as any).id));
          return { success: true, mode: "updated" as const };
        }

        // create
        const insertValues: any = { ...values, createdAt: now };
        await db.insert(auditResponses).values(insertValues);
        return { success: true, mode: "created" as const };
      } catch (e: any) {
        console.error("[MDR] saveResponse failed:", e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to save response" });
      }
    }),

  /**
   * Get questions for a given MDR audit, filtered by context
   */
  getQuestionsForAudit: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { auditId, economicRole, processIds, referentialIds } = await getAuditContextInternal(db, ctx.user.id, input.auditId);

      let allQuestions = await loadQuestionsFromDb(db);
      if (allQuestions.length === 0) allQuestions = loadQuestionsFromJson();

      if (allQuestions.length === 0) {
        console.warn("[MDR] No questions found in DB or JSON file.");
        return { questions: [] as any[] };
      }

      let filteredQuestions = allQuestions;

      console.log(
        `[MDR] Filtering questions for audit ${auditId}: economicRole=${economicRole}, processIds=${processIds}, referentialIds=${referentialIds}`
      );

      // Filter by economicRole
      if (economicRole && economicRole !== "all") {
        filteredQuestions = filteredQuestions.filter((q: any) => {
          if (!q.economicRole) return true;
          const qRoles = safeParseArray(q.economicRole).map((r) => String(r).toLowerCase().trim());
          return qRoles.length === 0 || qRoles.includes(economicRole.toLowerCase().trim());
        });
        console.log(`[MDR] Questions after economicRole filter (${economicRole}): ${filteredQuestions.length}`);
      }

      // Filter by referentialIds
      if (referentialIds && referentialIds.length > 0) {
        filteredQuestions = filteredQuestions.filter((q: any) => {
          if (!q.referentialId) return true;
          return referentialIds.includes(Number(q.referentialId));
        });
        console.log(`[MDR] Questions after referentialIds filter (${referentialIds.join(",")}): ${filteredQuestions.length}`);
      }

      // Filter by processIds (if specific processes are selected)
      let questionsAfterProcessFilter = filteredQuestions;
      if (processIds && processIds.length > 0 && !processIds.includes("all")) {
        const dbProcessIds = await mapSelectedProcessesToDbProcessIds(db, processIds);
        console.log(`[MDR] Mapped frontend processIds [${processIds.join(",")}] to DB processIds [${dbProcessIds.join(",")}]`);

        if (dbProcessIds.length > 0) {
          questionsAfterProcessFilter = filteredQuestions.filter((q: any) => {
            if (!q.processId) return false;

            const qApplicableProcesses = safeParseArray(q.applicableProcesses).map((p: string) => String(p).toLowerCase());

            return dbProcessIds.some((dbProcId) => {
              if (Number(q.processId) === Number(dbProcId)) return true;

              const mdrProcess = MDR_PROCESSES.find(
                (p) => p.id === String(dbProcId) || p.name.toLowerCase() === String(dbProcId).toLowerCase()
              );
              return !!(mdrProcess && qApplicableProcesses.includes(mdrProcess.name.toLowerCase()));
            });
          });
        }

        console.log(`[MDR] Questions after processIds filter (${processIds.join(",")}): ${questionsAfterProcessFilter.length}`);

        if (questionsAfterProcessFilter.length === 0 && dbProcessIds.length > 0) {
          console.warn("[MDR] No questions found for specific processes. Falling back to all questions filtered by role/referential.");
          questionsAfterProcessFilter = filteredQuestions;
        }
      }

      const out = questionsAfterProcessFilter.map((q: any) => ({
        id: q.id,
        questionKey: q.questionKey || generateQuestionKey(q),
        questionText: q.questionText,
        article: q.article,
        annexe: q.annexe,
        title: q.title,
        expectedEvidence: q.expectedEvidence,
        criticality: q.criticality,
        // some DBs have "risk" vs "risks"; keep both safely
        risk: (q as any).risk ?? null,
        risks: (q as any).risks ?? null,
        interviewFunctions: safeParseArray(q.interviewFunctions),
        economicRole: q.economicRole,
        applicableProcesses: safeParseArray(q.applicableProcesses),
        referentialId: q.referentialId,
        processId: q.processId,
      }));

      // ✅ return object to match common frontend pattern: data.questions
      return { questions: out };
    }),
});
