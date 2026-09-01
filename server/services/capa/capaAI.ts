import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const CapaAIActionSchema = z.object({
  id: z.string().min(1).max(20),
  titre: z.string().min(3).max(300),
  description: z.string().min(10).max(3000),
  exigenceReglementaire: z.string().min(1).max(500),
  delaiSuggeree: z.enum(["30 jours", "60 jours", "90 jours"]),
  indicateurEfficacite: z.string().min(5).max(1000),
  complexite: z.enum(["faible", "moyenne", "elevee"]),
  priorite: z.enum(["immediate", "court_terme", "moyen_terme"]),
});

const PourquoiSchema = z.object({ question: z.string().min(3).max(1000), reponse: z.string().min(1).max(2000) });

export const CapaAIResultSchema = z.object({
  contexteSituation: z.string().min(10).max(3000),
  nonConformiteIdentifiee: z.string().min(10).max(2000),
  analyse5Pourquoi: z.object({
    pourquoi1: PourquoiSchema,
    pourquoi2: PourquoiSchema,
    pourquoi3: PourquoiSchema,
    pourquoi4: PourquoiSchema,
    pourquoi5: PourquoiSchema,
    causeRacineIdentifiee: z.string().min(1).max(2000),
  }),
  correctionImmediate: z.string().min(3).max(2000),
  actionsCorrectivesProposees: z.array(CapaAIActionSchema).min(3).max(5),
  pointsVigilance: z.array(z.string().min(3).max(1000)).min(2).max(3),
  referenceReglementaire: z.string().min(1).max(500),
  niveauConfiance: z.enum(["eleve", "moyen", "faible"]),
  raisonNiveauConfiance: z.string().min(3).max(1000),
});

export type CapaAIResult = z.infer<typeof CapaAIResultSchema>;
export type NonConformite = {
  questionText: string; questionKey: string; criticality: string; processSlug: string | null;
  referentialCode: string; articleReference: string | null; responseValue: "non_conforme" | "partiel";
  responseComment: string | null; objectiveEvidence: string | null;
};
export type AuditContext = { organisationName: string | null; economicRole: string | null; referentialCode: string; processName: string | null };

export function serializeSelectedActions(actions: Array<z.infer<typeof CapaAIActionSchema>>) {
  return {
    selectedActionIds: actions.map((action) => action.id),
    actionRetenue: actions.map((action) => `${action.titre} — ${action.description}`).join("\n\n"),
  };
}

export const CAPA_SYSTEM_PROMPT = `Tu es un expert en systèmes de management de la qualité pour dispositifs médicaux, spécialisé en ISO 13485, MDR 2017/745, FDA QMSR et méthodes CAPA (8D, 5 Pourquoi, Ishikawa, FMEA).
Tu analyses UNIQUEMENT les données fournies.
Tu n'inventes JAMAIS une non-conformité, une cause ou une action qui n'est pas suggérée par les données de l'audit.
Si les données sont insuffisantes pour une analyse complète, tu l'indiques explicitement dans les réponses concernées et tu fixes niveauConfiance à faible.
Tu réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`;

export function buildCapaPrompt(nc: NonConformite, context: AuditContext) {
  const questionText = nc.questionText.slice(0, 500);
  const auditorObservation = nc.responseComment?.trim()
    ? nc.responseComment.trim().slice(0, 300)
    : "Aucun commentaire d'auditeur disponible — baser l'analyse uniquement sur l'exigence réglementaire et fixer niveauConfiance à 'faible'.";
  return `CONTEXTE ORGANISATION\nOrganisation : ${context.organisationName ?? "Non renseignée"}\nRôle économique : ${context.economicRole ?? "Non renseigné"}\nRéférentiel : ${context.referentialCode}\nProcessus : ${context.processName ?? nc.processSlug ?? "Non renseigné"}\n\nNON-CONFORMITÉ RÉELLE\nQuestion : ${questionText}\nArticle/Clause : ${nc.articleReference ?? "Non renseigné"}\nCriticité : ${nc.criticality}\nRéponse : ${nc.responseValue}\nConstat de l'auditeur : ${auditorObservation}\nPreuves objectives : ${nc.objectiveEvidence ?? "Non fournies"}\n\nProduis une analyse CAPA en JSON avec les champs exacts définis : contexteSituation, nonConformiteIdentifiee, analyse5Pourquoi (pourquoi1 à pourquoi5 et causeRacineIdentifiee), correctionImmediate, actionsCorrectivesProposees (3 à 5 actions), pointsVigilance, referenceReglementaire, niveauConfiance, raisonNiveauConfiance. Ne transforme jamais une hypothèse en fait.`;
}

export async function generateCapaAnalysis(
  nc: NonConformite,
  auditContext: AuditContext,
  client?: Pick<Anthropic, "messages">
): Promise<CapaAIResult | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!client && !apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const sdk = client ?? new Anthropic({ apiKey, timeout: 120_000 });
    const response: any = await sdk.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 4000, temperature: 0,
      system: CAPA_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCapaPrompt(nc, auditContext) }],
      output_config: { format: zodOutputFormat(CapaAIResultSchema) },
    });
    if (response.stop_reason === "max_tokens") {
      console.error("[CAPA AI] Response truncated at max_tokens", { maxTokens: 4000 });
      return null;
    }
    const raw = (response.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
      .replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const validated = CapaAIResultSchema.safeParse(JSON.parse(raw));
    if (!validated.success) {
      console.error("[CAPA AI] Invalid response", validated.error.issues);
      return null;
    }
    return validated.data;
  } catch (error) {
    console.error("[CAPA AI] Generation failed", error);
    return null;
  }
}
