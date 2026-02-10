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
import { normalizeMdrResponse } from "./mdr-validator";
import fs from "fs";
import path from "path";
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
  { id: "tech_doc", name: "Documentation technique", displayOrder: 13 }
];

export const mdrRouter = router({
  /**
   * Get canonical list of MDR processes
   */
  getProcesses: protectedProcedure
    .query(() => {
      console.log("[MDR] processes returned:", MDR_PROCESSES.length);
      return { processes: MDR_PROCESSES };
    }),

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
        const jsonPath = path.join(process.cwd(), "server", "all-questions-data.json");
        if (fs.existsSync(jsonPath)) {
          const rawData = fs.readFileSync(jsonPath, "utf-8");
          questions = JSON.parse(rawData);
          console.log("[MDR] total questions loaded from JSON:", questions.length);
        } else {
          console.error("[MDR] all-questions-data.json NOT FOUND at:", jsonPath);
        }
      } catch (e) {
        console.error("Error loading MDR questions from JSON:", e);
      }
      
      // Filter by role (Ultra-tolerant: if roles list is empty or role is 'tous', it's for everyone)
      let filteredQuestions = questions.filter((q: any) => {
        const roles = Array.isArray(q.roles) ? q.roles : [];
        const economicRole = String(q.economicRole || "tous").toLowerCase();
        
        return roles.length === 0 || 
               roles.includes(currentRole) || 
               roles.includes("tous") ||
               economicRole === "tous" || 
               economicRole === currentRole;
      });

      // Filter by processes if provided
      if (selectedProcesses.length > 0) {
        filteredQuestions = filteredQuestions.filter((q: any) => {
          // Check processId or process field
          const qProcessId = q.processId || q.process;
          
          // Check applicableProcesses array
          const applicableProcesses = Array.isArray(q.applicableProcesses) 
            ? q.applicableProcesses 
            : (typeof q.applicableProcesses === "string" && q.applicableProcesses.startsWith("[") 
                ? JSON.parse(q.applicableProcesses) 
                : []);
          
          return selectedProcesses.includes(qProcessId) || 
                 applicableProcesses.some((p: string) => selectedProcesses.includes(p));
        });
      }
      
      const response = {
        questions: filteredQuestions,
        userRole: currentRole,
        totalQuestions: filteredQuestions.length,
        processes: MDR_PROCESSES
      };

      return normalizeMdrResponse(response);
    }),

  /**
   * Save response to MDR audit question
   */
  saveResponse: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionKey: z.string(),
      responseValue: z.enum(["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]),
      responseComment: z.string().optional(),
      note: z.string().optional(),
      role: z.string().optional(),
      processId: z.string().optional(),
      evidenceFiles: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log("[MDR SAVE] input:", input);
        const db = await getDb();
        if (!db) return { success: false, message: "Database not available" };
        
        const { auditId, questionKey, responseValue, responseComment, note, role, processId, evidenceFiles } = input;
        const userId = ctx.user.id;

        if (!questionKey || questionKey.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "questionKey cannot be empty" });
        }

        const responseData = {
          responseValue: responseValue,
          responseComment: responseComment || null,
          note: note || null,
          role: role || null,
          processId: processId || null,
          evidenceFiles: evidenceFiles ? JSON.stringify(evidenceFiles) : null,
          answeredBy: userId,
          answeredAt: new Date(),
          updatedAt: new Date(),
        };

        // UPSERT logic on audit_responses
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
        .from(schema.auditResponses)
        .where(
          and(
            eq(schema.auditResponses.userId, ctx.user.id),
            eq(schema.auditResponses.auditId, input.auditId)
          )
        );
      
      return responses.map(r => ({
        ...r,
        evidenceFiles: r.evidenceFiles ? JSON.parse(r.evidenceFiles as string) : [],
      }));
    }),

  /**
   * Save evidence file metadata
   */
  saveEvidenceFile: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionKey: z.string(),
      fileName: z.string(),
      fileKey: z.string(),
      fileUrl: z.string(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      
      await db.insert(schema.mdrEvidenceFiles).values({
        userId: ctx.user.id,
        auditId: input.auditId,
        questionKey: input.questionKey,
        fileName: input.fileName,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        fileSize: input.fileSize || null,
        mimeType: input.mimeType || null,
      });
      
      return { success: true };
    }),

  /**
   * Get evidence files for a question
   */
  getEvidenceFiles: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      questionKey: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      
      return await db.select()
        .from(schema.mdrEvidenceFiles)
        .where(
          and(
            eq(schema.mdrEvidenceFiles.userId, ctx.user.id),
            eq(schema.mdrEvidenceFiles.auditId, input.auditId),
            eq(schema.mdrEvidenceFiles.questionKey, input.questionKey)
          )
        );
    }),
});
