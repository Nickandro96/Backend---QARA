import { z } from "zod";
import { router, protectedProcedure, adminProcedure, requireCapability } from "./_core/trpc";
import {
  getUpdatesCached,
  triggerRefresh,
  getOrDefaultCompanyProfile,
  saveCompanyProfile,
  personalizeUpdate,
} from "./services/watch/WatchAggregator";
import { getReadItemIds, getUnreadItemCount, listActiveSources, markItemRead, markItemUnread } from "./services/watch/WatchStore";

const zUpdateType = z.enum(["REGULATION", "GUIDANCE", "STANDARD", "QUALITY"]);
const zImpactLevel = z.enum(["Low", "Medium", "High", "Critical"]);
const zStatus = z.enum(["NEW", "UPDATED", "REPEALED", "CORRIGENDUM"]);

const zCompanyProfile = z.object({
  economicRole: z.enum(["fabricant", "importateur", "distributeur", "sous_traitant", "ar"]),
  deviceClass: z.enum(["I", "IIa", "IIb", "III"]),
  deviceFamilies: z.array(z.enum(["active", "non_active", "implantable", "sterile", "software", "in_vitro"])),
  markets: z.array(z.enum(["EU", "UK", "CH", "US"])),
  preferredReferentials: z.array(z.enum(["MDR","IVDR","FDA_QMSR","MDSAP","ISO13485","ISO14971","ISO9001"])).optional(),
  preferredSources: z.array(z.string().min(1)).optional(),
  notificationEnabled: z.boolean().optional(),
  notificationFrequency: z.enum(["realtime","daily","weekly","never"]).optional(),
});

export const watchRouter = router({
  // Front expects: trpc.watch.updates() (client/src/pages/WatchDashboard.tsx,
  // gaté client-side par hasCapability("canUseVeille", ...) dans
  // RegulatoryWatch.tsx) — endpoint de données principal de la fonctionnalité
  // veille réglementaire, jamais contrôlé côté serveur jusqu'ici.
  updates: requireCapability("canUseVeille")
    .input(
      z.object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        type: zUpdateType.optional(),
        impactLevel: zImpactLevel.optional(),
        status: zStatus.optional(),
        search: z.string().optional(),
        includeDetails: z.coerce.boolean().optional().default(true),
        marketsImpacted: z.array(z.string()).optional(),
        rolesImpacted: z.array(z.string()).optional(),
        sourceIds: z.array(z.string()).optional(),
        readStatus: z.enum(["all", "read", "unread"]).optional().default("all"),
        sortBy: z.enum(["date", "criticality", "relevance"]).optional().default("date"),
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
      const readIds = await getReadItemIds(ctx.user.id);

      // Equivalent SQL for DB-side optimization: JSON_OVERLAPS(markets_impacted, JSON_ARRAY(...))
      let filteredItems = items.filter((it) => {
        if (input.marketsImpacted?.length && !input.marketsImpacted.some((v) => it.marketsImpacted.includes(v))) return false;
        if (input.rolesImpacted?.length && !input.rolesImpacted.some((v) => it.rolesImpacted.includes(v as any))) return false;
        if (input.sourceIds?.length && (!it.sourceRegistryId || !input.sourceIds.includes(it.sourceRegistryId))) return false;
        const isRead = readIds.has(it.id); if (input.readStatus === "read" && !isRead) return false; if (input.readStatus === "unread" && isRead) return false;
        return true;
      });
      if (input.sortBy === "criticality") filteredItems = filteredItems.sort((a,b) => ["Critical","High","Medium","Low"].indexOf(a.impactLevel)-["Critical","High","Medium","Low"].indexOf(b.impactLevel));
      const enrichedItems = filteredItems.map((it) => {
        const personalized = personalizeUpdate(it, profile);
        return {
          ...it,
          personalizedImpact: personalized,
          isRead: readIds.has(it.id),
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

  getSources: protectedProcedure.query(async () => ({ sources: await listActiveSources() })),
  markAsRead: protectedProcedure.input(z.object({ itemId: z.string().uuid() })).mutation(async ({ ctx, input }) => ({ success: await markItemRead(ctx.user.id, input.itemId) })),
  markAsUnread: protectedProcedure.input(z.object({ itemId: z.string().uuid() })).mutation(async ({ ctx, input }) => { await markItemUnread(ctx.user.id, input.itemId); return { success: true }; }),
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => ({ count: await getUnreadItemCount(ctx.user.id) })),
  getProfile: protectedProcedure.query(async ({ ctx }) => ({ profile: await getOrDefaultCompanyProfile(ctx.user.id) })),
  updateProfile: protectedProcedure.input(zCompanyProfile).mutation(async ({ ctx, input }) => { await saveCompanyProfile(ctx.user.id, input); return { success: true }; }),

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
