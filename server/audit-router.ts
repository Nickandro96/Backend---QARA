/**
 * Audit Router
 * Handles audit creation, updates, and metadata management
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const auditRouter = router({
  /**
   * STEP 1: Create audit with critical fields
   * Required fields: siteId, scope, auditMethod, plannedStartDate, auditLeader, auditeeMainContact, auditeeContactEmail
   */
  create: protectedProcedure
    .input(z.object({
      auditType: z.enum(["internal", "supplier", "mock"]),
      standard: z.enum(["MDR", "ISO13485", "ISO9001", "FDA"]).default("MDR"),
      name: z.string().min(2),
      siteId: z.number().int().positive(),
      organizationId: z.number().int().positive().optional(),
      referentialIds: z.array(z.number()).optional(),
      economicRole: z.string().optional(),
      processesSelected: z.array(z.union([z.string(), z.number()])).optional(),
      scope: z.string().min(5),
      auditMethod: z.enum(["on_site", "remote", "hybrid"]),
      plannedStartDate: z.date(),
      plannedEndDate: z.date().optional(),
      auditLeader: z.string().min(2),
      auditeeMainContact: z.string().min(2),
      auditeeContactEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Validate siteId belongs to user
      const site = await db.getSiteByIdAndUserId(input.siteId, userId);
      if (!site) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid siteId or site does not belong to user",
        });
      }

      // Validate organizationId if provided
      if (input.organizationId) {
        const org = await db.getOrganizationByIdAndUserId(input.organizationId, userId);
        if (!org) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid organizationId or organization does not belong to user",
          });
        }
      }

      try {
        const auditId = await db.createAudit({
          userId,
          auditType: input.auditType,
          standard: input.standard,
          name: input.name,
          siteId: input.siteId,
          organizationId: input.organizationId,
          referentialIds: input.referentialIds || [],
          economicRole: input.economicRole,
          processesSelected: input.processesSelected || [],
          scope: input.scope,
          auditMethod: input.auditMethod,
          plannedStartDate: input.plannedStartDate,
          plannedEndDate: input.plannedEndDate,
          auditLeader: input.auditLeader,
          auditeeMainContact: input.auditeeMainContact,
          auditeeContactEmail: input.auditeeContactEmail,
          status: "in_progress",
        });

        return {
          auditId,
          message: "Audit created successfully",
        };
      } catch (error: any) {
        console.error("[AUDIT CREATE] Database error:", error.message, {
          userId,
          auditType: input.auditType,
          siteId: input.siteId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create audit: " + error.message,
          cause: error,
        });
      }
    }),

  /**
   * STEP 2: Update audit metadata (optional enrichment)
   * Fields: auditedEntityName, auditedEntityAddress, exclusions, productFamilies, classDevices, markets, auditTeamMembers, versionReferentials
   */
  updateMetadata: protectedProcedure
    .input(z.object({
      auditId: z.number().int().positive(),
      auditedEntityName: z.string().optional(),
      auditedEntityAddress: z.string().optional(),
      exclusions: z.string().optional(),
      productFamilies: z.string().optional(),
      classDevices: z.string().optional(),
      markets: z.string().optional(),
      auditTeamMembers: z.string().optional(),
      versionReferentials: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { auditId, ...metadata } = input;

      // Verify audit belongs to user
      const audit = await db.getAuditById(auditId, userId);
      if (!audit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audit not found or does not belong to user",
        });
      }

      try {
        await db.updateAudit(auditId, metadata);
        return {
          success: true,
          message: "Audit metadata updated successfully",
        };
      } catch (error: any) {
        console.error("[AUDIT UPDATE METADATA] Database error:", error.message, {
          userId,
          auditId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update audit metadata: " + error.message,
          cause: error,
        });
      }
    }),

  /**
   * Get audit by ID (with multi-tenancy check)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const audit = await db.getAuditById(input.id, ctx.user.id);
      if (!audit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audit not found or does not belong to user",
        });
      }
      return audit;
    }),

  /**
   * List audits for user
   */
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

  /**
   * Delete audit (with multi-tenancy check)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const audit = await db.getAuditById(input.id, ctx.user.id);
      if (!audit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audit not found or does not belong to user",
        });
      }

      try {
        await db.deleteAudit(input.id, ctx.user.id);
        return { success: true };
      } catch (error: any) {
        console.error("[AUDIT DELETE] Database error:", error.message, {
          userId: ctx.user.id,
          auditId: input.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete audit: " + error.message,
          cause: error,
        });
      }
    }),
});
