/**
 * MDR Audit System Router
 * Handles MDR role qualification and question management
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { FALLBACK_MDR_QUESTIONS } from "./fallback-data";

export const mdrRouter = router({
  /**
   * Save MDR Role Qualification
   * Stores user's economic role and MDR profile
   */
  saveQualification: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
      economicRole: z.enum(["fabricant", "importateur", "distributeur", "mandataire"]),
      hasAuthorizedRepresentative: z.boolean().default(false),
      targetMarkets: z.array(z.string()).optional(), // ["FR", "DE", "IT"]
      deviceClasses: z.array(z.string()).optional(), // ["I", "IIa", "IIb", "III"]
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      
      // Check if qualification already exists
      const [existing] = await db.select()
        .from(schema.mdrRoleQualifications)
        .where(
          input.siteId
            ? and(
                eq(schema.mdrRoleQualifications.userId, ctx.user.id),
                eq(schema.mdrRoleQualifications.siteId, input.siteId)
              )
            : eq(schema.mdrRoleQualifications.userId, ctx.user.id)
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
        // Update existing qualification
        await db.update(schema.mdrRoleQualifications)
          .set(qualificationData)
          .where(eq(schema.mdrRoleQualifications.id, existing.id));
      } else {
        // Insert new qualification
        await db.insert(schema.mdrRoleQualifications).values({
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
    .input(z.object({
      siteId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      let qualification = null;
      try {
        const results = await db.select()
          .from(schema.mdrRoleQualifications)
          .where(
            input.siteId
              ? and(
                  eq(schema.mdrRoleQualifications.userId, ctx.user.id),
                  eq(schema.mdrRoleQualifications.siteId, input.siteId)
                )
              : eq(schema.mdrRoleQualifications.userId, ctx.user.id)
          )
          .limit(1);
        qualification = results[0];
      } catch (e) {
        console.error("Error fetching MDR qualification:", e);
      }
      
      if (!qualification) {
        return {
          economicRole: "fabricant",
          hasAuthorizedRepresentative: false,
          targetMarkets: [],
          deviceClasses: [],
        };
      }
      
      return {
        ...qualification,
        targetMarkets: qualification.targetMarkets ? JSON.parse(qualification.targetMarkets as string) : [],
        deviceClasses: qualification.deviceClasses ? JSON.parse(qualification.deviceClasses as string) : [],
      };
    }),

  /**
   * Get MDR questions for audit (filtered by user's role)
   */
  getQuestions: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      // Get user's qualification first
      const [qualification] = await db.select()
        .from(schema.mdrRoleQualifications)
        .where(
          input.siteId
            ? and(
                eq(schema.mdrRoleQualifications.userId, ctx.user.id),
                eq(schema.mdrRoleQualifications.siteId, input.siteId)
              )
            : eq(schema.mdrRoleQualifications.userId, ctx.user.id)
        )
        .limit(1);
      
      if (!qualification) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Veuillez d'abord compléter votre qualification MDR sur /mdr/qualification",
        });
      }
      
      // Get all questions for user's role (including "tous")
      let questions = [];
      try {
        questions = await db.select()
          .from(schema.mdrQuestions)
          .where(eq(schema.mdrQuestions.isActive, true))
          .orderBy(schema.mdrQuestions.displayOrder);
      } catch (e) {
        console.error("Error fetching MDR questions:", e);
      }
      
      // Filter by role (show "tous" + user's specific role)
      let filteredQuestions = questions.filter(q => 
        q.economicRole === "tous" || q.economicRole === qualification.economicRole
      );

      // Fallback if no questions in DB
      if (filteredQuestions.length === 0) {
        filteredQuestions = FALLBACK_MDR_QUESTIONS.filter(q => 
          q.economicRole === "tous" || q.economicRole === qualification.economicRole
        ) as any;
      }
      
      return {
        questions: filteredQuestions,
        userRole: qualification.economicRole,
        totalQuestions: filteredQuestions.length,
      };
    }),

  /**
   * Save response to MDR audit question
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
      
      // Check if response already exists (upsert pattern)
      const [existing] = await db.select()
        .from(schema.mdrAuditResponses)
        .where(
          and(
            eq(schema.mdrAuditResponses.auditId, input.auditId),
            eq(schema.mdrAuditResponses.questionId, input.questionId)
          )
        )
        .limit(1);
      
      const responseData = {
        responseValue: input.responseValue,
        responseComment: input.responseComment || null,
        evidenceFiles: input.evidenceFiles ? JSON.stringify(input.evidenceFiles) : null,
        answeredBy: ctx.user.id,
        answeredAt: new Date(),
        updatedAt: new Date(),
      };
      
      if (existing) {
        // Update existing response
        await db.update(schema.mdrAuditResponses)
          .set(responseData)
          .where(eq(schema.mdrAuditResponses.id, existing.id));
      } else {
        // Insert new response
        await db.insert(schema.mdrAuditResponses).values({
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
        .from(schema.mdrAuditResponses)
        .where(
          and(
            eq(schema.mdrAuditResponses.auditId, input.auditId),
            eq(schema.mdrAuditResponses.questionId, input.questionId)
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
        .from(schema.mdrAuditResponses)
        .where(eq(schema.mdrAuditResponses.auditId, input.auditId));
      
      return responses.map(r => ({
        ...r,
        evidenceFiles: r.evidenceFiles ? JSON.parse(r.evidenceFiles as string) : [],
      }));
    }),
});
