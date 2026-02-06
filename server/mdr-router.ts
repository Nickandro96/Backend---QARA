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
import { normalizeMdrResponse } from "./mdr-validator";

export const mdrRouter = router({
  /**
   * Save MDR Role Qualification
   */
  saveQualification: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
      economicRole: z.enum(["fabricant", "importateur", "distributeur", "mandataire"]),
      hasAuthorizedRepresentative: z.boolean().default(false),
      targetMarkets: z.array(z.string()).optional(),
      deviceClasses: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      
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
        await db.update(schema.mdrRoleQualifications)
          .set(qualificationData)
          .where(eq(schema.mdrRoleQualifications.id, existing.id));
      } else {
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
   * CRITICAL: Now normalized via mdr-validator to prevent frontend crash
   */
  getQuestions: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      let qualificationProfile = null;
      try {
        const [q] = await db.select()
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
        qualificationProfile = q;
      } catch (e) {
        console.error("Error fetching qualification:", e);
      }
      
      const currentRole = qualificationProfile?.economicRole || "fabricant";
      
      let questions = [];
      try {
        questions = await db.select()
          .from(schema.mdrQuestions)
          .where(eq(schema.mdrQuestions.isActive, true))
          .orderBy(schema.mdrQuestions.displayOrder);
      } catch (e) {
        console.error("Error fetching MDR questions:", e);
      }
      
      // Filter by role
      let filteredQuestions = questions.filter(q => 
        q.economicRole === "tous" || q.economicRole === currentRole
      );

      // Fallback if no questions in DB
      if (filteredQuestions.length === 0) {
        filteredQuestions = FALLBACK_MDR_QUESTIONS.filter(q => 
          q.economicRole === "tous" || q.economicRole === currentRole
        ) as any;
      }
      
      const response = {
        questions: filteredQuestions,
        userRole: currentRole,
        totalQuestions: filteredQuestions.length,
      };

      // NORMALIZATION: Secure the data before sending to frontend
      return normalizeMdrResponse(response);
    }),

  /**
   * Save response to MDR audit question
   */
  saveResponse: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionId: z.union([z.number(), z.string()]),
      responseValue: z.enum(["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]),
      responseComment: z.string().optional(),
      evidenceFiles: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      
      // Handle string IDs by converting them to number if possible, or using a hash
      const qId = typeof input.questionId === 'number' ? input.questionId : 0;
      
      const [existing] = await db.select()
        .from(schema.mdrAuditResponses)
        .where(
          and(
            eq(schema.mdrAuditResponses.auditId, input.auditId),
            eq(schema.mdrAuditResponses.questionId, qId)
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
        await db.update(schema.mdrAuditResponses)
          .set(responseData)
          .where(eq(schema.mdrAuditResponses.id, existing.id));
      } else {
        await db.insert(schema.mdrAuditResponses).values({
          auditId: input.auditId,
          questionId: qId,
          ...responseData,
        });
      }
      
      return {
        success: true,
        message: "Réponse sauvegardée",
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
