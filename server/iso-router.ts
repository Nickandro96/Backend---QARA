/**
 * ISO Audit System Router
 * Handles ISO 9001/13485 qualification and question management
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
// import { FALLBACK_ISO_QUESTIONS } from "./fallback-data";

export const isoRouter = router({
  /**
   * Save ISO Role Qualification
   * Stores user's ISO certification profile
   */
  saveQualification: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
      targetStandards: z.array(z.string()), // Use string to be more flexible
      organizationType: z.string(),
      economicRole: z.string().nullable().optional(),
      processes: z.array(z.string()).optional(), // ["conception", "fabrication", etc.]
      certificationScope: z.string().optional(),
      excludedClauses: z.array(z.string()).optional(), // ["7.3"] for no design
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }
      
      if (input.targetStandards.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Veuillez sélectionner au moins une norme ISO",
        });
      }
      
      // Check if qualification already exists
      const [existing] = await db.select()
        .from(schema.isoRoleQualifications)
        .where(
          input.siteId
            ? and(
                eq(schema.isoRoleQualifications.userId, ctx.user.id),
                eq(schema.isoRoleQualifications.siteId, input.siteId)
              )
            : eq(schema.isoRoleQualifications.userId, ctx.user.id)
        )
        .limit(1);
      
      const qualificationData = {
        targetStandards: JSON.stringify(input.targetStandards),
        organizationType: (input.organizationType as any) || "manufacturer",
        economicRole: (input.economicRole as any) || null,
        processes: input.processes ? JSON.stringify(input.processes) : null,
        certificationScope: input.certificationScope || null,
        excludedClauses: input.excludedClauses ? JSON.stringify(input.excludedClauses) : null,
        updatedAt: new Date(),
      };
      
      if (existing) {
        // Update existing qualification
        await db.update(schema.isoRoleQualifications)
          .set(qualificationData)
          .where(eq(schema.isoRoleQualifications.id, existing.id));
      } else {
        // Insert new qualification
        await db.insert(schema.isoRoleQualifications).values({
          userId: ctx.user.id,
          siteId: input.siteId || null,
          ...qualificationData,
        });
      }
      
      return {
        success: true,
        targetStandards: input.targetStandards,
        message: `Profil ISO enregistré : ${input.targetStandards.join(", ")}`,
      };
    }),

  /**
   * Get user's ISO qualification profile
   */
  getQualification: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }
      
      // Get user's ISO qualification
      let qualification = null;
      try {
        const results = await db.select()
          .from(schema.isoRoleQualifications)
          .where(
            input.siteId
              ? and(
                  eq(schema.isoRoleQualifications.userId, ctx.user.id),
                  eq(schema.isoRoleQualifications.siteId, input.siteId)
                )
              : eq(schema.isoRoleQualifications.userId, ctx.user.id)
          )
          .limit(1);
        qualification = results[0];
      } catch (e) {
        console.error("Error fetching ISO qualification:", e);
      }
      
      if (!qualification) {
        return {
          targetStandards: [],
          organizationType: "manufacturer",
          economicRole: null,
          processes: [],
          certificationScope: null,
          excludedClauses: [],
        };
      }
      
      return {
        ...qualification,
        targetStandards: JSON.parse(qualification.targetStandards as string) as string[],
        processes: qualification.processes ? (JSON.parse(qualification.processes as string) as string[]).filter((p: string) => p && p.trim() !== '') : [],
        excludedClauses: qualification.excludedClauses ? JSON.parse(qualification.excludedClauses as string) : [],
      };
    }),

  /**
   * Get ISO standards list (filtered by user's qualification)
   */
  getStandards: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }
      
      // Get user's qualification
      const [qualification] = await db.select()
        .from(schema.isoRoleQualifications)
        .where(
          input?.siteId
            ? eq(schema.isoRoleQualifications.siteId, input.siteId)
            : eq(schema.isoRoleQualifications.userId, ctx.user.id)
        )
        .limit(1);
      
      const allStandards = [
        { code: "9001", name: "ISO 9001:2015", description: "Systèmes de management de la qualité" },
        { code: "13485", name: "ISO 13485:2016", description: "Dispositifs médicaux - Systèmes de management de la qualité" },
      ];

      if (!qualification) {
        return allStandards;
      }
      
      const targetStandards = JSON.parse(qualification.targetStandards as string) as string[];
      
      // Filter standards based on user's qualification
      const filtered = allStandards.filter(std => targetStandards.includes(std.code));
      return filtered.length > 0 ? filtered : allStandards;
    }),

  /**
   * Get ISO questions for audit (filtered by selected standard)
   */
  getQuestions: protectedProcedure
    .input(z.object({
      standard: z.enum(["9001", "13485"]),
      siteId: z.number().optional(),
      economicRole: z.enum(["fabricant", "importateur", "distributeur"]).optional(),
      processes: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }
      
      // Get user's ISO qualification first
      const [qualification] = await db.select()
        .from(schema.isoRoleQualifications)
        .where(
          input.siteId
            ? and(
                eq(schema.isoRoleQualifications.userId, ctx.user.id),
                eq(schema.isoRoleQualifications.siteId, input.siteId)
              )
            : eq(schema.isoRoleQualifications.userId, ctx.user.id)
        )
        .limit(1);
      
      if (!qualification) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Veuillez d'abord compléter votre qualification ISO sur /iso/qualification",
        });
      }
      
      const targetStandards = JSON.parse(qualification.targetStandards as string) as string[];
      
      // Check if user has selected this standard
      if (!targetStandards.includes(input.standard)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Vous n'avez pas sélectionné la norme ISO ${input.standard} dans votre profil`,
        });
      }
      
      // Get all questions for selected standard from ISO questions table
      let questions = [];
      try {
        questions = await db.select()
          .from(schema.isoQuestions)
          .where(eq(schema.isoQuestions.standard, input.standard))
          .orderBy(schema.isoQuestions.displayOrder);
      } catch (e) {
        console.error("Error fetching ISO questions:", e);
        return { questions: [], standard: input.standard, totalQuestions: 0, excludedClauses: [] };
      }
      
      // Filter out excluded clauses if any
      const excludedClauses = qualification.excludedClauses 
        ? JSON.parse(qualification.excludedClauses as string) as string[]
        : [];
      
      let filteredQuestions = excludedClauses.length > 0
        ? questions.filter(q => !excludedClauses.some(excluded => q.clause?.startsWith(excluded)))
        : questions;

      // Fallback if no questions in DB
      if (filteredQuestions.length === 0) {
        // filteredQuestions = FALLBACK_ISO_QUESTIONS.filter(q => q.standard === input.standard) as any; // Fallback removed for now;
      }
      
      // ISO questions use 'applicability' and 'processCategory' instead of 'economicRole' and 'businessProcess'
      // Economic Role Mapping for ISO Applicability
      if (input.economicRole) {
        filteredQuestions = filteredQuestions.filter(q => {
          if (q.applicability === "all") return true;
          
          // Fabricant -> manufacturers_only
          if (input.economicRole === "fabricant" && q.applicability === "manufacturers_only") return true;
          
          // Importateur/Distributeur/Mandataire -> service_providers
          const isServiceProvider = ["importateur", "distributeur", "mandataire"].includes(input.economicRole!);
          if (isServiceProvider && q.applicability === "service_providers") return true;
          
          return false;
        });
      }
      
      // Process Mapping
      if (input.processes && input.processes.length > 0) {
        filteredQuestions = filteredQuestions.filter(q => {
          if (!q.processCategory) return true;
          
          // Mapping frontend processes to backend categories
          const processMap: Record<string, string[]> = {
            'conception': ['design', 'r&d', 'qms'],
            'fabrication': ['production', 'manufacturing', 'qms'],
            'distribution': ['distribution', 'logistics', 'qms'],
            'stockage': ['storage', 'logistics', 'qms'],
            'installation': ['installation', 'service', 'qms'],
            'maintenance': ['maintenance', 'service', 'qms'],
            'service_apres_vente': ['service', 'post-market', 'qms']
          };

          const normalizedCategory = q.processCategory.toLowerCase();
          return input.processes!.some(p => {
            const mappedCategories = processMap[p] || [p];
            return mappedCategories.includes(normalizedCategory);
          });
        });
      }
      
      return {
        questions: filteredQuestions,
        standard: input.standard,
        totalQuestions: filteredQuestions.length,
        excludedClauses,
      };
    }),

  /**
   * Save response to ISO audit question
   */
  saveResponse: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionId: z.number(),
      responseValue: z.enum(["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]),
      responseComment: z.string().optional(),
      evidenceFiles: z.array(z.string()).optional(), // Array of file URLs
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }
      
      // Check if response already exists (upsert pattern)
      const [existing] = await db.select()
        .from(schema.isoAuditResponses)
        .where(
          and(
            eq(schema.isoAuditResponses.auditId, input.auditId),
            eq(schema.isoAuditResponses.questionId, input.questionId)
          )
        )
        .limit(1);
      
      const responseData = {
        responseValue: input.responseValue,
        responseComment: input.responseComment || null,
        evidenceFiles: input.evidenceFiles ? JSON.stringify(input.evidenceFiles) : null,
        answeredBy: ctx.user.id,
        answeredAt: new Date(),
        // updatedAt is handled automatically by Drizzle (defaultNow().onUpdateNow())
      };
      
      if (existing) {
        // Update existing response
        await db.update(schema.isoAuditResponses)
          .set(responseData)
          .where(eq(schema.isoAuditResponses.id, existing.id));
      } else {
        // Insert new response
        await db.insert(schema.isoAuditResponses).values({
          auditId: input.auditId,
          questionId: input.questionId,
          ...responseData,
        });
      }
      
      return {
        success: true,
        message: "Réponse sauvegardée",
      };
    }),

  /**
   * Get single response for a question
   */
  getResponse: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      const [response] = await db.select()
        .from(schema.isoAuditResponses)
        .where(
          and(
            eq(schema.isoAuditResponses.auditId, input.auditId),
            eq(schema.isoAuditResponses.questionId, input.questionId)
          )
        )
        .limit(1);
      
      if (!response) {
        return null;
      }
      
      return {
        ...response,
        evidenceFiles: response.evidenceFiles ? JSON.parse(response.evidenceFiles as string) : [],
      };
    }),

  /**
   * Get all responses for an audit
   */
  getResponses: protectedProcedure
    .input(z.object({
      auditId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      const responses = await db.select()
        .from(schema.isoAuditResponses)
        .where(eq(schema.isoAuditResponses.auditId, input.auditId));
      
      return responses.map(r => ({
        ...r,
        evidenceFiles: r.evidenceFiles ? JSON.parse(r.evidenceFiles as string) : [],
      }));
    }),
});
