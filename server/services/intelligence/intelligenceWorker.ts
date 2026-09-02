import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { sectorBriefings } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { generateSectorBriefing } from "./sectorAnalyzer";
import { fetchFdaRecalls } from "./sources/FdaRecallSource";
import { fetchNbogPublications } from "./sources/NbogPublications";
import { fetchEudamedAlerts } from "./sources/EudamedAlertsSource";
import type { SectorTopic } from "./types";

const TOPICS:SectorTopic[]=["audit_trends","safety_alerts","regulatory_updates","best_practices"];
const CONCURRENCY=2;
export async function generateWeeklyBriefings(referentials=["MDR","IVDR","FDA_QMSR","ISO13485"]){const db=await getDb();if(!db)throw new Error("Database unavailable");const documents=await Promise.allSettled([fetchFdaRecalls(),fetchNbogPublications(),fetchEudamedAlerts()]);const real=documents.flatMap(r=>r.status==="fulfilled"?r.value:[]);const jobs=referentials.flatMap(referential=>TOPICS.map(topic=>({referential,topic})));const results:Array<Record<string,unknown>>=[];const execute=async({referential,topic}:typeof jobs[number])=>{const started=Date.now();try{const [valid]=await db.select({id:sectorBriefings.id}).from(sectorBriefings).where(and(eq(sectorBriefings.topic,topic),eq(sectorBriefings.referential,referential),gt(sectorBriefings.validUntil,new Date()))).limit(1);if(valid)return{topic,referential,status:"cached"};const briefing=await generateSectorBriefing(topic,real,referential);await db.insert(sectorBriefings).values({id:randomUUID(),topic,referential,titre:briefing.titre,content:briefing,sourcesUsed:briefing.sourcesAnalysees,aiModel:"claude-sonnet-4-6",confidenceLevel:briefing.niveauConfiance,validUntil:new Date(Date.now()+7*86400000)});return{topic,referential,status:"generated",sources:briefing.sourcesAnalysees.length,durationMs:Date.now()-started};}catch(error){console.error("[Intelligence] briefing failed",{topic,referential,durationMs:Date.now()-started,error:error instanceof Error?error.message:String(error)});return{topic,referential,status:"failed"};}};let cursor=0;const workers=Array.from({length:Math.min(CONCURRENCY,jobs.length)},async()=>{while(cursor<jobs.length)results.push(await execute(jobs[cursor++]));});await Promise.all(workers);return results;}
