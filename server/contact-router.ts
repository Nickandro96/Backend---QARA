// server/contact-router.ts
//
// Frontend expects trpc.contact.submit (public, Contact.tsx),
// trpc.contact.list/updateStatus (admin, AdminContacts.tsx) — voir
// INVENTAIRE-BUGS.md #6/#8, namespace absent jusqu'ici.
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { contact_messages } from "../drizzle/schema";

export const contactRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        company: z.string().optional(),
        subject: z.string().min(1),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(contact_messages).values({
        userId: (ctx.user as any)?.id ?? null,
        name: input.name,
        email: input.email,
        company: input.company ?? null,
        subject: input.subject,
        message: input.message,
        status: "new",
      });

      return { success: true };
    }),

  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(contact_messages).orderBy(contact_messages.createdAt);
  }),

  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "read", "replied", "archived"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(contact_messages)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(contact_messages.id, input.id));
      return { success: true };
    }),
});
