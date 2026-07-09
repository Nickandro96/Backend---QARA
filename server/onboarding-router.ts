import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { onboardingProfiles } from "../drizzle/schema";
import { maxReferentiels } from "./lib/plans";

// The 7 referentials supported by the platform (see project overview: MDR, IVDR,
// FDA QMSR, MDSAP, ISO 13485, ISO 14971, ISO 9001).
const VALID_REFERENTIELS = [
  "MDR",
  "IVDR",
  "FDA_QMSR",
  "MDSAP",
  "ISO_13485",
  "ISO_14971",
  "ISO_9001",
] as const;

const VALID_MARKETS = ["EU", "UK", "CH", "US"] as const;

const zEconomicRole = z.enum(["fabricant", "mandataire", "importateur", "distributeur"]);
const zReferentiel = z.enum(VALID_REFERENTIELS);
const zMarket = z.enum(VALID_MARKETS);

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const onboardingRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [profile] = await db
      .select()
      .from(onboardingProfiles)
      .where(eq(onboardingProfiles.userId, ctx.user.id))
      .limit(1);

    if (!profile) return null;

    return {
      referentiels: parseJsonArray(profile.referentiels),
      economicRole: profile.economicRole,
      markets: parseJsonArray(profile.markets),
      completedAt: profile.completedAt,
    };
  }),

  saveProfile: protectedProcedure
    .input(
      z.object({
        referentiels: z.array(zReferentiel).min(1),
        economicRole: zEconomicRole,
        markets: z.array(zMarket).min(1),
        completed: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const allowed = maxReferentiels(ctx.user);
      if (input.referentiels.length > allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Votre plan limite l'onboarding à ${allowed} référentiel(s). Passez au plan Pro pour en sélectionner davantage.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select({ id: onboardingProfiles.id })
        .from(onboardingProfiles)
        .where(eq(onboardingProfiles.userId, ctx.user.id))
        .limit(1);

      const values = {
        referentiels: input.referentiels,
        economicRole: input.economicRole,
        markets: input.markets,
        completedAt: input.completed ? new Date() : null,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(onboardingProfiles).set(values).where(eq(onboardingProfiles.id, existing.id));
      } else {
        await db.insert(onboardingProfiles).values({ userId: ctx.user.id, ...values });
      }

      return { success: true };
    }),
});
