import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { mandatoryDocuments, userDocumentStatus } from "../drizzle/schema";
import { getAnthropicClient } from "./assistant/assistant-router";

const DOC_STATUS_VALUES = ["manquant", "a_mettre_a_jour", "conforme"] as const;

async function getStatusRow(db: any, userId: number, documentId: number) {
  const [row] = await db
    .select()
    .from(userDocumentStatus)
    .where(and(eq(userDocumentStatus.userId, userId), eq(userDocumentStatus.documentId, documentId)))
    .limit(1);
  return row ?? null;
}

async function getDocumentOrThrow(db: any, documentId: number) {
  const [doc] = await db.select().from(mandatoryDocuments).where(eq(mandatoryDocuments.id, documentId)).limit(1);
  if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable" });
  return doc;
}

export const documentsRouter = router({
  /**
   * Frontend expects: trpc.documents.getAll({referentialId?, processId?,
   * role?, status?}) (Documents.tsx) — `status` filtre ici le statut
   * PERSONNEL de l'utilisateur pour ce document (manquant/à mettre à
   * jour/conforme), pas le champ `mandatoryDocuments.status` (obligatoire/
   * conditionnel/attendu), cf. les valeurs du <Select> "Statut" sur la page.
   */
  getAll: protectedProcedure
    .input(
      z.object({
        referentialId: z.number().optional(),
        processId: z.number().optional(),
        role: z.string().optional(),
        status: z.enum(DOC_STATUS_VALUES).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [];
      if (input.referentialId !== undefined) conditions.push(eq(mandatoryDocuments.referentialId, input.referentialId));
      if (input.processId !== undefined) conditions.push(eq(mandatoryDocuments.processId, input.processId));
      if (input.role !== undefined) conditions.push(eq(mandatoryDocuments.role, input.role));

      const docs = await db
        .select()
        .from(mandatoryDocuments)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      if (input.status === undefined) return docs;

      const statusRows = await db.select().from(userDocumentStatus).where(eq(userDocumentStatus.userId, ctx.user.id));
      const statusByDocId = new Map(statusRows.map((r: any) => [r.documentId, r.status]));
      return docs.filter((d: any) => (statusByDocId.get(d.id) ?? "manquant") === input.status);
    }),

  /**
   * Frontend expects: trpc.documents.getById({documentId}) (Documents.tsx)
   */
  getById: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      return getDocumentOrThrow(db, input.documentId);
    }),

  /**
   * Frontend expects: trpc.documents.getStats({role?}) (Documents.tsx) —
   * {total, conforme, a_mettre_a_jour, manquant, percentage}.
   */
  getStats: protectedProcedure
    .input(z.object({ role: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const docs = await db
        .select({ id: mandatoryDocuments.id })
        .from(mandatoryDocuments)
        .where(input.role !== undefined ? eq(mandatoryDocuments.role, input.role) : undefined);

      const statusRows = await db.select().from(userDocumentStatus).where(eq(userDocumentStatus.userId, ctx.user.id));
      const statusByDocId = new Map(statusRows.map((r: any) => [r.documentId, r.status]));

      const total = docs.length;
      let conforme = 0;
      let a_mettre_a_jour = 0;
      let manquant = 0;

      for (const doc of docs) {
        const status = statusByDocId.get(doc.id) ?? "manquant";
        if (status === "conforme") conforme += 1;
        else if (status === "a_mettre_a_jour") a_mettre_a_jour += 1;
        else manquant += 1;
      }

      const percentage = total > 0 ? Math.round((conforme / total) * 1000) / 10 : 0;
      return { total, conforme, a_mettre_a_jour, manquant, percentage };
    }),

  /**
   * Frontend expects: trpc.documents.getUserStatus({documentId})
   * (Documents.tsx) — statut par défaut "manquant" si l'utilisateur n'a
   * jamais renseigné ce document.
   */
  getUserStatus: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const row = await getStatusRow(db, ctx.user.id, input.documentId);
      return row ?? { documentId: input.documentId, status: "manquant" as const, notes: null, fileUrl: null };
    }),

  /**
   * Frontend expects: trpc.documents.updateStatus({documentId, status})
   * (Documents.tsx) — upsert (un utilisateur peut changer son statut
   * plusieurs fois pour le même document).
   */
  updateStatus: protectedProcedure
    .input(z.object({ documentId: z.number(), status: z.enum(DOC_STATUS_VALUES) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await getDocumentOrThrow(db, input.documentId);
      const existing = await getStatusRow(db, ctx.user.id, input.documentId);

      if (existing) {
        await db
          .update(userDocumentStatus)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(userDocumentStatus.id, existing.id));
      } else {
        await db.insert(userDocumentStatus).values({
          userId: ctx.user.id,
          documentId: input.documentId,
          status: input.status,
        });
      }

      return { success: true };
    }),

  /**
   * Frontend expects: trpc.documents.explainDocument({documentId})
   * (Documents.tsx, DocumentAIPanel) — {explanation, idealStructure,
   * template, recommendations}. Utilise le client Anthropic déjà en place
   * pour l'assistant IA (server/assistant/assistant-router.ts) plutôt que
   * l'ancienne passerelle propriétaire (forge.manus.im) trouvée sur la
   * branche `main`, plus dans cet environnement. Dégrade proprement (pas de
   * crash) si ANTHROPIC_API_KEY n'est pas configurée.
   */
  explainDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const doc = await getDocumentOrThrow(db, input.documentId);

      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          explanation:
            "Assistant IA non configuré sur cet environnement (ANTHROPIC_API_KEY manquante). " +
            "Consultez les sections « Objectif », « Contenu minimum attendu » et « Attentes de l'auditeur » ci-dessus en attendant.",
          idealStructure: "",
          template: "",
          recommendations: [] as string[],
        };
      }

      const client = getAnthropicClient();
      const prompt =
        `Document obligatoire de conformité réglementaire (dispositifs médicaux) :\n` +
        `- Nom : ${doc.documentName}\n` +
        `- Référence : ${doc.reference ?? "N/A"}\n` +
        `- Objectif : ${doc.objective ?? "N/A"}\n` +
        `- Contenu minimum attendu : ${doc.minimumContent ?? "N/A"}\n` +
        `- Rôle concerné : ${doc.role ?? "N/A"}\n\n` +
        `Réponds STRICTEMENT en JSON avec les clés "explanation" (string, explication ` +
        `détaillée en 150-250 mots), "idealStructure" (string, structure recommandée sous ` +
        `forme de liste), "template" (string, modèle Markdown prêt à remplir) et ` +
        `"recommendations" (tableau de 3-5 chaînes courtes). Aucun texte hors JSON.`;

      const response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        system: "Tu es un expert en conformité réglementaire des dispositifs médicaux (MDR 2017/745, ISO 13485, ISO 9001).",
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = (response as any).content?.find((b: any) => b.type === "text");
      const raw = textBlock?.text ?? "{}";
      try {
        const parsed = JSON.parse(raw);
        return {
          explanation: String(parsed.explanation ?? ""),
          idealStructure: String(parsed.idealStructure ?? ""),
          template: String(parsed.template ?? ""),
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
        };
      } catch {
        return { explanation: raw, idealStructure: "", template: "", recommendations: [] as string[] };
      }
    }),

  /**
   * Frontend expects: trpc.documents.checkCoherence({documentId})
   * (Documents.tsx, DocumentAIPanel) — retourne directement une chaîne
   * (voir usage `{coherenceCheck}` sans `.something`), `undefined` si l'IA
   * n'est pas configurée pour que la section reste simplement masquée
   * plutôt que de planter.
   */
  checkCoherence: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const doc = await getDocumentOrThrow(db, input.documentId);

      if (!process.env.ANTHROPIC_API_KEY) return undefined;

      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 512,
        system: "Tu es un expert en conformité réglementaire des dispositifs médicaux (MDR 2017/745, ISO 13485, ISO 9001).",
        messages: [
          {
            role: "user",
            content:
              `Pour le document obligatoire "${doc.documentName}" (objectif : ${doc.objective ?? "N/A"}), ` +
              `liste en 3-5 lignes les documents connexes à vérifier pour la cohérence documentaire et les ` +
              `principaux risques d'incohérence. Réponds en texte simple, pas de JSON.`,
          },
        ],
      });
      const textBlock = (response as any).content?.find((b: any) => b.type === "text");
      return textBlock?.text as string | undefined;
    }),
});
