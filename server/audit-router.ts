import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

export const auditRouter = router({
  /**
   * STABILIZED Create audit with REAL schema fields
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
      siteId: z.number().int().positive(),
      auditType: z.enum(["internal", "supplier", "mock"]),
      referentialIds: z.array(z.number()).default([1]),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Validate siteId belongs to user
      const site = await db.getSiteByIdAndUserId(input.siteId, userId);
      if (!site) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Site not found or does not belong to user",
        });
      }

      try {
        const auditId = await db.createAudit({
          userId,
          siteId: input.siteId,
          name: input.name,
          auditType: input.auditType,
          status: "in_progress",
          startDate: input.startDate,
          endDate: input.endDate,
          referentialIds: JSON.stringify(input.referentialIds),
        });

        return {
          auditId,
          message: "Audit created successfully",
        };
      } catch (error: any) {
        console.error("[AUDIT CREATE ROUTER] Error:", error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create audit: " + error.message,
        });
      }
    }),

  list: protectedProcedure
    .input(z.object({
      siteId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return await db.getAudits({
        userId: ctx.user.id,
        siteId: input?.siteId,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const audit = await db.getAuditById(input.id, ctx.user.id);
      if (!audit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audit not found",
        });
      }
      return audit;
    }),
});
