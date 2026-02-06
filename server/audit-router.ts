import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const auditRouter = router({
  /**
   * Create a new audit
   */
  create: protectedProcedure
    .input(z.object({
      auditType: z.enum(["internal", "external", "supplier", "certification", "surveillance", "blanc"]),
      name: z.string(),
      referentialIds: z.array(z.number()).optional(),
      siteId: z.number().optional(),
      auditorName: z.string().optional(),
      auditorEmail: z.string().email().optional(),
      startDate: z.string().optional(), // ISO date string
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [audit] = await db.insert(schema.audits).values({
        userId: ctx.user.id,
        name: input.name,
        auditType: input.auditType,
        referentialIds: input.referentialIds ? JSON.stringify(input.referentialIds) : null,
        siteId: input.siteId || null,
        auditorName: input.auditorName || null,
        auditorEmail: input.auditorEmail || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        notes: input.notes || null,
        status: "draft",
        score: null,
        conformityRate: null,
        siteLocation: null,
        clientOrganization: null,
        endDate: null,
        closedAt: null,
      }).$returningId();
      
      return { auditId: audit.id };
    }),

  /**
   * Get all audits for current user
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "in_progress", "completed", "closed"]).optional(),
      referentialId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      let query = db
        .select()
        .from(schema.audits)
        .where(eq(schema.audits.userId, ctx.user.id))
        .orderBy(desc(schema.audits.createdAt));

      const audits = await query;

      // Filter by status if provided
      let filtered = audits;
      if (input?.status) {
        filtered = filtered.filter(a => a.status === input.status);
      }

      // Filter by referentialId if provided
      if (input?.referentialId) {
        filtered = filtered.filter(a => {
          if (!a.referentialIds) return false;
          const ids = JSON.parse(a.referentialIds);
          return ids.includes(input.referentialId);
        });
      }

      return filtered;
    }),

  /**
   * Get single audit by ID
   */
  get: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      return audit;
    }),

  /**
   * Update audit metadata
   */
  update: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      name: z.string().optional(),
      status: z.enum(["draft", "in_progress", "completed", "closed"]).optional(),
      auditorName: z.string().optional(),
      auditorEmail: z.string().email().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      notes: z.string().optional(),
      score: z.number().optional(),
      conformityRate: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { auditId, ...updates } = input;

      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Prepare update object
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.status) updateData.status = updates.status;
      if (updates.auditorName) updateData.auditorName = updates.auditorName;
      if (updates.auditorEmail) updateData.auditorEmail = updates.auditorEmail;
      if (updates.startDate) updateData.startDate = new Date(updates.startDate);
      if (updates.endDate) updateData.endDate = new Date(updates.endDate);
      if (updates.notes) updateData.notes = updates.notes;
      if (updates.score !== undefined) updateData.score = updates.score.toString();
      if (updates.conformityRate !== undefined) updateData.conformityRate = updates.conformityRate.toString();

      // Mark as completed if status is completed
      if (updates.status === "completed" && !audit.closedAt) {
        updateData.closedAt = new Date();
      }

      await db
        .update(schema.audits)
        .set(updateData)
        .where(eq(schema.audits.id, auditId));

      return { success: true };
    }),

  /**
   * Update audit header (metadata)
   */
  updateHeader: protectedProcedure
    .input(z.object({
      auditId: z.number(),
      siteLocation: z.string().optional(),
      clientOrganization: z.string().optional(),
      auditorName: z.string().optional(),
      auditorEmail: z.string().email().optional(),
      startDate: z.string().optional(), // ISO date string
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { auditId, ...updates } = input;
      
      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Build update object
      const updateData: any = {};
      if (updates.siteLocation !== undefined) updateData.siteLocation = updates.siteLocation;
      if (updates.clientOrganization !== undefined) updateData.clientOrganization = updates.clientOrganization;
      if (updates.auditorName !== undefined) updateData.auditorName = updates.auditorName;
      if (updates.auditorEmail !== undefined) updateData.auditorEmail = updates.auditorEmail;
      if (updates.startDate !== undefined) updateData.startDate = updates.startDate ? new Date(updates.startDate) : null;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      await db
        .update(schema.audits)
        .set(updateData)
        .where(eq(schema.audits.id, auditId));

      return { success: true };
    }),

  /**
   * Delete audit
   */
  delete: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      await db
        .delete(schema.audits)
        .where(eq(schema.audits.id, input.auditId));

      return { success: true };
    }),

  /**
   * Get audit statistics
   */
  getStats: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify ownership
      const [audit] = await db
        .select()
        .from(schema.audits)
        .where(
          and(
            eq(schema.audits.id, input.auditId),
            eq(schema.audits.userId, ctx.user.id)
          )
        );

      if (!audit) {
        throw new Error("Audit not found");
      }

      // Get response counts from audit_responses table
      const responses = await db
        .select()
        .from(schema.auditResponses)
        .where(eq(schema.auditResponses.auditId, input.auditId));

      const stats = {
        total: responses.length,
        compliant: responses.filter(r => r.responseValue === "compliant").length,
        nonCompliant: responses.filter(r => r.responseValue === "non_compliant").length,
        partial: responses.filter(r => r.responseValue === "partial").length,
        notApplicable: responses.filter(r => r.responseValue === "not_applicable").length,
        inProgress: responses.filter(r => r.responseValue === "in_progress").length,
      };

      const complianceScore = stats.total > 0
        ? ((stats.compliant + stats.partial * 0.5) / (stats.total - stats.notApplicable)) * 100
        : 0;

      return {
        ...stats,
        complianceScore: Math.round(complianceScore * 100) / 100,
      };
    }),

  /**
   * Get dashboard statistics (all audits for user)
   */
  getDashboardStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get all audits for user
      const audits = await db
        .select()
        .from(schema.audits)
        .where(eq(schema.audits.userId, ctx.user.id));

      // Get all responses for all user audits
      const allResponses = await db
        .select()
        .from(schema.auditResponses)
        .where(eq(schema.auditResponses.userId, ctx.user.id));

      // Calculate overall stats
      const totalAudits = audits.length;
      const activeAudits = audits.filter(a => a.status === "in_progress" || a.status === "draft").length;
      const completedAudits = audits.filter(a => a.status === "completed").length;

      const totalResponses = allResponses.length;
      const compliantResponses = allResponses.filter(r => r.responseValue === "compliant").length;
      const nonCompliantResponses = allResponses.filter(r => r.responseValue === "non_compliant").length;

      const overallComplianceScore = totalResponses > 0
        ? (compliantResponses / totalResponses) * 100
        : 0;

      return {
        totalAudits,
        activeAudits,
        completedAudits,
        totalResponses,
        compliantResponses,
        nonCompliantResponses,
        overallComplianceScore: Math.round(overallComplianceScore * 100) / 100,
      };
    }),
});
