import { z } from "zod";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, requireCapability, router } from "./_core/trpc";
import { getDb, safeJsonParse } from "./db";
import { capa_actions, referentiels, regulatoryUpdates, sectorBriefings, users } from "../drizzle/schema";
import { calculateAuditTrends, countUserAudits } from "./services/intelligence/trendCalculator";
import { hasCapability, normalizePlanTier } from "./plans/capabilities";
import { calculateSectorBenchmark } from "./services/intelligence/benchmarkCalculator";
import { getSourceHealthSummary } from "./services/watch/sourceHealthMonitor";

const referenceInput=z.object({referential:z.string().max(20).default("MDR")});
export const intelligenceRouter=router({
  referentials:protectedProcedure.query(async()=>{const db=await getDb();if(!db)return[];return db.select({id:referentiels.id,code:referentiels.code,name:referentiels.name}).from(referentiels);}),
  trends:protectedProcedure.input(z.object({referentialId:z.number().int().positive(),periodDays:z.number().int().min(30).max(365).default(90)})).query(async({ctx,input})=>({trends:await calculateAuditTrends(ctx.user.id,input.referentialId,input.periodDays),auditCount:await countUserAudits(ctx.user.id)})),
  briefings:requireCapability("canUseSectorIntelligence").input(referenceInput.extend({topic:z.enum(["audit_trends","safety_alerts","regulatory_updates","best_practices"]).optional()})).query(async({input})=>{const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});const filters=[eq(sectorBriefings.referential,input.referential),gt(sectorBriefings.validUntil,new Date())];if(input.topic)filters.push(eq(sectorBriefings.topic,input.topic));const rows=await db.select().from(sectorBriefings).where(and(...filters)).orderBy(desc(sectorBriefings.generatedAt));return rows.map(r=>({...r,content:typeof r.content==="string"?JSON.parse(r.content):r.content,sourcesUsed:safeJsonParse(r.sourcesUsed,[])}));}),
  signals:protectedProcedure.input(referenceInput).query(async({ctx})=>{const db=await getDb();if(!db)return[];const paid=normalizePlanTier(ctx.user.subscriptionTier)!=="free";const linked=await db.select({watchItemId:capa_actions.watchItemId}).from(capa_actions).where(eq(capa_actions.userId,ctx.user.id));const linkedIds=linked.flatMap(r=>r.watchItemId?[r.watchItemId]:[]);const conditions=[inArray(regulatoryUpdates.analysisCriticality,["watch","action_required"] as any)];if(linkedIds.length)conditions.push(sql`${regulatoryUpdates.id} NOT IN (${sql.join(linkedIds.map(id=>sql`${id}`),sql`,`)})` as any);const rows=await db.select().from(regulatoryUpdates).where(and(...conditions)).orderBy(desc(regulatoryUpdates.publishedAt)).limit(paid?20:3);return rows.map(r=>({id:r.id,title:r.title,summary:r.summaryFr||r.summaryLong,criticality:r.analysisCriticality,publishedAt:r.publishedAt?.toISOString()??null,sourceName:r.sourceName,sourceUrl:r.sourceUrl,actionRequired:r.actionRequired,referentialsImpacted:r.referentialsImpacted}));}),
  benchmark:requireCapability("canUseSectorBenchmark").input(z.object({referentialId:z.number().int().positive(),periodDays:z.number().int().min(90).max(730).default(365)})).query(async({ctx,input})=>calculateSectorBenchmark(ctx.user.id,input.referentialId,input.periodDays)),
  sourceHealth:requireCapability("canUseSectorIntelligence").query(async()=>getSourceHealthSummary()),
  access:protectedProcedure.query(async({ctx})=>{const db=await getDb();const tier=normalizePlanTier(ctx.user.subscriptionTier);let activeUsers=0;if(db){const [row]=await db.select({count:sql<number>`count(*)`}).from(users);activeUsers=Number(row?.count??0);}return{tier,canUseSectorIntelligence:hasCapability("canUseSectorIntelligence",ctx.user),canUseSectorBenchmark:hasCapability("canUseSectorBenchmark",ctx.user)&&activeUsers>=10,activeUsersThresholdMet:activeUsers>=10};}),
});
