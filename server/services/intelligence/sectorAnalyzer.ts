import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { RealDocument, SectorTopic } from "./types";

export const REQUIRED_WARNING = "Cette analyse est générée automatiquement à partir de documents officiels publics. Elle ne remplace pas l'avis d'un expert réglementaire qualifié. Vérifiez les sources avant toute décision.";
export const SectorBriefingSchema = z.object({
  titre:z.string().max(200), resume:z.string().max(500),
  pointsCles:z.array(z.object({titre:z.string(),description:z.string(),impact:z.enum(["eleve","moyen","faible"]),referentielsImpactes:z.array(z.string()),source:z.string()})).max(5),
  tendances:z.array(z.object({description:z.string(),signal:z.enum(["fort","modere","faible"]),horizon:z.enum(["immediat","court_terme","moyen_terme"]),source:z.string()})).max(3),
  actionsRecommandees:z.array(z.object({action:z.string(),priorite:z.enum(["haute","moyenne","faible"]),referentiel:z.string(),echeance:z.string().nullable()})).max(5),
  niveauConfiance:z.enum(["eleve","moyen","faible"]), sourcesAnalysees:z.array(z.string()).min(1), dateAnalyse:z.string(), periodeCouverte:z.string(), avertissement:z.literal(REQUIRED_WARNING),
});
export type SectorBriefing=z.infer<typeof SectorBriefingSchema>;
export const SECTOR_SYSTEM_PROMPT=`Tu es un expert en management de la qualité pour dispositifs médicaux avec 20 ans d'expérience en audits ISO 13485 et MDR. Tu analyses UNIQUEMENT les documents fournis. Tu n'inventes JAMAIS une statistique, une tendance ou un fait absent des documents. Si les données sont insuffisantes, indique-le explicitement. Le niveau de confiance est toujours déclaré. Réponds uniquement en JSON valide.`;
export function buildSectorPrompt(topic:SectorTopic,documents:RealDocument[],referential:string){return `SUJET: ${topic}\nRÉFÉRENTIEL: ${referential}\nDOCUMENTS RÉELS:\n${documents.slice(0,20).map((d,i)=>`[${i+1}] ${d.source} | ${d.title} | ${d.url} | ${d.publishedAt??"date inconnue"}\n${d.content.slice(0,2500)}`).join("\n\n")}\n\nToute affirmation doit citer exactement une source fournie. Avertissement obligatoire: ${REQUIRED_WARNING}`;}
export async function generateSectorBriefing(topic:SectorTopic,documents:RealDocument[],referential:string,client?:Pick<Anthropic,"messages">):Promise<SectorBriefing>{
  if(!documents.length) throw new Error("Aucun document réel à analyser");
  const anthropic=client??new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:120000});
  const response=await anthropic.messages.create({model:"claude-sonnet-4-6",max_tokens:3000,temperature:0,system:SECTOR_SYSTEM_PROMPT,messages:[{role:"user",content:buildSectorPrompt(topic,documents,referential)}],output_config:{format:zodOutputFormat(SectorBriefingSchema)}} as any);
  const text=response.content.find((b:any)=>b.type==="text"); if(!text||text.type!=="text") throw new Error("Réponse IA sectorielle vide");
  const parsed=SectorBriefingSchema.parse(JSON.parse(text.text));
  if(documents.length<2 && parsed.niveauConfiance!=="faible") throw new Error("Une source unique impose un niveau de confiance faible");
  const allowed=new Set(documents.flatMap(d=>[d.source,d.title,d.id]));
  for(const source of parsed.sourcesAnalysees) if(!allowed.has(source)) throw new Error(`Source IA non fournie: ${source}`);
  return parsed;
}
