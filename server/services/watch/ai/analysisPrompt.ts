import { z } from "zod";

export const SYSTEM_PROMPT = `Tu es un analyste réglementaire spécialisé en dispositifs médicaux.
Tu analyses UNIQUEMENT le document fourni ci-dessous.
Tu n'utilises JAMAIS ta mémoire pour compléter des informations absentes du document.
Tu n'inventes JAMAIS une date, une référence, une exigence ou une action.
Si le document ne mentionne pas d'échéance, due_date = null.
Si tu n'es pas certain de l'impact sur un référentiel, ne l'inclus pas.
Si le contenu est insuffisant pour analyser, retourner {"error":"insufficient_content"} et rien d'autre.
Tu réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans bloc markdown, sans explication.`;

export const AnalysisResultSchema = z.object({
  summary_fr: z.string().min(10).max(2000), summary_en: z.string().min(10).max(2000),
  referentials_impacted: z.array(z.enum(["MDR","IVDR","FDA_QMSR","MDSAP","ISO13485","ISO14971","ISO9001"])).max(7),
  markets_impacted: z.array(z.enum(["EU","USA","UK","CA","AU","BR","JP","CH"])).max(8),
  roles_impacted: z.array(z.enum(["fabricant","importateur","distributeur","mandataire"])).max(4),
  criticality: z.enum(["informational","watch","action_required"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  key_changes: z.array(z.string().max(500)).max(5), action_required: z.string().max(1000).nullable(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export type PromptLogger = { info: (data: unknown, message: string) => void };
export function buildAnalysisPrompt(item: { id:string; sourceName:string; officialId:string|null; publishedAt:Date|null; sourceUrl:string; rawContent:string }, logger: PromptLogger) {
  const originalLength = item.rawContent.length; let content = item.rawContent;
  if (originalLength > 24000) { content = `${content.slice(0,24000)}\n[CONTENU TRONQUÉ — document complet disponible à : ${item.sourceUrl}]`; logger.info({ id:item.id, originalLength, truncatedLength:24000 }, "raw_content truncated for AI analysis"); }
  return `MÉTADONNÉES\nsource : ${item.sourceName}\nidentifiant officiel : ${item.officialId ?? "non renseigné"}\ndate de publication : ${item.publishedAt?.toISOString() ?? "non renseignée"}\nURL source : ${item.sourceUrl}\n\nCONTENU DU DOCUMENT :\n${content}\n\nAnalyser ce document et retourner un JSON avec ces champs exacts : {"summary_fr":"string, 3-5 phrases en français","summary_en":"string, 3-5 phrases en anglais","referentials_impacted":[],"markets_impacted":[],"roles_impacted":[],"criticality":"informational|watch|action_required","due_date":null,"key_changes":[],"action_required":null}`;
}
