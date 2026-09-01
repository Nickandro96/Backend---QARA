import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { regulatoryUpdates } from "../../../../drizzle/schema";
import { SYSTEM_PROMPT, buildAnalysisPrompt } from "./analysisPrompt";
import { analyzeRegulatoryDocument } from "./anthropicClient";
export type QueueLogger={info:(d:unknown,m:string)=>void;warn:(d:unknown,m:string)=>void;error:(d:unknown,m:string)=>void};
export function isEligibleForAnalysis(item:{aiAnalyzed:boolean;rawContent:string|null}):boolean{return item.aiAnalyzed===false&&typeof item.rawContent==="string"&&item.rawContent.length>0;}
export async function runAnalysisQueue(db:any, logger:QueueLogger, analyze=analyzeRegulatoryDocument, delay=(ms:number)=>new Promise(r=>setTimeout(r,ms))) {
  // SQL invariant: ai_analyzed = false AND raw_content IS NOT NULL AND raw_content != ''
  const items=await db.select().from(regulatoryUpdates).where(and(eq(regulatoryUpdates.aiAnalyzed,false),isNotNull(regulatoryUpdates.rawContent),ne(regulatoryUpdates.rawContent,""))).orderBy(sql`FIELD(${regulatoryUpdates.impactLevel}, 'Critical','High','Medium','Low')`,desc(regulatoryUpdates.retrievedAt)).limit(20);
  let inputTokens=0,outputTokens=0,analyzed=0,skipped=0;
  for(const item of items){ if(!isEligibleForAnalysis({aiAnalyzed:Boolean(item.aiAnalyzed),rawContent:item.rawContent}))continue; const raw=String(item.rawContent??"");
    if(raw.length<50){await db.update(regulatoryUpdates).set({aiAnalyzed:true,aiModelVersion:"skipped:content_too_short",aiAnalysisDate:new Date()}).where(eq(regulatoryUpdates.id,item.id));logger.warn({id:item.id,source_id:item.sourceRegistryId},"raw_content too short — skipped");skipped++;continue;}
    try{const prompt=buildAnalysisPrompt({...item,rawContent:raw},logger);const out:any=await analyze(SYSTEM_PROMPT,prompt);inputTokens+=out.inputTokens;outputTokens+=out.outputTokens;
      if(out.result?.error==="insufficient_content"){await db.update(regulatoryUpdates).set({aiAnalyzed:true,aiModelVersion:"skipped:insufficient_content",aiAnalysisDate:new Date()}).where(eq(regulatoryUpdates.id,item.id));skipped++;continue;}
      await db.update(regulatoryUpdates).set({aiAnalyzed:true,aiAnalysisDate:new Date(),aiModelVersion:out.model,summaryFr:out.result.summary_fr,summaryEn:out.result.summary_en,referentialsImpacted:out.result.referentials_impacted,marketsImpacted:out.result.markets_impacted,rolesImpacted:out.result.roles_impacted,analysisCriticality:out.result.criticality,keyChanges:out.result.key_changes,actionRequired:out.result.action_required,dueDate:out.result.due_date?new Date(`${out.result.due_date}T00:00:00Z`):null}).where(eq(regulatoryUpdates.id,item.id));
      logger.info({id:item.id,input_tokens:out.inputTokens,output_tokens:out.outputTokens,model:out.model},"regulatory document analyzed");analyzed++;
    }catch(error:any){logger.error({id:item.id,error:error?.message,response:String(error?.response??"").slice(0,500)},"AI analysis failed; item will be retried");}
    await delay(500);
  }
  const estimatedCostUsd=inputTokens*3/1e6+outputTokens*15/1e6;logger.info({total_tokens:inputTokens+outputTokens,input_tokens:inputTokens,output_tokens:outputTokens,estimated_cost_usd:estimatedCostUsd},"AI analysis run completed");return{selected:items.length,analyzed,skipped,inputTokens,outputTokens,estimatedCostUsd};
}
