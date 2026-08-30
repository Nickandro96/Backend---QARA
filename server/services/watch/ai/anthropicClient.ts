import Anthropic from "@anthropic-ai/sdk";
import { AnalysisResultSchema } from "./analysisPrompt";
export const WATCH_AI_MODEL = "claude-sonnet-4-6";
export async function analyzeRegulatoryDocument(system:string, prompt:string, client?:Anthropic) {
  const apiKey=process.env.ANTHROPIC_API_KEY; if(!client&&!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const sdk=client ?? new Anthropic({apiKey, timeout:30000});
  const response:any=await sdk.messages.create({model:WATCH_AI_MODEL,max_tokens:1000,temperature:0,system,messages:[{role:"user",content:prompt}]});
  const text=(response.content??[]).filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("").replace(/^```(?:json)?\s*|\s*```$/g,"").trim();
  const parsed=JSON.parse(text); if(parsed?.error==="insufficient_content") return {result:parsed,inputTokens:response.usage?.input_tokens??0,outputTokens:response.usage?.output_tokens??0,model:response.model??WATCH_AI_MODEL};
  return {result:AnalysisResultSchema.parse(parsed),inputTokens:response.usage?.input_tokens??0,outputTokens:response.usage?.output_tokens??0,model:response.model??WATCH_AI_MODEL};
}
