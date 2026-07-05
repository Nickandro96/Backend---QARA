import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Anthropic from "@anthropic-ai/sdk";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { loadAuditScoringContext } from "../scoring/scoringRouter";
import { buildScoringResult } from "../scoring/scoringEngine";
import { sortByPriority } from "../capa/capaEngine";
import { buildAuditorModeSystemPrompt, buildUserModeSystemPrompt } from "./promptBuilder";
import type { AuditorGapContext, ConformityCriteria, QuestionAssistantContext } from "./types";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_GAPS_IN_CONTEXT = 15;

const chatMessageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

/**
 * Garde-fou de coût / anti-boucle (§ "Intégration technique" de la spec) :
 * ne conserve que les N derniers tours de conversation. Le client garde son
 * historique complet pour l'affichage ; seul ce qui est envoyé au modèle est
 * tronqué.
 */
function capHistory(messages: z.infer<typeof chatMessageInput>[]): z.infer<typeof chatMessageInput>[] {
  return messages.slice(-MAX_HISTORY_MESSAGES);
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY manquante).",
    });
  }
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

async function callAssistant(systemPrompt: string, messages: z.infer<typeof chatMessageInput>[]): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: capHistory(messages).map((m) => ({ role: m.role, content: m.content })),
  });
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Réponse de l'assistant vide ou inattendue." });
  }
  return textBlock.text;
}

export const assistantRouter = router({
  /**
   * Mode UTILISATEUR — "aide-moi à répondre". Contexte strictement limité à
   * UNE question de l'audit courant (vérifiée dans son périmètre référentiel)
   * et ses champs riches du corpus — voir docs/audit/13-ia-reglementaire.md.
   */
  assistantUser: protectedProcedure
    .input(
      z.object({
        auditId: z.number().int().positive(),
        questionKey: z.string().min(1),
        messages: z.array(chatMessageInput).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { scoringQuestions, questionRows } = await loadAuditScoringContext(db, input.auditId, ctx.user.id);
      const row = questionRows.find((q) => q.questionKey === input.questionKey);
      const scoped = scoringQuestions.find((q) => q.questionKey === input.questionKey);
      if (!row || !scoped) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question introuvable dans le périmètre de cet audit.",
        });
      }

      const questionContext: QuestionAssistantContext = {
        questionKey: row.questionKey!,
        referentialCode: scoped.referentialCode,
        processName: scoped.processName,
        questionText: row.questionText ?? "",
        criticality: (row.criticality as QuestionAssistantContext["criticality"]) ?? "medium",
        article: row.article ?? null,
        annexe: row.annexe ?? null,
        officialSource: row.officialSource ?? null,
        referenceStatus: row.referenceStatus ?? null,
        auditVerifies: row.auditVerifies ?? null,
        expectedEvidence: row.expectedEvidence ?? null,
        explanationSimple: row.explanationSimple ?? null,
        concreteExample: row.concreteExample ?? null,
        conformityCriteria: safeJsonParse<ConformityCriteria | null>(row.conformityCriteria, null),
        typicalNc: safeJsonParse<string[]>(row.typicalNc, []),
      };

      const systemPrompt = buildUserModeSystemPrompt(questionContext);
      const reply = await callAssistant(systemPrompt, input.messages);
      return { reply };
    }),

  /**
   * Mode AUDITEUR — "analyse mes résultats". Contexte = résumé chiffré du
   * scoring + écarts priorisés (recalculés côté serveur, jamais fournis par
   * le client) — voir docs/audit/13-ia-reglementaire.md.
   */
  assistantAuditor: protectedProcedure
    .input(
      z.object({
        auditId: z.number().int().positive(),
        messages: z.array(chatMessageInput).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { scoringQuestions, scoringResponses, questionRows } = await loadAuditScoringContext(
        db,
        input.auditId,
        ctx.user.id
      );
      const questionByKey = new Map(questionRows.map((q) => [q.questionKey, q]));
      const scoringResult = buildScoringResult(scoringQuestions, scoringResponses);
      const coverageByKey = new Map(scoringResult.couvertureCroisee.map((c) => [c.questionKey, c.referentielsCouverts]));

      const gaps: AuditorGapContext[] = sortByPriority(scoringResult.ecarts)
        .slice(0, MAX_GAPS_IN_CONTEXT)
        .map((e) => {
          const q = questionByKey.get(e.questionKey);
          return {
            questionKey: e.questionKey,
            referentialCode: e.referentialCode,
            processName: e.processName,
            gravite: e.gravite,
            criticality: e.criticality,
            responseValue: e.responseValue,
            typicalNc: e.typicalNc,
            article: q?.article ?? null,
            officialSource: q?.officialSource ?? null,
            auditVerifies: q?.auditVerifies ?? null,
            expectedEvidence: q?.expectedEvidence ?? null,
            aiPrompt: q?.aiPrompt ?? null,
            referentielsImpactes: coverageByKey.get(e.questionKey) ?? [],
          };
        });

      const summary = {
        scoreGlobal: scoringResult.global.score,
        statutGlobal: scoringResult.global.statut,
        scoresParReferentiel: scoringResult.parReferentiel.map((r) => ({
          referentialCode: r.referentialCode,
          score: r.score,
          statut: r.statut,
        })),
        ecartsCritiques: scoringResult.global.ecartsCritiques,
        ecarts: scoringResult.global.ecarts,
      };

      const systemPrompt = buildAuditorModeSystemPrompt(summary, gaps);
      const reply = await callAssistant(systemPrompt, input.messages);
      return { reply };
    }),
});
