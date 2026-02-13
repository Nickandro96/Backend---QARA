import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { sites } from "../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * Helpers
 * - convert "" / undefined -> null
 * - coerce numeric values safely
 */
const emptyStringToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const optionalIntOrNull = z.preprocess(
  emptyStringToNull,
  z.coerce.number().int().positive().nullable()
);

const optionalTrimmedStringOrNull = z.preprocess((v: unknown) => {
  if (v === "" || v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}, z.string().nullable());

export const siteRouter = router({
  /**
   * List sites for current user
   * Frontend: trpc.sites.list.useQuery()
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const rows = await db
      .select()
      .from(sites)
      .where(eq(sites.userId, ctx.user.id))
      .orderBy(desc(sites.createdAt));

    return rows;
  }),

  /**
   * Get a site by id (must belong to current user)
   * Frontend: trpc.sites.getById.useQuery({ id })
   */
  getById: protectedProcedure
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [row] = await db
        .select()
        .from(sites)
        .where(and(eq(sites.id, input.id), eq(sites.userId, ctx.user.id)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site introuvable" });
      }

      return row;
    }),

  /**
   * Create a new site (organisationId can be null)
   * Frontend: trpc.sites.create.useMutation()
   *
   * ✅ Fixes:
   * - organisationId: "" -> null (prevents MySQL insert error)
   * - all strings trimmed and normalized ("" -> null)
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),

        // Optional fields (normalized)
        code: optionalTrimmedStringOrNull.optional(),
        addressLine1: optionalTrimmedStringOrNull.optional(),
        addressLine2: optionalTrimmedStringOrNull.optional(),
        city: optionalTrimmedStringOrNull.optional(),
        postalCode: optionalTrimmedStringOrNull.optional(),
        country: optionalTrimmedStringOrNull.optional(),
        phone: optionalTrimmedStringOrNull.optional(),
        email: optionalTrimmedStringOrNull.optional(),
        notes: optionalTrimmedStringOrNull.optional(),

        isMainSite: z.coerce.boolean().optional().default(false),
        isActive: z.coerce.boolean().optional().default(true),

        // ✅ Critical bug fix: accept "", undefined => null
        organisationId: optionalIntOrNull.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const values = {
        userId: ctx.user.id,

        name: input.name.trim(),

        code: input.code ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,

        isMainSite: input.isMainSite ?? false,
        isActive: input.isActive ?? true,

        // ✅ never send "" to MySQL
        organisationId: input.organisationId ?? null,

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result: any = await db.insert(sites).values(values);

      // MySQL drivers differ: try common insertId locations
      const insertedId =
        result?.[0]?.insertId ??
        result?.insertId ??
        null;

      return {
        id: insertedId,
        ...values,
      };
    }),
});
