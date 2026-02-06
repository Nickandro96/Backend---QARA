/**
 * FDA Audit System Router
 * Handles FDA role qualification and question filtering
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
// import { FALLBACK_FDA_QUESTIONS } from "./fallback-data";

export const fdaRouter = router({
  /**
   * Save FDA Role Qualification
   * Computes applicable FDA roles based on 9 boolean questions
   */
  saveQualification: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
      brandOnLabel: z.boolean(),
      designsOrSpecifiesDevice: z.boolean(),
      manufacturesOrReworks: z.boolean(),
      manufacturesForThirdParty: z.boolean(),
      firstImportIntoUS: z.boolean(),
      distributesWithoutModification: z.boolean(),
      relabelingOrRepackaging: z.boolean(),
      servicing: z.boolean(),
      softwareAsMedicalDevice: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      
      // Compute roles based on answers
      const computedRoles: string[] = [];
      
      // Logic based on FDA framework definitions
      if (input.brandOnLabel || input.designsOrSpecifiesDevice) {
        computedRoles.push('FDA_LM'); // Labeler / Specification Developer
      }
      
      if (input.manufacturesOrReworks) {
        computedRoles.push('FDA_MFG'); // Manufacturer
      }
      
      if (input.manufacturesForThirdParty) {
        computedRoles.push('FDA_CMO'); // Contract Manufacturer
      }
      
      if (input.firstImportIntoUS) {
        computedRoles.push('FDA_IMP'); // Initial Importer
      }
      
      if (input.distributesWithoutModification) {
        computedRoles.push('FDA_DIST'); // Distributor
      }

      if (input.relabelingOrRepackaging) {
        computedRoles.push('FDA_REL'); // Relabeler / Repackager
      }

      if (input.servicing) {
        computedRoles.push('FDA_SRV'); // Remanufacturer / Servicer
      }

      if (input.softwareAsMedicalDevice) {
        computedRoles.push('FDA_SAMD'); // SaMD Developer
      }
      
      // Check if qualification already exists
      const [existing] = await db.select()
        .from(schema.fdaRoleQualifications)
        .where(
          input.siteId
            ? and(
                eq(schema.fdaRoleQualifications.userId, ctx.user.id),
                eq(schema.fdaRoleQualifications.siteId, input.siteId)
              )
            : eq(schema.fdaRoleQualifications.userId, ctx.user.id)
        )
        .limit(1);
      
      if (existing) {
        // Update existing qualification
        await db.update(schema.fdaRoleQualifications)
          .set({
            brandOnLabel: input.brandOnLabel,
            designsOrSpecifiesDevice: input.designsOrSpecifiesDevice,
            manufacturesOrReworks: input.manufacturesOrReworks,
            manufacturesForThirdParty: input.manufacturesForThirdParty,
            firstImportIntoUS: input.firstImportIntoUS,
            distributesWithoutModification: input.distributesWithoutModification,
            relabelingOrRepackaging: input.relabelingOrRepackaging,
            servicing: input.servicing,
            softwareAsMedicalDevice: input.softwareAsMedicalDevice,
            computedRoles: JSON.stringify(computedRoles),
            updatedAt: new Date(),
          })
          .where(eq(schema.fdaRoleQualifications.id, existing.id));
      } else {
        // Insert new qualification
        await db.insert(schema.fdaRoleQualifications).values({
          userId: ctx.user.id,
          siteId: input.siteId || null,
          brandOnLabel: input.brandOnLabel,
          designsOrSpecifiesDevice: input.designsOrSpecifiesDevice,
          manufacturesOrReworks: input.manufacturesOrReworks,
          manufacturesForThirdParty: input.manufacturesForThirdParty,
          firstImportIntoUS: input.firstImportIntoUS,
          distributesWithoutModification: input.distributesWithoutModification,
          relabelingOrRepackaging: input.relabelingOrRepackaging,
          servicing: input.servicing,
          softwareAsMedicalDevice: input.softwareAsMedicalDevice,
          computedRoles: JSON.stringify(computedRoles),
        });
      }
      
      return {
        success: true,
        computedRoles,
        message: computedRoles.length > 0
          ? `Your FDA role(s): ${computedRoles.join(', ')}`
          : 'No FDA roles identified. Please review your answers.',
      };
    }),

  /**
   * Get user's FDA qualification profile
   */
  getQualification: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      let qualification = null;
      try {
        const results = await db.select()
          .from(schema.fdaRoleQualifications)
          .where(
            input.siteId
              ? and(
                  eq(schema.fdaRoleQualifications.userId, ctx.user.id),
                  eq(schema.fdaRoleQualifications.siteId, input.siteId)
                )
              : eq(schema.fdaRoleQualifications.userId, ctx.user.id)
          )
          .limit(1);
        qualification = results[0];
      } catch (e) {
        console.error("Error fetching FDA qualification:", e);
      }
      
      if (!qualification) {
        return {
          brandOnLabel: false,
          designsOrSpecifiesDevice: false,
          manufacturesOrReworks: false,
          manufacturesForThirdParty: false,
          firstImportIntoUS: false,
          distributesWithoutModification: false,
          relabelingOrRepackaging: false,
          servicing: false,
          softwareAsMedicalDevice: false,
          computedRoles: [],
        };
      }
      
      return {
        ...qualification,
        computedRoles: JSON.parse(qualification.computedRoles as string || '[]') as string[],
      };
    }),

  /**
   * Get FDA questions for audit (filtered by user's roles)
   */
  getQuestions: protectedProcedure
    .input(z.object({
      frameworkCode: z.string(),
      siteId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      // Get user's FDA roles
      const [qualification] = await db.select()
        .from(schema.fdaRoleQualifications)
        .where(
          input.siteId
            ? and(
                eq(schema.fdaRoleQualifications.userId, ctx.user.id),
                eq(schema.fdaRoleQualifications.siteId, input.siteId)
              )
            : eq(schema.fdaRoleQualifications.userId, ctx.user.id)
        )
        .limit(1);
      
      if (!qualification) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Please complete FDA qualification first',
        });
      }
      
      const userRoles = JSON.parse(qualification.computedRoles as string || '[]') as string[];
      
      if (userRoles.length === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No FDA roles identified. Please review your qualification.',
        });
      }
      
      // Get ALL questions for this framework
      let allQuestions = [];
      try {
        allQuestions = await db.select()
          .from(schema.fdaQuestions)
          .where(eq(schema.fdaQuestions.frameworkCode, input.frameworkCode))
          .orderBy(schema.fdaQuestions.process, schema.fdaQuestions.subprocess);
      } catch (e) {
        console.error("Error fetching FDA questions:", e);
        return { questions: [], userRoles: userRoles, totalQuestions: 0, applicableQuestions: 0 };
      }
      
      // Get applicability mappings
      const questionIds = allQuestions.map(q => q.id);
      const applicability = await db.select()
        .from(schema.fdaQuestionApplicability)
        .where(inArray(schema.fdaQuestionApplicability.questionId, questionIds));
      
      // Build applicability map
      const applicabilityMap = new Map<number, string[]>();
      for (const app of applicability) {
        if (!applicabilityMap.has(app.questionId)) {
          applicabilityMap.set(app.questionId, []);
        }
        applicabilityMap.get(app.questionId)!.push(app.roleCode);
      }
      
      // Filter questions: ALL + questions applicable to user's roles
      let filteredQuestions = allQuestions.filter(q => {
        if (q.applicabilityType === 'ALL') {
          return true;
        }
        
        const applicableRoles = applicabilityMap.get(q.id) || [];
        return userRoles.some(role => applicableRoles.includes(role));
      });

      // Fallback if no questions in DB
      if (filteredQuestions.length === 0) {
        // filteredQuestions = FALLBACK_FDA_QUESTIONS.filter(q => q.frameworkCode === input.frameworkCode) as any; // Fallback removed for now;
      }
      
      return {
        questions: filteredQuestions,
        userRoles,
        totalQuestions: filteredQuestions.length,
        applicableQuestions: filteredQuestions.length,
      };
    }),

  /**
   * Get list of FDA frameworks
   */
  getFrameworks: protectedProcedure
    .query(async () => {
      return [
        { code: 'FDA_820', name: '21 CFR Part 820 (QSR)', description: 'Quality System Regulation' },
        { code: 'FDA_807', name: '21 CFR Part 807', description: 'Establishment Registration and Device Listing' },
        { code: 'FDA_510K', name: '510(k)', description: 'Premarket Notification' },
        { code: 'FDA_DENOVO', name: 'De Novo', description: 'De Novo Classification Request' },
        { code: 'FDA_PMA', name: 'PMA', description: 'Premarket Approval' },
        { code: 'FDA_POSTMARKET', name: 'Postmarket', description: 'Postmarket Surveillance' },
        { code: 'FDA_LABELING', name: 'Labeling', description: 'Device Labeling Requirements' },
        { code: 'FDA_UDI', name: 'UDI', description: 'Unique Device Identification' },
      ];
    }),

  /**
   * Get FDA roles list
   */
  getRoles: protectedProcedure
    .query(async () => {
      const db = await getDb();
      return await db.select().from(schema.fdaRoles);
    }),

  /**
   * Save FDA Audit Response
   * Saves or updates a user's response to an FDA audit question
   */
  saveResponse: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionId: z.number(),
      responseValue: z.enum(['compliant', 'non_compliant', 'not_applicable', 'in_progress']),
      responseComment: z.string().optional(),
      evidenceFiles: z.array(z.string()).optional(), // Array of file URLs
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      
      // Check if response already exists
      const [existing] = await db.select()
        .from(schema.fdaAuditResponses)
        .where(
          and(
            eq(schema.fdaAuditResponses.auditId, input.auditId),
            eq(schema.fdaAuditResponses.questionId, input.questionId)
          )
        )
        .limit(1);
      
      const evidenceFilesJson = input.evidenceFiles ? JSON.stringify(input.evidenceFiles) : null;
      
      if (existing) {
        // Update existing response
        await db.update(schema.fdaAuditResponses)
          .set({
            responseValue: input.responseValue,
            responseComment: input.responseComment || null,
            evidenceFiles: evidenceFilesJson,
            answeredBy: ctx.user.id,
            answeredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.fdaAuditResponses.id, existing.id));
      } else {
        // Insert new response
        await db.insert(schema.fdaAuditResponses).values({
          auditId: input.auditId,
          questionId: input.questionId,
          responseValue: input.responseValue,
          responseComment: input.responseComment || null,
          evidenceFiles: evidenceFilesJson,
          answeredBy: ctx.user.id,
          answeredAt: new Date(),
        });
      }
      
      return { success: true };
    }),

  /**
   * Get FDA Audit Response
   * Retrieves a user's response for a specific question
   */
  getResponse: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      const [response] = await db.select()
        .from(schema.fdaAuditResponses)
        .where(
          and(
            eq(schema.fdaAuditResponses.auditId, input.auditId),
            eq(schema.fdaAuditResponses.questionId, input.questionId)
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
   * Get all FDA Audit Responses for an audit
   */
  getResponses: protectedProcedure
    .input(z.object({
      auditId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      const responses = await db.select()
        .from(schema.fdaAuditResponses)
        .where(eq(schema.fdaAuditResponses.auditId, input.auditId));
      
      return responses.map(r => ({
        ...r,
        evidenceFiles: r.evidenceFiles ? JSON.parse(r.evidenceFiles as string) : [],
      }));
    }),
});
