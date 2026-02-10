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
        economicRole: z.enum(["fabricant", "importateur", "distributeur"]).optional(),
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

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(2).optional(),
        auditStandard: z.string().default("MDR 2017/745"),
        auditType: z.string().default("mdr"),
        economicRole: z.string(),
        siteId: z.number().int().positive().optional(),
        processesSelected: z.array(z.union([z.string(), z.number()])).optional(),
        referentialIds: z.array(z.number()).default([1]),
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
        const resolvedSiteId = input.siteId;
        const siteExists = await db.getSiteByIdAndUserId(resolvedSiteId, ctx.user.id);
        if (!siteExists) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Site not found or does not belong to the user.",
          });
        }

        let resolvedOrganizationId = input.organizationId;
        if (resolvedOrganizationId) {
          const organizationExists = await db.getOrganizationByIdAndUserId(resolvedOrganizationId, ctx.user.id);
          if (!organizationExists) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid organizationId",
            });
          }
        }

        try {
          const auditId = await db.createAudit({
            userId: ctx.user.id,
            siteId: resolvedSiteId,
            organizationId: resolvedOrganizationId,
            name: input.name || `Audit MDR (${input.economicRole}) - ${new Date().toLocaleDateString()}`,
            auditType: input.auditType,
            auditStandard: input.auditStandard,
            status: "draft", // Always start as draft
            economicRole: input.economicRole,
            siteId: resolvedSiteId,
            organizationId: resolvedOrganizationId,
            processesSelected: input.processesSelected ? JSON.stringify(input.processesSelected) : "[]",
            referentialIds: JSON.stringify(input.referentialIds || []),
            auditObjective: input.auditObjective,
            auditScope: input.auditScope,
            auditCriteria: input.auditCriteria,
            auditProgramRef: input.auditProgramRef,
            auditMethod: input.auditMethod,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            openingMeetingAt: input.openingMeetingAt ? new Date(input.openingMeetingAt) : undefined,
            closingMeetingAt: input.closingMeetingAt ? new Date(input.closingMeetingAt) : undefined,
            auditLanguage: input.auditLanguage,
            auditeeContactName: input.auditeeContactName,
            auditeeContactEmail: input.auditeeContactEmail,
            auditeeContactPhone: input.auditeeContactPhone,
            leadAuditorName: input.leadAuditorName,
            leadAuditorEmail: input.leadAuditorEmail,
            auditors: input.auditors ? JSON.stringify(input.auditors) : undefined,
            observers: input.observers ? JSON.stringify(input.observers) : undefined,
            auditedEntityName: input.auditedEntityName,
            auditedEntityAddress: input.auditedEntityAddress,
            exclusions: input.exclusions,
            productFamilies: input.productFamilies,
            classDevices: input.classDevices,
            markets: input.markets,
            plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : undefined,
            plannedEndDate: input.plannedEndDate ? new Date(input.plannedEndDate) : undefined,
            actualStartDate: input.actualStartDate ? new Date(input.actualStartDate) : undefined,
            actualEndDate: input.actualEndDate ? new Date(input.actualEndDate) : undefined,
            auditLeader: input.auditLeader,
            auditTeamMembers: input.auditTeamMembers ? JSON.stringify(input.auditTeamMembers) : undefined,
            auditeeMainContact: input.auditeeMainContact,
            summary: input.summary,
            conclusion: input.conclusion,
            recommendation: input.recommendation,
            nbNC_major: input.nbNC_major,
            nbNC_minor: input.nbNC_minor,
            nbObs: input.nbObs,
            score: 0, // Default value
            conformityRate: 0, // Default value
          });
          console.log("CREATE AUDIT PAYLOAD:", { ...input, userId: ctx.user.id, resolvedSiteId, resolvedOrganizationId });
          console.log("auditId:", auditId);
          return { auditId };
        } catch (error: any) {
          console.error("[AUDIT CREATE] Database insertion failed:", error.message, { userId: ctx.user.id, auditName: input.name, referentialIds: input.referentialIds, error: error });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create audit: " + error.message,
            cause: error,
          });
        }
      }),
  }),

  questions: router({
    list: protectedProcedure
      .input(z.object({
        referentialId: z.number(),
        processId: z.number().optional(),
        economicRole: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Questions are global, but we might want to filter by user's economic role if applicable
        // For now, getQuestions does not take userId, so we just pass the input filters.
        // If questions become user-specific, this will need to be updated.
        return await db.getQuestions(input);
      }),
  }),

  auditResponses: router({
    save: protectedProcedure
      .input(z.object({
        auditId: z.number(),
        questionId: z.number(),
        answer: z.enum(["conforme", "nok", "na", "partial"]),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Ensure the audit belongs to the user before saving response
        const audit = await db.getAuditById(input.auditId, ctx.user.id);
        if (!audit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Audit not found or does not belong to the user",
          });
        }
        return await db.saveAuditResponse({
          ...input,
          userId: ctx.user.id,
        });
      }),
    
    getByAudit: protectedProcedure
      .input(z.object({ auditId: z.number() }))
      .query(async ({ ctx, input }) => {
        const audit = await db.getAuditById(input.auditId, ctx.user.id);
        if (!audit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Audit not found or does not belong to the user",
          });
        }
        return await db.getAuditResponses(input.auditId);
      }),
  }),

  classification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const database = await getDb();
      return await database
        .select()
        .from(deviceClassifications)
        .where(eq(deviceClassifications.userId, ctx.user.id));
    }),

    save: protectedProcedure
      .input(z.object({
        deviceName: z.string(),
        deviceDescription: z.string().optional(),
        resultingClass: z.string(),
        appliedRules: z.array(z.string()),
        answers: z.record(z.any()),
        justification: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        const [result] = await database.insert(deviceClassifications).values({
          userId: ctx.user.id,
          deviceName: input.deviceName,
          deviceDescription: input.deviceDescription,
          resultingClass: input.resultingClass,
          appliedRules: JSON.stringify(input.appliedRules),
          answers: JSON.stringify(input.answers),
          justification: input.justification,
        }).returning();
        return result;
      }),

    generatePDF: protectedProcedure
      .input(z.object({
        device_name: z.string().optional(),
        intended_use: z.string().optional(),
        is_invasive: z.boolean().optional(),
        is_active: z.boolean().optional(),
        duration: z.enum(["transient", "short_term", "long_term"]).optional(),
        body_contact: z.enum(["skin", "orifice", "surgical_invasive", "central_circulatory", "central_nervous"]).optional(),
        reusable_surgical: z.boolean().optional(),
        implantable: z.boolean().optional(),
        administers_energy: z.boolean().optional(),
        administers_substance: z.boolean().optional(),
        monitors_vital: z.boolean().optional(),
        emits_radiation: z.boolean().optional(),
        software_diagnostic: z.boolean().optional(),
        software_therapeutic: z.boolean().optional(),
        software_monitoring: z.boolean().optional(),
        incorporates_drug: z.boolean().optional(),
        incorporates_blood_derivative: z.boolean().optional(),
        contains_absorbable_substance: z.boolean().optional(),
        contains_nanomaterials: z.boolean().optional(),
        high_internal_exposure: z.boolean().optional(),
        contains_animal_tissue: z.boolean().optional(),
        biological_effect: z.boolean().optional(),
        software_purpose: z.array(z.string()).optional(),
      }))
      .query(async ({ input }) => {
        const { classifyDevice } = await import("./classification-engine");
        const { generateClassificationPDF } = await import("./classification-exports");
        
        const result = classifyDevice(input);
        const markdown = generateClassificationPDF(input, result);
        
        return { markdown, filename: `classification_${input.device_name || "dispositif"}_${Date.now()}.md` };
      }),
  }),
  
  // Documents obligatoires router
  documents: router({
    getAll: protectedProcedure
      .input(z.object({
        referentialId: z.number().optional(),
        processId: z.number().optional(),
        role: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getMandatoryDocuments(input || {});
      }),
    
    getById: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDocumentById(input.documentId);
      }),
    
    getUserStatus: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getUserDocumentStatus(ctx.user.id, input.documentId);
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        status: z.enum(["manquant", "a_mettre_a_jour", "conforme"]),
        notes: z.string().optional(),
        fileUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateDocumentStatus({
          userId: ctx.user.id,
          documentId: input.documentId,
          status: input.status,
          notes: input.notes,
          fileUrl: input.fileUrl,
        });
        return { success: true };
      }),
    
    getStats: protectedProcedure
      .input(z.object({ role: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getDocumentStats(ctx.user.id, input?.role);
      }),
    
    explainDocument: protectedProcedure
      .input(z.object({
        documentId: z.number(),
      }))
      .query(async ({ input }) => {
        const { explainDocument } = await import("./document-ai");
        const document = await db.getDocumentById(input.documentId);
        
        if (!document) {
          throw new Error("Document not found");
        }
        
        const referentials = await db.getAllReferentials();
        const processes = await db.getAllProcesses();
        const referential = referentials.find(r => r.id === document.referentialId);
        const process = document.processId ? processes.find(p => p.id === document.processId) : null;
        
        return await explainDocument(
          document.documentName,
          document.objective || "",
          referential?.name || "",
          process?.name || "Tous processus",
          document.role || "tous"
        );
      }),
    
    checkCoherence: protectedProcedure
      .input(z.object({
        documentId: z.number(),
      }))
      .query(async ({ input }) => {
        const document = await db.getDocumentById(input.documentId);
        
        if (!document) {
          throw new Error("Document not found");
        }
        
        // Récupérer les documents connexes (même processus)
        const relatedDocs = await db.getMandatoryDocuments({
          processId: document.processId || undefined,
          referentialId: document.referentialId,
        });
        
        const relatedNames = relatedDocs
          .filter(d => d.id !== document.id)
          .slice(0, 5)
          .map(d => d.documentName);
        
        const { checkDocumentCoherence } = await import("./document-ai");
        return await checkDocumentCoherence(document.documentName, relatedNames);
      }),
    
    // Get documents related to a question
    getRelatedDocuments: publicProcedure
      .input(z.object({
        questionId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        const question = await db.getQuestionById(input.questionId);
        if (!question) {
          return [];
        }
        
        const processes = await db.getAllProcesses();
        const referentials = await db.getAllReferentials();
        const process = question.processId ? processes.find(p => p.id === question.processId) : null;
        const referential = referentials.find(r => r.id === question.referentialId);
        
        // Import dynamique pour éviter les erreurs de dépendances circulaires
        const { getRequiredDocumentsForQuestion } = await import("../shared/question-document-mapping");
        
        const documentNames = getRequiredDocumentsForQuestion(
          question.id,
          process?.name,
          referential?.name
        );
        
        // Récupérer les documents correspondants
        const allDocs = await db.getMandatoryDocuments({
          processId: question.processId || undefined,
          referentialId: question.referentialId,
        });
        
        // Filtrer par nom de document
        return allDocs.filter(doc => 
          documentNames.some(name => 
            doc.documentName.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(doc.documentName.toLowerCase())
          )
        );
      }),
  }),

  // FDA Classification router
  fdaClassification: router({
    save: protectedProcedure
      .input(z.object({
        deviceName: z.string(),
        deviceDescription: z.string(),
        intendedUse: z.string(),
        deviceClass: z.enum(["I", "II", "III"]),
        pathway: z.enum(["Exempt", "510(k)", "De Novo", "PMA"]),
        predicateDevice: z.string().nullable(),
        predicate510k: z.string().nullable(),
        justification: z.string(),
        answers: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.saveFdaClassification({
          userId: ctx.user.id,
          deviceName: input.deviceName,
          deviceDescription: input.deviceDescription,
          intendedUse: input.intendedUse,
          deviceClass: input.deviceClass,
          pathway: input.pathway,
          predicateDevice: input.predicateDevice,
          predicate510k: input.predicate510k,
          justification: input.justification,
          answers: input.answers,
        });
        
        return { success: true };
      }),
    
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFdaClassifications(ctx.user.id);
    }),
  }),

  // FDA Regulatory Watch router
  fdaRegulatoryWatch: router({
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        impactLevel: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getFdaRegulatoryUpdates(input || {});
      }),
  }),

  // Demo router for FREE users
  demo: router({
    checkUsage: protectedProcedure.query(async ({ ctx }) => {
      try {
        const usage = await db.getDemoUsage(ctx.user.id);
        return usage || { userId: ctx.user.id, hasUsedDemo: false, usedAt: null };
      } catch (e) {
        console.error("Error in demo.checkUsage:", e);
        return { userId: ctx.user.id, hasUsedDemo: false, usedAt: null };
      }
    }),
    
    getQuestions: protectedProcedure.query(async ({ ctx }) => {
      // Get 5 ISO 13485 questions for demo
      const iso13485 = await db.getReferentialByCode("ISO_13485");
      if (!iso13485) return [];
      
      const allQuestions = await db.getQuestions({
        referentialId: iso13485.id,
        economicRole: "fabricant",
      });
      
      // Return only first 5 questions
      return allQuestions.slice(0, 5);
    }),
    
    markAsUsed: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markDemoAsUsed(ctx.user.id);
      return { success: true };
    }),
  }),

  // Contact form router
  contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        email: z.string().email("Email invalide"),
        company: z.string().optional(),
        subject: z.enum(["demo", "support", "partnership", "pricing", "other"]),
        message: z.string().min(10, "Le message doit contenir au moins 10 caractères"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Import notification helper
        const { notifyOwner } = await import("./_core/notification");
        
        // Save to database
        await db.createContactMessage({
          name: input.name,
          email: input.email,
          company: input.company,
          subject: input.subject,
          message: input.message,
          userId: ctx.user?.id,
        });
        
        // Notify owner
        const subjectLabels: Record<string, string> = {
          demo: "Demande de démo",
          support: "Support technique",
          partnership: "Partenariat",
          pricing: "Question tarifs",
          other: "Autre",
        };
        
        await notifyOwner({
          title: `Nouveau message de contact: ${subjectLabels[input.subject]}`,
          content: `**De:** ${input.name} (${input.email})\n**Entreprise:** ${input.company || "Non spécifiée"}\n**Sujet:** ${subjectLabels[input.subject]}\n\n**Message:**\n${input.message}`,
        });
        
        return { success: true };
      }),
      
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // Only admin can list messages
        if (ctx.user.role !== "admin") {
          throw new Error("Accès non autorisé");
        }
        return await db.getContactMessages(input);
      }),
      
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "read", "replied", "archived"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admin can update status
        if (ctx.user.role !== "admin") {
          throw new Error("Accès non autorisé");
        }
        await db.updateContactMessageStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // Analytics dashboard router
  analytics: router({
    getKPIs: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        siteIds: z.array(z.number()).optional(),
        processIds: z.array(z.number()).optional(),
        referentialIds: z.array(z.number()).optional(),
        auditType: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getAnalyticsKPIs(ctx.user.id, input);
      }),

    getSitePerformance: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getSitePerformance(ctx.user.id, input);
      }),

    getProcessPerformance: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getProcessPerformance(ctx.user.id, input);
      }),

    getFindings: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.string().optional(),
        findingType: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getFilteredFindings(ctx.user.id, input);
      }),

    getTrends: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getTrendData(ctx.user.id, input);
      }),

    getHeatmap: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getHeatmapData(ctx.user.id, input);
      }),

    getPareto: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await analyticsDb.getParetoData(ctx.user.id, input);
      }),
  }),

  // Dashboard router (main dashboard with real data)
  dashboard: router({
    // Legacy endpoints (kept for backward compatibility)
    getKPIs: protectedProcedure.query(async ({ ctx }) => {
      return await dashboardDb.getDashboardKPIs(ctx.user.id);
    }),

    getProcessProgress: protectedProcedure.query(async ({ ctx }) => {
      return await dashboardDb.getProcessProgress(ctx.user.id);
    }),

    getScoreTrend: protectedProcedure.query(async ({ ctx }) => {
      return await dashboardDb.getScoreTrend(ctx.user.id);
    }),

    getRecentFindings: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(10),
      }))
      .query(async ({ ctx, input }) => {
        return await dashboardDb.getRecentFindings(ctx.user.id, input.limit);
      }),

    getProcessDetails: protectedProcedure
      .input(z.object({
        processId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await dashboardDb.getProcessDetails(ctx.user.id, input.processId);
      }),

    // V2 endpoints (new dashboard based on audits)
    getSummary: protectedProcedure
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
        return await dashboardV2.getDashboardSummary(ctx.user.id, input);
      }),

    getFunnel: protectedProcedure
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
        return await dashboardV2.getDashboardFunnel(ctx.user.id, input);
      }),

    getTimeseries: protectedProcedure
      .input(z.object({
        filters: z.object({
          market: z.enum(["eu", "us", "all"]).optional(),
          referentialIds: z.array(z.number()).optional(),
          economicRole: z.enum(["fabricant", "importateur", "distributeur", "all"]).optional(),
          period: z.object({
            start: z.date(),
            end: z.date(),
          }).optional(),
         siteId: z.number().int().positive().optional(),.int().positive(),
          auditStatus: z.enum(["draft", "in_progress", "completed", "closed", "all"]).optional(),
          criticality: z.enum(["critical", "high", "medium", "low", "all"]).optional(),
        }).optional(),
        granularity: z.enum(["month", "week"]).optional().default("month"),
      }))
      .query(async ({ ctx, input }) => {
        return await dashboardV2.getDashboardTimeseries(ctx.user.id, input.filters, input.granularity);
      }),

    getHeatmap: protectedProcedure
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
        return await dashboardV2.getDashboardHeatmap(ctx.user.id, input);
      }),

    getRadar: protectedProcedure
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
