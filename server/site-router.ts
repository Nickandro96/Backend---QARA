import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from './trpc';
import { sites } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

export const siteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    return ctx.db.select().from(sites).where(eq(sites.userId, userId));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const newSite = await ctx.db.insert(sites).values({
        ...input,
        userId: userId,
      });
      return newSite;
    }),

  getDefaultOrCreate: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    let defaultSite = await ctx.db.select().from(sites).where(and(eq(sites.userId, userId), eq(sites.name, 'Default Site'))).limit(1);

    if (defaultSite.length === 0) {
      const newSite = await ctx.db.insert(sites).values({
        name: 'Default Site',
        userId: userId,
      });
      defaultSite = await ctx.db.select().from(sites).where(and(eq(sites.userId, userId), eq(sites.name, 'Default Site'))).limit(1);
    }
    return defaultSite[0];
  }),
});
