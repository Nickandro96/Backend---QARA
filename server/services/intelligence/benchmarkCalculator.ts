import { and, eq, gte, inArray } from "drizzle-orm";
import { audit_responses, questions } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { classifyNonConformityResponse } from "../../capa/capaEngine";

export type BenchmarkRow = { userId: number; responseValue: string | null };
export type SectorBenchmark = { available: boolean; cohortSize: number; minimumCohortSize: number; userNcRate: number | null; cohortMedianNcRate: number | null; percentile: number | null; message: string };
const median=(values:number[])=>{const ordered=[...values].sort((a,b)=>a-b);const middle=Math.floor(ordered.length/2);return ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;};

export function calculateAnonymousBenchmark(rows:BenchmarkRow[],currentUserId:number,minimumCohortSize=10):SectorBenchmark{
 const grouped=new Map<number,BenchmarkRow[]>();for(const row of rows)grouped.set(row.userId,[...(grouped.get(row.userId)??[]),row]);
 const rates=[...grouped.entries()].filter(([,items])=>items.length>=10).map(([userId,items])=>({userId,rate:Math.round(items.filter(item=>classifyNonConformityResponse(item.responseValue??"")).length/items.length*1000)/10}));
 if(rates.length<minimumCohortSize)return{available:false,cohortSize:rates.length,minimumCohortSize,userNcRate:null,cohortMedianNcRate:null,percentile:null,message:`Benchmark indisponible : cohorte anonymisée inférieure à ${minimumCohortSize} organisations.`};
 const own=rates.find(item=>item.userId===currentUserId);const cohort=rates.filter(item=>item.userId!==currentUserId);
 if(!own||cohort.length<minimumCohortSize)return{available:false,cohortSize:cohort.length,minimumCohortSize,userNcRate:null,cohortMedianNcRate:null,percentile:null,message:"Benchmark indisponible : données propres ou cohorte comparée insuffisantes."};
 return{available:true,cohortSize:cohort.length,minimumCohortSize,userNcRate:own.rate,cohortMedianNcRate:Math.round(median(cohort.map(item=>item.rate))*10)/10,percentile:Math.round(cohort.filter(item=>item.rate<=own.rate).length/cohort.length*100),message:"Comparaison anonymisée. Une organisation n'est jamais identifiable dans les résultats."};
}
export async function calculateSectorBenchmark(currentUserId:number,referentialId:number,periodDays=365){const db=await getDb();if(!db)throw new Error("Database unavailable");const questionRows=await db.select({questionKey:questions.questionKey}).from(questions).where(eq(questions.referentialId,referentialId));const keys=questionRows.flatMap(row=>row.questionKey?[row.questionKey]:[]);if(!keys.length)return calculateAnonymousBenchmark([],currentUserId);const rows=await db.select({userId:audit_responses.userId,responseValue:audit_responses.responseValue}).from(audit_responses).where(and(gte(audit_responses.createdAt,new Date(Date.now()-periodDays*86400000)),inArray(audit_responses.questionKey,keys)));return calculateAnonymousBenchmark(rows,currentUserId);}
