import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  getUpdatesCached,
  triggerRefresh,
  getOrDefaultCompanyProfile,
  saveCompanyProfile,
  personalizeUpdate,
} from "./services/watch/WatchAggregator";

const zUpdateType = z.enum(["REGULATION", "GUIDANCE", "STANDARD", "QUALITY"]);
const zImpactLevel = z.enum(["Low", "Medium", "High", "Critical"]);
const zStatus = z.enum(["NEW", "UPDATED", "REPEALED", "CORRIGENDUM"]);

const zCompanyProfile = z.object({
  economicRole: z.enum(["fabricant", "importateur", "distributeur", "sous_traitant", "ar"]),
  deviceClass: z.enum(["I", "IIa", "IIb", "III"]),
  deviceFamilies: z.array(z.enum(["active", "non_active", "implantable", "sterile", "software", "in_vitro"])),
  markets: z.array(z.enum(["EU", "UK", "CH", "US"])),
});

export const watchRouter = router({
  updates: protectedProcedure
    .input(
      z.object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        type: zUpdateType.optional(),
        impactLevel: zImpactLevel.optional(),
        status: zStatus.optional(),
        search: z.string().optional(),
        includeDetails: z.coerce.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const { items, meta } = await getUpdatesCached({
        limit: input.limit,
        offset: input.offset,
        type: input.type,
        impactLevel: input.impactLevel,
        status: input.status,
        search: input.search,
      });

      // If stale, trigger refresh non-blocking.
      if (meta.stale && !meta.refreshInProgress) {
        void triggerRefresh("page_open");
      }

      const profile = await getOrDefaultCompanyProfile(ctx.user.id);

      const enrichedItems = items.map((it) => {
        const personalized = personalizeUpdate(it, profile);
        return {
          ...it,
          personalizedImpact: personalized,
        };
      });

      return { items: enrichedItems, meta, companyProfile: profile };
    }),

  latest: protectedProcedure.query(async ({ ctx }) => {
    const { items, meta } = await getUpdatesCached({ limit: 20, offset: 0 });
    if (meta.stale && !meta.refreshInProgress) void triggerRefresh("page_open");
    return { items: items.slice(0, 10), meta };
  }),

  critical: protectedProcedure.query(async ({ ctx }) => {
    const { items, meta } = await getUpdatesCached({ limit: 100, offset: 0 });
    if (meta.stale && !meta.refreshInProgress) void triggerRefresh("page_open");
    const critical = items.filter((i) => i.impactLevel === "Critical" || i.impactLevel === "High");
    return { items: critical.slice(0, 30), meta };
  }),

  refresh: adminProcedure
    .input(z.object({ trigger: z.enum(["manual"]).default("manual") }))
    .mutation(async ({ input }) => {
      return await triggerRefresh(input.trigger);
    }),

  companyProfile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrDefaultCompanyProfile(ctx.user.id);
      return { profile };
    }),
    upsert: protectedProcedure.input(zCompanyProfile).mutation(async ({ ctx, input }) => {
      await saveCompanyProfile(ctx.user.id, input);
      return { success: true };
    }),
  }),
});
