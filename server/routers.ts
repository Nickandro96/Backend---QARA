import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as analyticsDb from "./db-analytics";
import * as dashboardDb from "./db-dashboard";
import * as dashboardV2 from "./db-dashboard-v2";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { deviceClassifications } from "../drizzle/schema";
import { getDb } from "./db";
import { stripeRouter } from "./stripe/router";
import { FALLBACK_REFERENTIALS, FALLBACK_PROCESSES } from "./fallback-data";
import { fdaRouter } from "./fda-router";
import { mdrRouter } from "./mdr-router";
import { isoRouter } from "./iso-router";
import { auditRouter } from "./audit-router";
import { siteRouter } from "./site-router";
import { generateAuditReport } from "./report-generator";
import { auditReports } from "../drizzle/schema";
import { storagePut as uploadToS3 } from "./storage";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { 
        ...cookieOptions, 
        maxAge: -1,
        httpOnly: true,
        secure: true,
        sameSite: "none"
      });
      return { success: true } as const;
    }),
  }),

  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserProfile(ctx.user.id);
    }),
    
    update: protectedProcedure
      .input(z.object({
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "manufacturer_us", "specification_developer", "contract_manufacturer", "initial_importer"]).optional(),
        companyName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  sites: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSites(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(2),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        isMainSite: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createSite({
          ...input,
          userId: ctx.user.id,
        });
      }),

    getDefaultOrCreate: protectedProcedure.query(async ({ ctx }) => {
      let site = await db.getFirstSiteByUserId(ctx.user.id);
      if (!site) {
        site = await db.createSite({
          userId: ctx.user.id,
          name: "Default Site",
          addressLine1: "N/A",
          city: "N/A",
          postalCode: "N/A",
          country: "N/A",
          isMainSite: true,
        });
      }
      return site;
    }),
  }),

  organizations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getOrganizations(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(2),
        legalEntityType: z.string().optional(),
        siret: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createOrganization({
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
      } catch (e) {
        return FALLBACK_REFERENTIALS;
      }
    }),
  }),

  processes: router({
    list: publicProcedure.query(async () => {
      try {
        const procs = await db.getAllProcesses();
        return procs.length > 0 ? procs : FALLBACK_PROCESSES;
      } catch (e) {
        return FALLBACK_PROCESSES;
      }
    }),
  }),

  audits: router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
        siteId: z.number().int().positive().optional(),
      }).optional())
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
      .input(z.object({
        name: z.string().min(2),
        siteId: z.number().int().positive(),
        organizationId: z.number().optional(),
        auditType: z.enum(["internal", "supplier", "mock"]),
        standard: z.string().optional(),
        auditStandard: z.string().optional(),
        economicRole: z.string().optional(),
        referentialIds: z.array(z.number()).default([1]),
        processesSelected: z.array(z.union([z.string(), z.number()])).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        plannedStartDate: z.string().optional(),
        plannedEndDate: z.string().optional(),
        actualStartDate: z.string().optional(),
        actualEndDate: z.string().optional(),
        openingMeetingAt: z.string().optional(),
        closingMeetingAt: z.string().optional(),
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
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const auditId = await db.createAudit({
          ...input,
          userId,
          status: "draft",
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : undefined,
          plannedEndDate: input.plannedEndDate ? new Date(input.plannedEndDate) : undefined,
          actualStartDate: input.actualStartDate ? new Date(input.actualStartDate) : undefined,
          actualEndDate: input.actualEndDate ? new Date(input.actualEndDate) : undefined,
          openingMeetingAt: input.openingMeetingAt ? new Date(input.openingMeetingAt) : undefined,
          closingMeetingAt: input.closingMeetingAt ? new Date(input.closingMeetingAt) : undefined,
          referentialIds: JSON.stringify(input.referentialIds),
          processesSelected: JSON.stringify(input.processesSelected || []),
        });
        return { auditId };
      }),

    update: protectedProcedure
      .input(z.object({
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
        auditors: z.array(z.object({ name: z.string(), role: z.string(), email: z.string().optional() })).optional(),
        observers: z.array(z.object({ name: z.string(), role: z.string().optional() })).optional(),
      }))
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
          const organizationExists = await db.getOrganizationByIdAndUserId(updateData.organizationId, ctx.user.id);
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
            processesSelected: updateData.processesSelected ? JSON.stringify(updateData.processesSelected) : undefined,
            referentialIds: updateData.referentialIds ? JSON.stringify(updateData.referentialIds) : undefined,
          });
          return { success: true };
        } catch (error: any) {
          console.error("[AUDIT UPDATE] Database update failed:", error.message, { userId: ctx.user.id, auditId: id, error: error });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update audit: " + error.message,
            cause: error,
          });
        }
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
          await db.updateAudit(input.id, { status: "in_progress", startDate: new Date() });
          return { success: true };
        } catch (error: any) {
          console.error("[AUDIT START] Database update failed:", error.message, { userId: ctx.user.id, auditId: input.id, error: error });
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
          console.error("[AUDIT DELETE] Database deletion failed:", error.message, { userId: ctx.user.id, auditId: input.id, error: error });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete audit: " + error.message,
            cause: error,
          });
        }
      }),
  }),

  dashboard: router({
    getStats: protectedProcedure
      .input(z.object({
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().int().positive().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardStats(ctx.user.id, input);
      }),

    getTimeseries: protectedProcedure
      .input(z.object({
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().int().positive().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardTimeseries(ctx.user.id, input);
      }),

    getRadar: protectedProcedure
      .input(z.object({
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().int().positive().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardRadar(ctx.user.id, input);
      }),

    getDrilldown: protectedProcedure
      .input(z.object({
        type: z.enum(["findings", "actions", "audits"]),
        filters: z.object({
          processId: z.number().optional(),
          findingType: z.string().optional(),
          criticality: z.string().optional(),
          status: z.string().optional(),
          siteId: z.number().int().positive().optional(),
        }).optional(),
        pagination: z.object({
          page: z.number(),
          pageSize: z.number(),
        }),
        sort: z.object({
          field: z.string(),
          order: z.enum(["asc", "desc"]),
        }),
      }))
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
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().int().positive().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardScoring(ctx.user.id, input);
      }),

    getSuggestions: protectedProcedure
      .input(z.object({
        market: z.enum(["eu", "us", "all"]).optional(),
        referentialIds: z.array(z.number()).optional(),
        economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
        period: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
        siteId: z.number().int().positive().optional(),
        auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
        criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardSuggestions(ctx.user.id, input);
      }),
  }),

  // Stripe payment router
  stripe: stripeRouter,

  // FDA Audit System
  fda: fdaRouter,

  // MDR Audit System (V5 - Canonical Processes & Dynamic Filtering)
  mdr: mdrRouter,

  // ISO Audit System (9001 + 13485)
  iso: isoRouter,

  // Audit Management (create, list, update audits)
  audit: auditRouter,
  site: siteRouter,

  // Audit Reports Generation
  reports: router({
    // Generate audit report
    generate: protectedProcedure
      .input(z.object({
        auditId: z.number(),
        reportType: z.enum(["complete", "executive", "comparative", "action_plan", "evidence_index"]),
        includeGraphs: z.boolean().optional().default(true),
        includeEvidence: z.boolean().optional().default(true),
        includeActionPlan: z.boolean().optional().default(true),
        comparedAuditIds: z.array(z.number()).optional(),
        language: z.enum(["fr", "en"]).optional().default("fr"),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const pdfBuffer = await generateAuditReport(input);

          // Upload to S3
          const fileName = `audit-report-${input.auditId}-${Date.now()}.pdf`;
          const fileKey = `reports/${ctx.user.id}/${fileName}`;
          const { url: fileUrl } = await uploadToS3(fileKey, pdfBuffer, "application/pdf");

          // Save report metadata to database
          const database = await getDb();
          const [report] = await database.insert(auditReports).values({
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
          }).returning();

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

    // Get report history
    list: protectedProcedure
      .input(z.object({
        auditId: z.number().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        let query = database
          .select()
          .from(auditReports)
          .where(eq(auditReports.userId, ctx.user.id))
          .orderBy(auditReports.generatedAt)
          .limit(input.limit);

        if (input.auditId) {
          query = query.where(eq(auditReports.auditId, input.auditId));
        }

        const reports = await query;
        return reports;
      }),

    // Get single report
    get: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [report] = await database
          .select()
          .from(auditReports)
          .where(
            and(
              eq(auditReports.id, input.reportId),
              eq(auditReports.userId, ctx.user.id)
            )
          );

        if (!report) {
          throw new Error("Report not found");
        }

        return report;
      }),

    // Delete report
    delete: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        await database
          .delete(auditReports)
          .where(
            and(
              eq(auditReports.id, input.reportId),
              eq(auditReports.userId, ctx.user.id)
            )
          );

        return { success: true };
      }),

    // Compare two audits
    compare: protectedProcedure
      .input(z.object({
        audit1Id: z.number(),
        audit2Id: z.number(),
      }))
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
