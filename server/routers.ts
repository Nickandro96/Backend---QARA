import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Fix: Replace @shared/const alias with relative path
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, requireCapability } from "./_core/trpc";

import * as db from "./db";
import * as dashboardV2 from "./db-dashboard-v2";

import { stripeRouter } from "./stripe/router";
import { FALLBACK_REFERENTIALS, FALLBACK_PROCESSES } from "./fallback-data";

import { fdaRouter } from "./fda-router";
import { mdrRouter } from "./mdr-router";
import { isoRouter } from "./iso-router";
import { classificationRouter } from "./classification-router";
import { scoringRouter } from "./scoring/scoringRouter";
import { capaRouter } from "./capa/capaRouter";
import { reportRouter } from "./report/reportRouter";
import { onboardingRouter } from "./onboarding/onboardingRouter";
import { assistantRouter } from "./assistant/assistant-router";

import { auditRouter } from "./audit-router";
import { watchRouter } from "./watch-router";

import { generateAuditReport } from "./report-generator";
import { assembleReportData } from "./report/reportData";
import { renderReportPdf } from "./report/pdfRenderer";
import { renderReportWord } from "./report/wordRenderer";
import { renderReportExcel } from "./report/excelRenderer";
import { legacyReportGenerationDisabled } from "./report/legacyGeneration";
import {
  auditReports,
  sites as sitesTable,
  referentiels,
  audits as auditsTable,
  organisations as organisationsTable,
  organisationCertificates,
} from "../drizzle/schema";
import { computeGenericAuditScoreSafe } from "./audit-scoring";
import { safeParseArray } from "./mdr-router";
import { findingsRouter, actionsRouter } from "./findings-router";
import { contactRouter } from "./contact-router";
import { documentsRouter } from "./documents-router";

import { storagePut as uploadToS3 } from "./storage";

// -----------------------------
// Helpers
// -----------------------------
const zIsoDate = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d;
  }
  return v;
}, z.date());

// "" / undefined -> null (critical for organisationId or optional strings)
const emptyStringToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

// Correspondance code référentiel (stable) -> clé attendue par le frontend
// (client/src/pages/Dashboard.tsx, REFERENTIAL_DEFS/TRANSVERSE_DEFS). Ce sont
// des identifiants de code, pas des IDs auto-increment — stable par design,
// contrairement à referentialId qui ne doit jamais être codé en dur.
const REFERENTIEL_CODE_TO_FRONTEND_KEY: Record<string, string> = {
  MDR: "mdr",
  IVDR: "ivdr",
  FDA_QMSR: "fda-qmsr",
  MDSAP: "mdsap",
  ISO13485: "iso-13485",
  ISO14971: "iso-14971",
  ISO9001: "iso-9001",
};

/**
 * Frontend expects: trpc.profile.get().activeReferentials (voir
 * client/src/lib/onboarding.ts, hasActiveReferential/getActiveReferentials) —
 * la table `users` n'a jamais eu ce champ, donc ProtectedRoute retombait
 * systématiquement sur le localStorage client (INVENTAIRE-BUGS.md #11),
 * renvoyant même les comptes ayant de vrais audits vers /onboarding dans un
 * navigateur neuf. Dérivé ici des référentiels réellement utilisés par
 * l'utilisateur (n'importe lequel de ses audits, pas seulement le référentiel
 * "primaire" utilisé par getFrameworkScores), pas d'un flag d'achèvement
 * séparé — un utilisateur avec un audit réel a de facto "terminé" l'onboarding.
 */
async function getActiveReferentialCodesForUser(userId: number): Promise<string[]> {
  const dbConn = await db.getDb();
  if (!dbConn) return [];

  const [userAudits, allReferentiels] = await Promise.all([
    dbConn.select({ referentialIds: auditsTable.referentialIds }).from(auditsTable).where(eq(auditsTable.userId, userId)),
    dbConn.select().from(referentiels),
  ]);

  const codeById = new Map(allReferentiels.map((r: any) => [r.id, r.code]));
  const keys = new Set<string>();

  for (const audit of userAudits) {
    for (const refId of safeParseArray((audit as any).referentialIds).map(Number)) {
      const code = codeById.get(refId);
      const key = code ? REFERENTIEL_CODE_TO_FRONTEND_KEY[code] : undefined;
      if (key) keys.add(key);
    }
  }

  return Array.from(keys);
}

