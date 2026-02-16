import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Fix: Replace @shared/const alias with relative path
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

import * as db from "./db";
import * as dashboardV2 from "./db-dashboard-v2";

import { stripeRouter } from "./stripe/router";
import { FALLBACK_REFERENTIALS, FALLBACK_PROCESSES } from "./fallback-data";

import { fdaRouter } from "./fda-router";
import { mdrRouter } from "./mdr-router";
import { isoRouter } from "./iso-router";

import { auditRouter } from "./audit-router";
import { siteRouter } from "./site-router";

import { generateAuditReport } from "./report-generator";
import { auditReports, sites as sitesTable } from "../drizzle/schema";

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

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);

      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      return { success: true } as const;
    }),
  }),

  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserProfile(ctx.user.id);
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
      const database = await db.getDb();

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
        const database = await db.getDb();

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
      const database = await db.getDb();

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
  }),

  referentials: router({
    list: publicProcedure.query(async () => {
      try {
        const refs = await db.getAllReferentials();
        return refs.length > 0 ? refs : FALLBACK_REFERENTIALS;
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
  // Dashboard (fix dates JSON)
  // --------------------------------------------
  dashboard: router({
    getStats: protectedProcedure
      .input(
        z
          .object({
            period: z
              .object({
                start: zIsoDate,
                end: zIsoDate,
              })
              .optional(),
            siteId: z.number().int().positive().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardStats(ctx.user.id, input);
      }),

    getTimeseries: protectedProcedure
      .input(
        z
          .object({
            period: z
              .object({
                start: zIsoDate,
                end: zIsoDate,
              })
              .optional(),
            siteId: z.number().int().positive().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardTimeseries(ctx.user.id, input);
      }),

    getRadar: protectedProcedure
      .input(
        z
          .object({
            period: z
              .object({
                start: zIsoDate,
                end: zIsoDate,
              })
              .optional(),
            siteId: z.number().int().positive().optional(),
            auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardRadar(ctx.user.id, input);
      }),

    getDrilldown: protectedProcedure
      .input(
        z.object({
          type: z.enum(["findings", "actions", "audits"]),
          filters: z
            .object({
              processId: z.number().optional(),
              findingType: z.string().optional(),
              criticality: z.string().optional(),
              status: z.string().optional(),
              siteId: z.number().int().positive().optional(),
            })
            .optional(),
          pagination: z.object({
            page: z.number(),
            pageSize: z.number(),
          }),
          sort: z.object({
            field: z.string(),
            order: z.enum(["asc", "desc"]),
          }),
        })
      )
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardDrilldown(
          ctx.user.id,
          input.type,
          input.filters || {},
          input.pagination,
          input.sort
        );
      }),

    getScoring: protectedProcedure
      .input(
        z
          .object({
            market: z.enum(["eu", "us", "all"]).optional(),
            referentialIds: z.array(z.number()).optional(),
            economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
            period: z
              .object({
                start: zIsoDate,
                end: zIsoDate,
              })
              .optional(),
            siteId: z.number().int().positive().optional(),
            auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
            criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardScoring(ctx.user.id, input);
      }),

    getSuggestions: protectedProcedure
      .input(
        z
          .object({
            market: z.enum(["eu", "us", "all"]).optional(),
            referentialIds: z.array(z.number()).optional(),
            economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
            period: z
              .object({
                start: zIsoDate,
                end: zIsoDate,
              })
              .optional(),
            siteId: z.number().int().positive().optional(),
            auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
            criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardStats(ctx.user.id, input);
      }),

    // ==========================================================
    // ✅ COMPATIBILITY LAYER (for legacy /dashboard frontend calls)
    // ==========================================================

    // Front expects: trpc.dashboard.getKPIs()
    getKPIs: protectedProcedure.query(async ({ ctx }) => {
      const stats: any = await dashboardV2.getDashboardStats(ctx.user.id, {});

      // We return a stable shape even if dashboardV2 changes internally
      return {
        scoreGlobal: stats?.globalScore ?? stats?.scoreGlobal ?? 0,
        progression: stats?.completionRate ?? stats?.progression ?? 0,
        conforme: stats?.okCount ?? stats?.conforme ?? 0,
        nonConforme: stats?.nokCount ?? stats?.nonConforme ?? 0,
        nonConformitiesCount: stats?.nokCount ?? stats?.nonConformitiesCount ?? 0,
      };
    }),

    // Front expects: trpc.dashboard.getScoreTrend()
    getScoreTrend: protectedProcedure.query(async ({ ctx }) => {
      // If V2 already returns a timeseries array, we forward it.
      // If it returns an object, we still forward (frontend should adapt).
      return await dashboardV2.getDashboardTimeseries(ctx.user.id, {});
    }),

    // Front expects: trpc.dashboard.getProcessProgress()
    getProcessProgress: protectedProcedure.query(async ({ ctx }) => {
      const radar: any = await dashboardV2.getDashboardRadar(ctx.user.id, {});
      // If V2 provides process progress, return it; else fallback to empty.
      return radar?.processProgress ?? radar?.processes ?? radar?.items ?? [];
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

  // Audit Management (ton router existant)
  audit: auditRouter,

  // ✅ Keep existing mount for compatibility (does not affect trpc.sites.*)
  site: siteRouter,

  // --------------------------------------------
  // Reports
  // --------------------------------------------
  reports: router({
    generate: protectedProcedure
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
      .mutation(async ({ ctx, input }) => {
        try {
          const pdfBuffer = await generateAuditReport(input);

          // Upload to S3
          const fileName = `audit-report-${input.auditId}-${Date.now()}.pdf`;
          const fileKey = `reports/${ctx.user.id}/${fileName}`;
          const { url: fileUrl } = await uploadToS3(fileKey, pdfBuffer, "application/pdf");

          // Save report metadata to database
          const database = await db.getDb();
          const [report] = await database
            .insert(auditReports)
            .values({
              auditId: input.auditId,
              userId: ctx.user.id,
              reportType: input.reportType,
              reportTitle: `Rapport d'audit #${input.auditId}`,
              reportVersion: "1.0",
              fileKey,
              fileUrl,
              fileSize: pdfBuffer.length,
              fileFormat: "pdf",
              generatedBy: ctx.user.id,
              metadata: JSON.stringify({
                includeGraphs: input.includeGraphs,
                includeEvidence: input.includeEvidence,
                includeActionPlan: input.includeActionPlan,
              }),
            })
            .returning();

          return {
            success: true,
            reportId: report.id,
            fileUrl,
            fileName,
          };
        } catch (error: any) {
          console.error("[Reports] Generate error:", error);
          throw new Error(`Failed to generate report: ${error.message}`);
        }
      }),

    list: protectedProcedure
      .input(
        z.object({
          auditId: z.number().optional(),
          limit: z.number().optional().default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        const database = await db.getDb();

        const conditions = [eq(auditReports.userId, ctx.user.id)];
        if (input.auditId) {
          conditions.push(eq(auditReports.auditId, input.auditId));
        }

        const reports = await database
          .select()
          .from(auditReports)
          .where(and(...conditions))
          .orderBy(auditReports.generatedAt)
          .limit(input.limit);

        return reports;
      }),

    get: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await db.getDb();
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
        const database = await db.getDb();
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
        const comparison = await db.compareAudits(input.audit1Id, input.audit2Id, ctx.user.id);
        if (!comparison) {
          throw new Error("Unable to compare audits. Make sure both audits exist and belong to you.");
        }
        return comparison;
      }),
  }),
});

export type AppRouter = typeof appRouter;
// Trigger redeployment
