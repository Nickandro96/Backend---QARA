import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

export const siteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getSites(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
      code: z.string().optional(),
      address: z.string().optional(),
      country: z.string().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await db.createSite({
          ...input,
          userId: ctx.user.id,
        });
      } catch (error: any) {
        console.error("[SITE CREATE ROUTER] Error:", error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create site: " + error.message,
        });
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const site = await db.getSiteByIdAndUserId(input.id, ctx.user.id);
      if (!site) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Site not found",
        });
      }
      return site;
    }),

  getDefaultOrCreate: protectedProcedure.mutation(async ({ ctx }) => {
    let site = await db.getFirstSiteByUserId(ctx.user.id);
    if (!site) {
      site = await db.createSite({
        userId: ctx.user.id,
        name: "Default Site",
        isActive: true,
      }) as any;
    }
    return site;
  }),
});