/**
 * Score moyen par référentiel (clé frontend), calculé à la volée à partir des
 * audits de l'utilisateur — voir server/audit-scoring.ts pour le pourquoi
 * (la table audits n'a pas de colonne score/conformityRate).
 */
async function getFrameworkScores(userId: number): Promise<Record<string, number>> {
  const dbConn = await db.getDb();
  if (!dbConn) return {};

  const [userAudits, allReferentiels] = await Promise.all([
    dbConn.select().from(auditsTable).where(eq(auditsTable.userId, userId)),
    dbConn.select().from(referentiels),
  ]);

  const codeById = new Map(allReferentiels.map((r: any) => [r.id, r.code]));

  const scoresByKey = new Map<string, number[]>();

  for (const audit of userAudits) {
    const refIds: number[] = safeParseArray((audit as any).referentialIds).map(Number);
    const primaryRefId = refIds[0];
    if (primaryRefId === undefined) continue;

    const code = codeById.get(primaryRefId);
    const key = code ? REFERENTIEL_CODE_TO_FRONTEND_KEY[code] : undefined;
    if (!key) continue;

    const score = await computeGenericAuditScoreSafe(dbConn, userId, (audit as any).id);
    if (score === null) continue;

    if (!scoresByKey.has(key)) scoresByKey.set(key, []);
    scoresByKey.get(key)!.push(score);
  }

  const result: Record<string, number> = {};
  for (const [key, scores] of scoresByKey.entries()) {
    result[key] = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
  }
  return result;
}

