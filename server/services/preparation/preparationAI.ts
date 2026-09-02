import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const PREPARATION_WARNING = "Ce plan est généré par IA à partir des seules données QARA fournies. Il doit être validé par le responsable qualité et ne garantit pas l'issue de l'audit.";
export const SIMULATION_WARNING = "Ces questions sont générées par IA à titre indicatif. Elles ne reproduisent pas exactement les questions d'un auditeur réel.";
export const PreparationPlanSchema = z.object({
  semainesRestantes: z.number(), niveauRisque: z.enum(["faible","modere","eleve","critique"]), raisonNiveauRisque: z.string(),
  pointsForce: z.array(z.object({ processus:z.string(), description:z.string(), preuveDisponible:z.boolean() })).max(5),
  pointsVigilance: z.array(z.object({ processus:z.string(), description:z.string(), priorite:z.enum(["critique","haute","moyenne"]), lienNC:z.string().nullable(), actionRequise:z.string(), delai:z.string() })).max(10),
  documentsAVerifier: z.array(z.object({ document:z.string(), exigence:z.string(), statut:z.enum(["a_verifier","critique","ok"]) })).max(20),
  simulationQuestionsAuditeur: z.array(z.object({ question:z.string(), contexte:z.string(), processus:z.string(), typique:z.boolean(), reponseOrientee:z.string() })).max(10),
  calendrierPreparation: z.array(z.object({ semaine:z.string(), actions:z.array(z.string()), priorite:z.enum(["critique","haute","normale"]) })),
  niveauConfiance: z.enum(["eleve","moyen","faible"]), avertissement: z.string().min(1),
});
export const AuditorQuestionsSchema = z.object({ questions:z.array(z.object({ question:z.string(), contexte:z.string(), orientationReponse:z.string(), preuvesAttendues:z.array(z.string()), criticite:z.enum(["critique","haute","moyenne"]) })).min(3).max(10), avertissement:z.literal(SIMULATION_WARNING) });
export const AnswerEvaluationSchema = z.object({ score:z.number().int().min(0).max(100), feedback:z.string(), pointsManquants:z.array(z.string()) });
export type PreparationPlan=z.infer<typeof PreparationPlanSchema>;
export const PREPARATION_SYSTEM_PROMPT=`Tu es un expert en préparation d'audits de certification DM avec 20 ans d'expérience en BSI, TÜV, SGS et FDA. Tu analyses UNIQUEMENT les données fournies de l'organisation. Tu n'inventes JAMAIS une exigence ou un document requis qui ne soit pas dans les référentiels applicables. Tu génères un plan de préparation ACTIONNABLE et PRIORISÉ. Format : JSON valide uniquement.`;

async function structured<T>(schema:any, prompt:string, client?:Pick<Anthropic,"messages">):Promise<T>{
  const sdk=client??new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:180000});
  const response:any=await sdk.messages.create({model:"claude-sonnet-4-6",max_tokens:5000,temperature:0,system:PREPARATION_SYSTEM_PROMPT,messages:[{role:"user",content:prompt}],output_config:{format:zodOutputFormat(schema)}});
  const raw=(response.content??[]).filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("").replace(/^```(?:json)?\s*|\s*```$/g,"").trim();
  return schema.parse(JSON.parse(raw));
}
export async function generatePreparationPlanAI(context:unknown,client?:Pick<Anthropic,"messages">){return structured<PreparationPlan>(PreparationPlanSchema,`Données réelles de l'organisation :\n${JSON.stringify(context)}\nL'avertissement doit être non vide et explicite.`,client);}
export async function generateAuditorQuestionsAI(context:unknown,client?:Pick<Anthropic,"messages">){return structured<z.infer<typeof AuditorQuestionsSchema>>(AuditorQuestionsSchema,`Génère au moins 3 questions d'auditeur fondées uniquement sur ces données :\n${JSON.stringify(context)}\nAvertissement exact obligatoire : ${SIMULATION_WARNING}`,client);}
export async function evaluateAuditorAnswerAI(context:unknown,client?:Pick<Anthropic,"messages">){return structured<z.infer<typeof AnswerEvaluationSchema>>(AnswerEvaluationSchema,`Évalue factuellement la réponse sans inventer de preuve :\n${JSON.stringify(context)}`,client);}
