// Backend---QARA-main/server/audit-router.ts
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { audits, sites } from "../drizzle/schema";

export const auditRouter = router({
  /**
   * Frontend expects: trpc.audit.getRecentAudits({ limit })
   */
  getRecentAudits: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(5) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select({
          id: audits.id,
          name: audits.name,
          auditType: audits.auditType,
          status: audits.status,
          startDate: audits.startDate,
          endDate: audits.endDate,
          conformityRate: audits.conformityRate,
          siteName: sites.name,
        })
        .from(audits)
        .leftJoin(sites, eq(audits.siteId, sites.id))
        .where(eq(audits.userId, ctx.user.id))
        .orderBy(desc(audits.createdAt))
        .limit(input.limit);

      return rows;
    }),
});