const optionalTrimmedStringOrNull = z.preprocess((v: unknown) => {
  if (v === "" || v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}, z.string().nullable());

const optionalIntOrNull = z.preprocess(
  emptyStringToNull,
  z.coerce.number().int().positive().nullable()
);

// -----------------------------
// Router
// -----------------------------
export const appRouter = router({
  system: systemRouter,
  watch: watchRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);

      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });

      return { success: true } as const;
    }),
  }),

  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getUserProfile(ctx.user.id);
      const activeReferentials = await getActiveReferentialCodesForUser(ctx.user.id);
      return { ...profile, activeReferentials };
    }),

    update: protectedProcedure
      .input(
        z.object({
          economicRole: z
            .enum([
              "fabricant",
              "importateur",
              "distributeur",
              "manufacturer_us",
              "specification_developer",
              "contract_manufacturer",
              "initial_importer",
            ])
            .optional(),
          companyName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  /**
   * ✅ IMPORTANT
   * Frontend calls: trpc.sites.create / trpc.sites.list
   * We implement them here using Drizzle directly to avoid db.createSite() inserting organisationId = "".
   */
  sites: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const database = await db.requireDb();

      const rows = await database
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.userId, ctx.user.id))
        .orderBy(desc(sitesTable.createdAt));

      return { sites: rows };
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2),

          // Optional strings (normalized to null)
          code: optionalTrimmedStringOrNull.optional(),
          addressLine1: optionalTrimmedStringOrNull.optional(),
          addressLine2: optionalTrimmedStringOrNull.optional(),
          city: optionalTrimmedStringOrNull.optional(),
          postalCode: optionalTrimmedStringOrNull.optional(),
          country: optionalTrimmedStringOrNull.optional(),
          phone: optionalTrimmedStringOrNull.optional(),
          email: optionalTrimmedStringOrNull.optional(),
          notes: optionalTrimmedStringOrNull.optional(),

          isMainSite: z.coerce.boolean().optional().default(false),
          isActive: z.coerce.boolean().optional().default(true),

          // ✅ Critical bug fix: accept "" / undefined -> null
          organisationId: optionalIntOrNull.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const database = await db.requireDb();

        const values = {
          userId: ctx.user.id,
          name: input.name.trim(),

          code: input.code ?? null,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          postalCode: input.postalCode ?? null,
          country: input.country ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,

          isMainSite: input.isMainSite ?? false,
          isActive: input.isActive ?? true,

          // ✅ never send "" to MySQL
          organisationId: input.organisationId ?? null,

          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result: any = await database.insert(sitesTable).values(values);

        const insertedId = result?.[0]?.insertId ?? result?.insertId ?? null;

        return { id: insertedId, ...values };
      }),

    getDefaultOrCreate: protectedProcedure.query(async ({ ctx }) => {
      const database = await db.requireDb();

      const [existing] = await database
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.userId, ctx.user.id))
        .orderBy(desc(sitesTable.createdAt))
        .limit(1);

      if (existing) return existing;

      const values = {
        userId: ctx.user.id,
        name: "Default Site",
        addressLine1: "N/A",
        addressLine2: null,
        city: "N/A",
        postalCode: "N/A",
        country: "N/A",
        phone: null,
        email: null,
        notes: null,
        code: null,
        isMainSite: true,
        isActive: true,
        organisationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result: any = await database.insert(sitesTable).values(values);
      const insertedId = result?.[0]?.insertId ?? result?.insertId ?? null;

      return { id: insertedId, ...values };
    }),
  }),

  organizations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgsList = await db.getOrganisations(ctx.user.id);
      return { organizations: orgsList };
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2),
          legalEntityType: z.string().optional(),
          siret: z.string().optional(),
          addressLine1: z.string().optional(),
          addressLine2: z.string().optional(),
          city: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await db.createOrganisation({
          ...input,
          userId: ctx.user.id,
        });
      }),

    /**
     * Bloc « Profil réglementaire » (Tâche D.7, migration 0027, validé par
     * l'utilisateur le 2026-07-23) : SRN, PRRC, organisme notifié. Tous
     * facultatifs — "Non renseigné" dans le rapport si absents.
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(2).optional(),
          legalEntityType: z.string().optional(),
          siret: z.string().optional(),
          addressLine1: z.string().optional(),
          addressLine2: z.string().optional(),
          city: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
          srn: z.string().optional(),
          logoUrl: z.string().optional(),
          prrcName: z.string().optional(),
          prrcQualification: z.string().optional(),
          notifiedBodyName: z.string().optional(),
          notifiedBodyNumber: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const database = await db.requireDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const org = await db.getOrganisationByIdAndUserId(input.id, ctx.user.id);
        if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation non trouvée" });

        const { id, ...fields } = input;
        const patch: Record<string, any> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) patch[key] = value;
        }
        if (Object.keys(patch).length === 0) return { success: true };

        await database
          .update(organisationsTable)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(organisationsTable.id, input.id), eq(organisationsTable.userId, ctx.user.id)));
        return { success: true };
      }),

    certificates: router({
      list: protectedProcedure
        .input(z.object({ organisationId: z.number() }))
        .query(async ({ ctx, input }) => {
          const database = await db.requireDb();
          if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

          const org = await db.getOrganisationByIdAndUserId(input.organisationId, ctx.user.id);
          if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation non trouvée" });

          const rows = await database
            .select()
            .from(organisationCertificates)
            .where(eq(organisationCertificates.organisationId, input.organisationId))
            .orderBy(desc(organisationCertificates.createdAt));
          return { certificates: rows };
        }),

      upsert: protectedProcedure
        .input(
          z.object({
            id: z.number().optional(),
            organisationId: z.number(),
            referentialCode: z.string().optional(),
            certificateNumber: z.string().optional(),
            issueDate: z.string().optional(),
            expiryDate: z.string().optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const database = await db.requireDb();
          if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

          const org = await db.getOrganisationByIdAndUserId(input.organisationId, ctx.user.id);
          if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation non trouvée" });

          const values = {
            organisationId: input.organisationId,
            referentialCode: input.referentialCode ?? null,
            certificateNumber: input.certificateNumber ?? null,
            issueDate: input.issueDate ? new Date(input.issueDate) : null,
            expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          };

          if (input.id) {
            await database
              .update(organisationCertificates)
              .set({ ...values, updatedAt: new Date() })
              .where(
                and(eq(organisationCertificates.id, input.id), eq(organisationCertificates.organisationId, input.organisationId))
              );
            return { id: input.id };
          }

          const result: any = await database.insert(organisationCertificates).values(values);
          return { id: result?.[0]?.insertId ?? result?.insertId ?? null };
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number(), organisationId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const database = await db.requireDb();
          if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

          const org = await db.getOrganisationByIdAndUserId(input.organisationId, ctx.user.id);
          if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation non trouvée" });

          await database
            .delete(organisationCertificates)
            .where(
              and(eq(organisationCertificates.id, input.id), eq(organisationCertificates.organisationId, input.organisationId))
            );
          return { success: true };
        }),
    }),
  }),

  referentials: router({
    // ✅ enabledOnly optionnel, défaut false (comportement inchangé pour
    // tout appelant existant — voir CORRECTIONS.md). Seule l'étape 0 du
    // wizard générique passe enabledOnly: true.
    list: publicProcedure
      .input(z.object({ enabledOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        try {
          const refs = await db.getAllReferentials();
          const filtered = input?.enabledOnly ? refs.filter((r: any) => r.enabled !== false) : refs;
          return filtered.length > 0 ? filtered : FALLBACK_REFERENTIALS;
        } catch {
          return FALLBACK_REFERENTIALS;
        }
      }),
  }),

  processes: router({
    list: publicProcedure.query(async () => {
      try {
        const procs = await db.getAllProcesses();
        return procs.length > 0 ? procs : FALLBACK_PROCESSES;
      } catch {
        return FALLBACK_PROCESSES;
      }
    }),
  }),

  // --------------------------------------------
  // Audits (CRUD principal - ton code custom)
  // --------------------------------------------
  audits: router({
    list: protectedProcedure
      .input(
        z
          .object({
            status: z
              .enum(["draft", "planned", "in_progress", "completed", "closed", "cancelled"])
              .optional(),
            siteId: z.number().int().positive().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return await db.getAudits({
          userId: ctx.user.id,
          ...input,
        });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const audit = await db.getAuditById(input.id, ctx.user.id);
        if (!audit) {
          throw new Error("Audit non trouvé");
        }
        return audit;
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2),
          siteId: z.number().int().positive(),
          organizationId: z.number().optional(),
          auditType: z.enum(["internal", "supplier", "mock"]),
          standard: z.string().optional(),
          auditStandard: z.string().optional(),
          economicRole: z.string().optional(),
          referentialIds: z.array(z.number()).default([1]),
          processesSelected: z.array(z.union([z.string(), z.number()])).optional(),

          startDate: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),
          endDate: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),

          plannedStartDate: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),
          plannedEndDate: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),

          actualStartDate: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),
          actualEndDate: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),

          openingMeetingAt: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),
          closingMeetingAt: z.preprocess((arg) => (arg instanceof Date ? arg.toISOString() : arg), z.string().optional()),

          auditedEntityName: z.string().optional(),
          auditedEntityAddress: z.string().optional(),
          leadAuditorName: z.string().optional(),
          leadAuditorEmail: z.string().optional(),

          auditLeader: z.string().optional(),
          auditTeamMembers: z.string().optional(),
          auditeeMainContact: z.string().optional(),

          summary: z.string().optional(),
          conclusion: z.string().optional(),
          recommendation: z.string().optional(),

          nbNC_major: z.number().optional(),
          nbNC_minor: z.number().optional(),
          nbObs: z.number().optional(),

          exclusions: z.string().optional(),
          productFamilies: z.string().optional(),
          classDevices: z.string().optional(),
          markets: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;

        const auditId = await db.createAudit({
          userId,
          siteId: input.siteId,
          name: input.name,
          auditType: input.auditType,
          status: "draft",

          // ✅ colonnes date
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,

          // ✅ JSON blobs alignés
          referentialIds: JSON.stringify(input.referentialIds),
          processIds: JSON.stringify(input.processesSelected ?? []),

          // ✅ champs “affichage” si colonnes existantes dans ta table audits
          clientOrganization: input.auditedEntityName ?? null,
          siteLocation: input.auditedEntityAddress ?? null,
          auditorName: input.leadAuditorName ?? null,
          auditorEmail: input.leadAuditorEmail ?? null,
        });

        return { auditId };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(2).optional(),
          auditStandard: z.string().optional(),
          auditType: z.string().optional(),
          economicRole: z.string().optional(),
          processesSelected: z.array(z.union([z.string(), z.number()])).optional(),
          referentialIds: z.array(z.number()).optional(),
          siteId: z.number().int().positive().optional(),
          organizationId: z.number().optional(),

          auditObjective: z.string().optional(),
          auditScope: z.string().optional(),
          auditCriteria: z.string().optional(),
          auditProgramRef: z.string().optional(),

          auditMethod: z.enum(["on_site", "remote", "hybrid"]).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          auditLanguage: z.string().optional(),

          auditeeContactName: z.string().optional(),
          auditeeContactEmail: z.string().optional(),
          auditeeContactPhone: z.string().optional(),

          leadAuditorName: z.string().optional(),
          leadAuditorEmail: z.string().optional(),

          auditors: z
            .array(
              z.object({
                name: z.string(),
                role: z.string(),
                email: z.string().optional(),
              })
            )
            .optional(),
          observers: z
            .array(
              z.object({
                name: z.string(),
                role: z.string().optional(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...updateData } = input;

        const audit = await db.getAuditById(id, ctx.user.id);
        if (!audit) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Audit not found or does not belong to the user",
          });
        }

        // Resolve siteId and organizationId if provided
        if (updateData.siteId) {
          const siteExists = await db.getSiteByIdAndUserId(updateData.siteId, ctx.user.id);
          if (!siteExists) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid siteId",
            });
          }
        }
        if (updateData.organizationId) {
          const organizationExists = await db.getOrganisationByIdAndUserId(updateData.organizationId, ctx.user.id);
          if (!organizationExists) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid organizationId",
            });
          }
        }

        try {
          await db.updateAudit(id, {
            ...updateData,

            startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
            endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,

            auditors: updateData.auditors ? JSON.stringify(updateData.auditors) : undefined,
            observers: updateData.observers ? JSON.stringify(updateData.observers) : undefined,

            // ✅ on n’écrit PAS dans “processesSelected” DB, on aligne sur processIds
            processIds: updateData.processesSelected ? JSON.stringify(updateData.processesSelected) : undefined,

            referentialIds: updateData.referentialIds ? JSON.stringify(updateData.referentialIds) : undefined,

            // Optionnel: si ton DB a ces colonnes et que tu veux les maintenir
            auditorName: updateData.leadAuditorName ?? undefined,
            auditorEmail: updateData.leadAuditorEmail ?? undefined,
          });

          return { success: true };
        } catch (error: any) {
          console.error("[AUDIT UPDATE] Database update failed:", error.message, {
            userId: ctx.user.id,
            auditId: id,
            error: error,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update audit: " + error.message,
            cause: error,
          });
        }
      }),

    // ✅✅✅ AJOUT ICI : audits.updateMetadata (pour corriger ton erreur NOT_FOUND)
    updateMetadata: protectedProcedure
      .input(
        z.object({
          // ✅ accepte id OU auditId (le front envoie parfois auditId)
          id: z.number().optional(),
          auditId: z.number().optional(),

          referentialIds: z.array(z.number()).optional(),
          processesSelected: z.array(z.union([z.string(), z.number()])).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const resolvedId = input.id ?? input.auditId;

        if (!resolvedId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing audit id (expected 'id' or 'auditId')",
          });
        }

        const audit = await db.getAuditById(resolvedId, ctx.user.id);
        if (!audit) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Audit not found or does not belong to the user",
          });
        }

        await db.updateAudit(resolvedId, {
          referentialIds: input.referentialIds ? JSON.stringify(input.referentialIds) : undefined,
          processIds: input.processesSelected ? JSON.stringify(input.processesSelected) : undefined,
          notes: input.notes ?? undefined,
        });

        return { success: true };
      }),

    start: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const audit = await db.getAuditById(input.id, ctx.user.id);
        if (!audit) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Audit not found or does not belong to the user",
          });
        }
        try {
          await db.updateAudit(input.id, {
            status: "in_progress",
            startDate: new Date(),
          });
          return { success: true };
        } catch (error: any) {
          console.error("[AUDIT START] Database update failed:", error.message, {
            userId: ctx.user.id,
            auditId: input.id,
            error: error,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start audit: " + error.message,
            cause: error,
          });
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const audit = await db.getAuditById(input.id, ctx.user.id);
        if (!audit) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Audit not found or does not belong to the user",
          });
        }
        try {
          await db.deleteAudit(input.id);
          return { success: true };
        } catch (error: any) {
          console.error("[AUDIT DELETE] Database deletion failed:", error.message, {
            userId: ctx.user.id,
            auditId: input.id,
            error: error,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete audit: " + error.message,
            cause: error,
          });
        }
      }),
  }),

  // --------------------------------------------
  // Dashboard — uniquement les deux procédures réellement appelées par
  // client/src/pages/Dashboard.tsx (le tableau de bord réel, routé sur
  // /dashboard). Les autres procédures qui existaient ici (getStats direct,
  // getTimeseries, getRadar direct, getDrilldown direct, getScoring,
  // getSuggestions, getScoreTrend, getProcessProgress, getSummary, getFunnel,
  // getHeatmap) n'étaient appelées que par DashboardV2.tsx/DashboardExecutive.tsx
  // /DrilldownModal.tsx — trois composants jamais routés (voir App.tsx) et
  // supprimés (Tâche C, CORRECTIONS.md). Supprimées avec eux plutôt que
  // laissées en code mort.
  // --------------------------------------------
  dashboard: router({
    // Front expects: trpc.dashboard.getKPIs()
    getKPIs: protectedProcedure.query(async ({ ctx }) => {
      const stats: any = await dashboardV2.getDashboardStats(ctx.user.id, {});

      // Frontend (client/src/pages/Dashboard.tsx) attend aussi frameworkScores,
      // un score par référentiel (cartes "chaque référentiel" + normes
      // transverses) — commenté "TODO(data): pas d'endpoint backend..." côté
      // client jusqu'ici. Calculé ici à la volée par code de référentiel
      // (jamais par ID en dur), même barème que audit.getScore.
      const frameworkScores = await getFrameworkScores(ctx.user.id);

      // We return a stable shape even if dashboardV2 changes internally
      return {
        scoreGlobal: stats?.averageAuditScore ?? stats?.globalScore ?? stats?.scoreGlobal ?? 0,
        progression:
          stats?.totalAudits > 0
            ? Math.round(
                (((stats?.auditsByStatus?.completed ?? 0) + (stats?.auditsByStatus?.closed ?? 0)) /
                  stats.totalAudits) *
                  1000
              ) / 10
            : (stats?.completionRate ?? stats?.progression ?? 0),
        conforme: stats?.findingsByType?.positive ?? stats?.okCount ?? stats?.conforme ?? 0,
        nonConforme:
          (stats?.findingsByType?.nc_major ?? 0) + (stats?.findingsByType?.nc_minor ?? 0) ||
          stats?.nokCount ||
          stats?.nonConforme ||
          0,
        nonConformitiesCount:
          (stats?.findingsByType?.nc_major ?? 0) + (stats?.findingsByType?.nc_minor ?? 0) ||
          stats?.nokCount ||
          stats?.nonConformitiesCount ||
          0,
        frameworkScores,
      };
    }),

    // Front expects: trpc.dashboard.getRecentFindings({ limit })
    getRecentFindings: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(5) }))
      .query(async ({ ctx, input }) => {
        const drill: any = await dashboardV2.getDashboardDrilldown(
          ctx.user.id,
          "findings",
          {},
          { page: 1, pageSize: input.limit },
          { field: "createdAt", order: "desc" }
        );

        return drill?.items ?? drill?.data ?? [];
      }),

  }),

  // Stripe payment router
  stripe: stripeRouter,

  // FDA Audit System
  fda: fdaRouter,

  // MDR Audit System
  mdr: mdrRouter,

  // ISO Audit System
  iso: isoRouter,

  // MDR Device Classification (Annex VIII helper)
  classification: classificationRouter,

  // Moteur de scoring multi-référentiel (Lot 2)
  scoring: scoringRouter,

  // Plan d'action CAPA (Lot 3)
  capa: capaRouter,

  // Rapport d'audit multi-référentiel (Lot 4)
  report: reportRouter,

  // Onboarding (sélection du périmètre : référentiels, rôles, marchés MDSAP)
  onboarding: onboardingRouter,

  // Assistant IA réglementaire (mode utilisateur + mode auditeur)
  assistant: assistantRouter,

  // Audit Management (ton router existant)
  audit: auditRouter,

  // Front expects: trpc.findings.list / trpc.actions.list (AuditDetail.tsx)
  // — voir INVENTAIRE-BUGS.md #4, namespaces absents jusqu'ici.
  findings: findingsRouter,
  actions: actionsRouter,

  // Front expects: trpc.contact.submit/list/updateStatus (Contact.tsx,
  // AdminContacts.tsx) — voir INVENTAIRE-BUGS.md #6/#8.
  contact: contactRouter,

  // Front expects: trpc.documents.* (Documents.tsx) — voir
  // INVENTAIRE-BUGS.md #7. Bibliothèque de documents vide (pas de contenu
  // réglementaire fabriqué), IA réelle via ANTHROPIC_API_KEY si configurée.
  documents: documentsRouter,

  // --------------------------------------------
  // Reports
  // --------------------------------------------
  reports: router({
    // Front expects: trpc.reports.generate(...) - gaté client-side par
    // hasCapability("canExportReports", ...) dans Reports.tsx. Jamais
    // contrôlé côté serveur jusqu'ici (voir server/plans/capabilities.ts).
    generate: requireCapability("canExportReports")
      .input(
        z.object({
          auditId: z.number(),
          reportType: z.enum(["complete", "executive", "comparative", "action_plan", "evidence_index"]),
          includeGraphs: z.boolean().optional().default(true),
          includeEvidence: z.boolean().optional().default(true),
          includeActionPlan: z.boolean().optional().default(true),
          comparedAuditIds: z.array(z.number()).optional(),
          language: z.enum(["fr", "en"]).optional().default("fr"),
        })
      )
      .mutation(() => legacyReportGenerationDisabled()),

    /**
     * Tâche D — nouveau générateur (PDF/Word/Excel, bilingue), consomme
     * l'objet ReportData assemblé une seule fois (reportData.ts) pour
     * garantir des chiffres identiques entre les trois formats. Séparé de
     * `generate` (l'ancien générateur PDF seul) plutôt que de le remplacer
     * en place — même logique de dépréciation progressive que Reports.tsx/
     * exportUtils.ts (D.0) : l'ancien chemin reste disponible en repli tant
     * que le nouveau n'est pas validé en production.
     */
    generateV2: requireCapability("canExportReports")
      .input(
        z.object({
          auditId: z.number(),
          format: z.enum(["pdf", "word", "excel"]),
          language: z.enum(["fr", "en"]).default("fr"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const reportData = await assembleReportData(input.auditId, ctx.user.id, input.language);

        let buffer: Buffer;
        let mimeType: string;
        let extension: string;
        if (input.format === "pdf") {
          buffer = await renderReportPdf(reportData);
          mimeType = "application/pdf";
          extension = "pdf";
        } else if (input.format === "word") {
          buffer = await renderReportWord(reportData);
          mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          extension = "docx";
        } else {
          buffer = await renderReportExcel(reportData);
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          extension = "xlsx";
        }

        const fileName = `audit-report-${input.auditId}-${input.language}-${Date.now()}.${extension}`;
        const fileKey = `reports/${ctx.user.id}/${fileName}`;
        const { url: fileUrl } = await uploadToS3(fileKey, buffer, mimeType);

        const database = await db.requireDb();
        const insertResult: any = await database.insert(auditReports).values({
          auditId: input.auditId,
          userId: ctx.user.id,
          reportUrl: fileUrl,
          reference: reportData.reportReference,
          version: reportData.reportVersion,
          status: "draft",
          language: input.language,
        });

        return {
          success: true,
          reportId: insertResult?.[0]?.insertId ?? insertResult?.insertId,
          fileUrl,
          fileName,
        };
      }),

    list: protectedProcedure
      .input(
        z.object({
          auditId: z.number().optional(),
          limit: z.number().optional().default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        const database = await db.requireDb();

        const conditions = [eq(auditReports.userId, ctx.user.id)];
        if (input.auditId) {
          conditions.push(eq(auditReports.auditId, input.auditId));
        }

        const reports = await database
          .select()
          .from(auditReports)
          .where(and(...conditions))
          .orderBy(desc(auditReports.createdAt))
          .limit(input.limit);

        return reports;
      }),

    get: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await db.requireDb();
        const [report] = await database
          .select()
          .from(auditReports)
          .where(and(eq(auditReports.id, input.reportId), eq(auditReports.userId, ctx.user.id)));

        if (!report) {
          throw new Error("Report not found");
        }

        return report;
      }),

    delete: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.requireDb();
        await database
          .delete(auditReports)
          .where(and(eq(auditReports.id, input.reportId), eq(auditReports.userId, ctx.user.id)));

        return { success: true };
      }),

    compare: protectedProcedure
      .input(
        z.object({
          audit1Id: z.number(),
          audit2Id: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message: "La comparaison de rapports n'est pas encore disponible dans le générateur V2",
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
// Trigger redeployment
