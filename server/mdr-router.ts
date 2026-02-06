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
// import { FALLBACK_MDR_QUESTIONS, FALLBACK_PROCESSES } from "./fallback-data";
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
      if (!db) return { success: false, message: "Database not available" };
      
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
      if (db) {
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
   * Get MDR questions for audit (filtered by user's role and processes)
   * CRITICAL: Now normalized via mdr-validator to prevent frontend crash
   */
  getQuestions: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
      selectedProcesses: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      
      let qualificationProfile = null;
      if (db) {
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
      }
      
      const currentRole = qualificationProfile?.economicRole || "fabricant";
      const selectedProcesses = input.selectedProcesses || [];
      
      let questions = [];
      try {
        const allQuestions = await import("./all-questions-data.json");
        questions = allQuestions.default;
        console.log("[MDR] total questions loaded from JSON:", questions.length);
      } catch (e) {
        console.error("Error loading MDR questions from JSON:", e);
      }
      
      // Filter by role (Ultra-tolerant: if roles list is empty or role is 'tous', it's for everyone)
      let filteredQuestions = questions.filter(q => {
        const roles = Array.isArray(q.roles) ? q.roles : [];
        const economicRole = String(q.economicRole || "tous").toLowerCase();
        
        return roles.length === 0 || 
               roles.includes(currentRole) || 
               roles.includes("tous") ||
               economicRole === "tous" || 
               economicRole === currentRole;
      });

      // Fallback if no questions in DB
      if (filteredQuestions.length === 0) {
        // filteredQuestions = FALLBACK_MDR_QUESTIONS.filter(q => 
        //   q.economicRole === "tous" || q.economicRole === currentRole
        // ) as any; // Fallback removed for now;
      }

      // Filter by processes if provided
      if (selectedProcesses.length > 0) {
        filteredQuestions = filteredQuestions.filter(q => 
          q.applicableProcesses && Array.isArray(JSON.parse(q.applicableProcesses)) && 
          JSON.parse(q.applicableProcesses).some((p: string) => selectedProcesses.includes(p))
        );
      }
      
      const response = {
        questions: filteredQuestions,
        userRole: currentRole,
        totalQuestions: filteredQuestions.length,
        processes: [] // No longer using fallback processes, as they are now in the DB
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
      questionKey: z.string(), // Utiliser questionKey au lieu de questionId
      responseValue: z.enum(["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]),
      responseComment: z.string().optional(),
      evidenceFiles: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log("[MDR SAVE] input:", input);
        console.log("[MDR SAVE] userId:", ctx.user?.id ?? ctx.session?.user?.id);
        const db = await getDb();
        if (!db) return { success: false, message: "Database not available" };
        
        const { auditId, questionKey, responseValue, responseComment, evidenceFiles } = input;
        const userId = ctx.user.id;

        if (!questionKey || questionKey.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "questionKey cannot be empty" });
        }

        const responseData = {
          responseValue: responseValue,
          responseComment: responseComment || null,
          evidenceFiles: evidenceFiles ? JSON.stringify(evidenceFiles) : null,
          answeredBy: userId,
          answeredAt: new Date(),
          updatedAt: new Date(),
        };

        // UPSERT logic
        const [existing] = await db.select()
          .from(schema.auditResponses)
          .where(
            and(
              eq(schema.auditResponses.userId, userId),
              eq(schema.auditResponses.auditId, auditId),
              eq(schema.auditResponses.questionKey, questionKey)
            )
          )
          .limit(1);

        if (existing) {
          await db.update(schema.auditResponses)
            .set(responseData)
            .where(eq(schema.auditResponses.id, existing.id));
        } else {
          await db.insert(schema.auditResponses).values({
            userId: userId,
            auditId: auditId,
            questionKey: questionKey,
            ...responseData,
            createdAt: new Date(),
          });
        }
        
        return {
          success: true,
          message: "Réponse sauvegardée",
        };
      } catch (err) {
        console.error("[MDR SAVE] ERROR:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: String(err?.message ?? err) });
      }
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
      if (!db) return [];
      
      const responses = await db.select()
        .from(schema.mdrAuditResponses)
        .where(eq(schema.mdrAuditResponses.auditId, input.auditId));
      
      return responses.map(r => ({
        ...r,
        evidenceFiles: r.evidenceFiles ? JSON.parse(r.evidenceFiles as string) : [],
      }));
    }),
});
