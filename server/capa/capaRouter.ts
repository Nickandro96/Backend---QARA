import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { audits, audit_responses, capa_actions, capa_action_history, questions, referentiels, regulatoryUpdates } from "../../drizzle/schema";
import { buildScoringResult } from "../scoring/scoringEngine";
import { loadAuditScoringContext } from "../scoring/scoringRouter";
import { buildActionDraft, isValidStatusTransition, sortByPriority, validateTransitionFields } from "./capaEngine";
import type { CapaAction, CapaReferentielImpacte, CapaStatus } from "./types";
import { CapaAIActionSchema, CapaAIResultSchema, generateCapaAnalysis, serializeSelectedActions } from "../services/capa/capaAI";

const CapaStatusEnum = z.enum([
  "ouverte",
  "en_cours",
  "a_verifier",
  "cloturee_efficace",
  "cloturee_inefficace",
  "cloturee_sans_suite",
]);

function toCapaAction(row: typeof capa_actions.$inferSelect): CapaAction {
  return {
    id: row.id,
    auditId: row.auditId,
    questionKey: row.questionKey,
    referentialCode: row.referentialCode,
    processName: row.processName,
    gravite: row.gravite as CapaAction["gravite"],
    criticality: row.criticality as CapaAction["criticality"],
    ecartIdentifie: row.ecartIdentifie,
    analyseCauseRacine: row.analyseCauseRacine,
    actionRecommandee: row.actionRecommandee,
    actionRetenue: row.actionRetenue,
    responsible: row.responsible,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    statut: row.statut as CapaStatus,
    preuveRealisation: row.preuveRealisation,
    dateVerificationEfficacite: row.dateVerificationEfficacite
      ? row.dateVerificationEfficacite.toISOString()
      : null,
    preuveEfficacite: row.preuveEfficacite,
    resultatEfficacite: row.resultatEfficacite as CapaAction["resultatEfficacite"],
    rootCauseMethod: (row as any).rootCauseMethod ?? null,
    mdsapGrade: (row as any).mdsapGrade ?? null,
    mdsapEscalation: (row as any).mdsapEscalation ?? null,
    referentielsImpactes: safeJsonParse<CapaReferentielImpacte[]>(row.referentielsImpactes, []),
    priorite: 0, // recalculé après tri, voir sortByPriority ci-dessous
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertAuditOwnership(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, auditId: number, userId: number) {
  const [audit] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);
  if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });
}

async function recordHistory(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  actionId: number,
  userId: number,
  changes: Array<{ champ: string; ancienneValeur: string | null; nouvelleValeur: string | null }>
) {
  const rows = changes
    .filter((c) => c.ancienneValeur !== c.nouvelleValeur)
    .map((c) => ({ actionId, userId, champ: c.champ, ancienneValeur: c.ancienneValeur, nouvelleValeur: c.nouvelleValeur }));
  if (rows.length === 0) return;
  await db.insert(capa_action_history).values(rows);
}

export const capaRouter = router({
  createFromWatchItem: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive(), watchItemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await assertAuditOwnership(db, input.auditId, ctx.user.id);
      const [item] = await db.select().from(regulatoryUpdates).where(eq(regulatoryUpdates.id, input.watchItemId)).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Alerte réglementaire introuvable" });
      const questionKey = `watch:${item.id}`;
      await db.insert(capa_actions).values({
        userId: ctx.user.id,
        auditId: input.auditId,
        questionKey,
        referentialCode: ((item.referentialsImpacted as string[] | null)?.[0] ?? item.jurisdiction),
        processName: "Veille réglementaire",
        gravite: item.impactLevel === "Critical" || item.impactLevel === "High" ? "majeur" : "mineur",
        criticality: item.impactLevel.toLowerCase(),
        ecartIdentifie: item.summaryFr || item.summaryLong || item.title,
        actionRecommandee: item.actionRequired || (item.recommendedActions as Array<{ title?: string }> | null)?.[0]?.title || "Évaluer l'impact réglementaire et définir les mesures applicables",
        watchItemId: item.id,
        source: "veille_reglementaire",
      }).onDuplicateKeyUpdate({ set: { watchItemId: item.id, source: "veille_reglementaire" } });
      const [created] = await db.select().from(capa_actions).where(and(eq(capa_actions.userId, ctx.user.id), eq(capa_actions.auditId, input.auditId), eq(capa_actions.questionKey, questionKey))).limit(1);
      return created;
    }),
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const actionRows = await db.select().from(capa_actions).where(eq(capa_actions.userId, ctx.user.id));
    const auditRows = await db.select({ id: audits.id, name: audits.name }).from(audits).where(eq(audits.userId, ctx.user.id));
    const auditNameById = new Map(auditRows.map((a) => [a.id, a.name]));
    const responseRows = await db.select().from(audit_responses).where(eq(audit_responses.userId, ctx.user.id));
    const questionRows = await db.select().from(questions);
    const questionByKey = new Map(questionRows.map((q) => [q.questionKey, q]));
    const actionKeys = new Set(actionRows.map((a) => `${a.auditId}:${a.questionKey}`));
    const auditIds = new Set(auditRows.map((a) => a.id));
    const unplanned = responseRows.flatMap((r) => {
      const value = String(r.responseValue ?? "").toLowerCase().replace(/[ -]/g, "_");
      if (!auditIds.has(r.auditId) || (!value.includes("non") && !value.includes("part")) || actionKeys.has(`${r.auditId}:${r.questionKey}`)) return [];
      const q = questionByKey.get(r.questionKey);
      return [{ auditId: r.auditId, auditName: auditNameById.get(r.auditId) ?? `Audit ${r.auditId}`, questionKey: r.questionKey, questionText: q?.questionText ?? q?.title ?? r.questionKey, criticality: q?.criticality ?? "medium", processName: q?.processDetail ?? null, articleReference: [q?.article, q?.annexe].filter(Boolean).join(" / ") || null, responseComment: r.responseComment, objectiveEvidence: r.note }];
    });
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rawById = new Map(actionRows.map((row) => [row.id, row]));
    const watchIds = actionRows.flatMap((row) => row.watchItemId ? [row.watchItemId] : []);
    const watchRows = watchIds.length ? await db.select({ id: regulatoryUpdates.id, title: regulatoryUpdates.title, sourceName: regulatoryUpdates.sourceName, sourceUrl: regulatoryUpdates.sourceUrl }).from(regulatoryUpdates) : [];
    const watchById = new Map(watchRows.filter((row) => watchIds.includes(row.id)).map((row) => [row.id, row]));
    const actions = sortByPriority(actionRows.map(toCapaAction)).map((a) => {
      const raw = rawById.get(a.id)!;
      return { ...a, auditName: auditNameById.get(a.auditId) ?? `Audit ${a.auditId}`, source: raw.source, watchItemId: raw.watchItemId, watchItem: raw.watchItemId ? watchById.get(raw.watchItemId) ?? null : null };
    });
    return {
      stats: {
        ncOuvertes: unplanned.length,
        enCours: actionRows.filter((a) => ["ouverte", "en_cours", "a_verifier"].includes(a.statut)).length,
        enRetard: actionRows.filter((a) => a.dueDate && a.dueDate < now && !a.statut.startsWith("cloturee")).length,
        clotureesCeMois: actionRows.filter((a) => a.statut.startsWith("cloturee") && a.updatedAt >= monthStart).length,
      },
      unplanned,
      actions,
    };
  }),

  generateAnalysis: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive(), questionKey: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [audit] = await db.select().from(audits).where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id))).limit(1);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });
      const [response] = await db.select().from(audit_responses).where(and(eq(audit_responses.auditId, input.auditId), eq(audit_responses.userId, ctx.user.id), eq(audit_responses.questionKey, input.questionKey))).limit(1);
      if (!response) throw new TRPCError({ code: "NOT_FOUND", message: "Réponse d'audit introuvable" });
      const normalized = String(response.responseValue ?? "").toLowerCase().replace(/[ -]/g, "_");
      const responseValue = normalized.includes("part") ? "partiel" : normalized.includes("non") ? "non_conforme" : null;
      if (!responseValue) throw new TRPCError({ code: "BAD_REQUEST", message: "Cette réponse n'est pas une non-conformité ou une réponse partielle" });
      const [question] = await db.select().from(questions).where(eq(questions.questionKey, input.questionKey)).limit(1);
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question introuvable" });
      const [ref] = question.referentialId ? await db.select().from(referentiels).where(eq(referentiels.id, question.referentialId)).limit(1) : [];
      const referentialCode = ref?.code ?? audit.type ?? "Non renseigné";
      const evidence = Array.isArray(response.evidenceFiles) && response.evidenceFiles.length ? JSON.stringify(response.evidenceFiles) : response.note;
      const result = await generateCapaAnalysis({
        questionText: question.questionText ?? question.title ?? input.questionKey,
        questionKey: input.questionKey,
        criticality: question.criticality ?? "medium",
        processSlug: question.processDetail ?? null,
        referentialCode,
        articleReference: [question.article, question.annexe].filter(Boolean).join(" / ") || null,
        responseValue,
        responseComment: response.responseComment,
        objectiveEvidence: evidence ?? null,
      }, {
        organisationName: audit.clientOrganization,
        economicRole: audit.economicRole,
        referentialCode,
        processName: question.processDetail ?? null,
      });
      if (!result) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "L'analyse IA n'a pas produit une réponse validée. Aucune donnée n'a été enregistrée." });
      return { analysis: result, context: { questionText: question.questionText, articleReference: [question.article, question.annexe].filter(Boolean).join(" / ") || null, criticality: question.criticality, responseComment: response.responseComment, objectiveEvidence: evidence ?? null } };
    }),

  saveAnalysis: protectedProcedure
    .input(z.object({
      auditId: z.number().int().positive(), questionKey: z.string().min(1),
      analysis: CapaAIResultSchema,
      selectedActions: z.array(CapaAIActionSchema).min(1).max(5),
      responsible: z.string().max(255).optional(), dueDate: z.string().datetime().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await assertAuditOwnership(db, input.auditId, ctx.user.id);
      const [existing] = await db.select().from(capa_actions).where(and(eq(capa_actions.auditId, input.auditId), eq(capa_actions.userId, ctx.user.id), eq(capa_actions.questionKey, input.questionKey))).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Créez d'abord la fiche CAPA depuis les écarts de l'audit" });
      const { actionRetenue, selectedActionIds } = serializeSelectedActions(input.selectedActions);
      await db.update(capa_actions).set({
        aiContexte: input.analysis.contexteSituation,
        aiNonConformite: input.analysis.nonConformiteIdentifiee,
        ai5Pourquoi: input.analysis.analyse5Pourquoi,
        aiActionsProposees: input.analysis.actionsCorrectivesProposees,
        aiNiveauConfiance: input.analysis.niveauConfiance,
        selectedActionIds,
        analyseCauseRacine: input.analysis.analyse5Pourquoi.causeRacineIdentifiee,
        correctionImmediate: input.analysis.correctionImmediate,
        actionRetenue,
        rootCauseMethod: "5_pourquoi",
        responsible: input.responsible,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        progressUpdatedAt: new Date(), progressUpdatedBy: ctx.user.id,
      }).where(eq(capa_actions.id, existing.id));
      await recordHistory(db, existing.id, ctx.user.id, [{ champ: "analyse_ia_validee", ancienneValeur: null, nouvelleValeur: `Actions sélectionnées : ${input.selectedActions.map((a) => a.id).join(", ")}` }]);
      const [saved] = await db.select().from(capa_actions).where(eq(capa_actions.id, existing.id)).limit(1);
      return toCapaAction(saved);
    }),

  /**
   * Génère (ou complète) le plan d'action d'un audit à partir des écarts
   * actuels du moteur de scoring. Idempotent : n'insère que les questions
   * sans fiche CAPA existante (contrainte unique userId+auditId+questionKey).
   */
  generateFromAudit: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { scoringQuestions, scoringResponses, questionRows } = await loadAuditScoringContext(
        db,
        input.auditId,
        ctx.user.id
      );
      const questionByKey = new Map(questionRows.map((q) => [q.questionKey, q]));

      const { ecarts, couvertureCroisee } = buildScoringResult(scoringQuestions, scoringResponses);
      const coverageByKey = new Map(couvertureCroisee.map((c) => [c.questionKey, c.referentielsCouverts]));

      const existingRows = await db
        .select({ questionKey: capa_actions.questionKey })
        .from(capa_actions)
        .where(and(eq(capa_actions.auditId, input.auditId), eq(capa_actions.userId, ctx.user.id)));
      const existingKeys = new Set(existingRows.map((r) => r.questionKey));

      const toInsert = ecarts
        .filter((e) => !existingKeys.has(e.questionKey))
        .map((ecart) => {
          const question = questionByKey.get(ecart.questionKey);
          const draft = buildActionDraft(
            ecart,
            { auditVerifies: question?.auditVerifies ?? null, expectedEvidence: question?.expectedEvidence ?? null },
            coverageByKey.get(ecart.questionKey) ?? []
          );
          return {
            userId: ctx.user.id,
            auditId: input.auditId,
            questionKey: draft.questionKey,
            referentialCode: draft.referentialCode,
            processName: draft.processName,
            gravite: draft.gravite,
            criticality: draft.criticality,
            ecartIdentifie: draft.ecartIdentifie,
            actionRecommandee: draft.actionRecommandee,
            statut: "ouverte" as const,
            referentielsImpactes: draft.referentielsImpactes,
          };
        });

      if (toInsert.length > 0) {
        await db.insert(capa_actions).values(toInsert);
      }

      return { created: toInsert.length, totalEcarts: ecarts.length };
    }),

  /** Liste le plan d'action d'un audit, trié par priorité (gravité + criticité). */
  list: protectedProcedure.input(z.object({ auditId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    await assertAuditOwnership(db, input.auditId, ctx.user.id);

    const rows = await db
      .select()
      .from(capa_actions)
      .where(and(eq(capa_actions.auditId, input.auditId), eq(capa_actions.userId, ctx.user.id)));

    const actions = rows.map(toCapaAction);
    const sorted = sortByPriority(actions);
    return sorted.map((a) => ({ ...a, priorite: sorted.indexOf(a) }));
  }),

  /** Historique de traçabilité d'une action (§8 SPEC-2). */
  history: protectedProcedure.input(z.object({ actionId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [action] = await db
      .select()
      .from(capa_actions)
      .where(and(eq(capa_actions.id, input.actionId), eq(capa_actions.userId, ctx.user.id)))
      .limit(1);
    if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Action introuvable" });

    const rows = await db
      .select()
      .from(capa_action_history)
      .where(eq(capa_action_history.actionId, input.actionId))
      .orderBy(capa_action_history.changedAt);

    return rows.map((r) => ({
      id: r.id,
      actionId: r.actionId,
      userId: r.userId,
      changedAt: r.changedAt.toISOString(),
      champ: r.champ,
      ancienneValeur: r.ancienneValeur,
      nouvelleValeur: r.nouvelleValeur,
    }));
  }),

  /** Met à jour les champs éditables d'une action (hors changement de statut, voir updateStatus). */
  update: protectedProcedure
    .input(
      z.object({
        actionId: z.number().int().positive(),
        actionRetenue: z.string().optional(),
        analyseCauseRacine: z.string().optional(),
        responsible: z.string().optional(),
        dueDate: z.string().datetime().nullish(),
        preuveRealisation: z.string().optional(),
        dateVerificationEfficacite: z.string().datetime().nullish(),
        preuveEfficacite: z.string().optional(),
        // Section 5/6 du rapport (Tâche D.7, migration 0027) — facultatifs.
        // mdsapGrade/mdsapEscalation uniquement pertinents pour un audit MDSAP.
        rootCauseMethod: z.enum(["5_pourquoi", "ishikawa", "autre"]).optional(),
        mdsapGrade: z.number().int().min(1).max(5).optional(),
        mdsapEscalation: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select()
        .from(capa_actions)
        .where(and(eq(capa_actions.id, input.actionId), eq(capa_actions.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Action introuvable" });

      const { actionId, ...fields } = input;
      const dateFields = new Set(["dueDate", "dateVerificationEfficacite"]);
      const updates: Record<string, unknown> = {};
      const historyEntries: Array<{ champ: string; ancienneValeur: string | null; nouvelleValeur: string | null }> = [];

      for (const [champ, value] of Object.entries(fields)) {
        if (value === undefined) continue;

        const previous = existing[champ as keyof typeof existing];
        const ancienneValeur = previous instanceof Date ? previous.toISOString() : previous == null ? null : String(previous);
        const nouvelleValeur = value === null ? null : String(value);

        updates[champ] = dateFields.has(champ) ? (value ? new Date(value) : null) : value;
        historyEntries.push({ champ, ancienneValeur, nouvelleValeur });
      }

      if (Object.keys(updates).length === 0) return toCapaAction(existing);

      await db.update(capa_actions).set(updates).where(eq(capa_actions.id, actionId));
      await recordHistory(db, actionId, ctx.user.id, historyEntries);

      const [updated] = await db.select().from(capa_actions).where(eq(capa_actions.id, actionId)).limit(1);
      return toCapaAction(updated);
    }),

  /**
   * Change le statut d'une action en validant le cycle de vie (§3 SPEC-2) :
   * jamais de saut direct `en_cours` -> clôture, analyse de cause racine
   * obligatoire pour une gravité majeure, preuves requises avant vérification
   * et clôture.
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        actionId: z.number().int().positive(),
        statut: CapaStatusEnum,
        resultatEfficacite: z.enum(["efficace", "inefficace"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select()
        .from(capa_actions)
        .where(and(eq(capa_actions.id, input.actionId), eq(capa_actions.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Action introuvable" });

      const current = existing.statut as CapaStatus;
      if (!isValidStatusTransition(current, input.statut)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Transition de statut invalide : ${current} -> ${input.statut}.`,
        });
      }

      const fieldError = validateTransitionFields(input.statut, {
        gravite: existing.gravite as CapaAction["gravite"],
        analyseCauseRacine: existing.analyseCauseRacine,
        preuveRealisation: existing.preuveRealisation,
        preuveEfficacite: existing.preuveEfficacite,
        resultatEfficacite: input.resultatEfficacite ?? existing.resultatEfficacite ?? undefined,
      });
      if (fieldError) throw new TRPCError({ code: "BAD_REQUEST", message: fieldError });

      const updates: Record<string, unknown> = { statut: input.statut };
      if (input.resultatEfficacite) updates.resultatEfficacite = input.resultatEfficacite;

      await db.update(capa_actions).set(updates).where(eq(capa_actions.id, input.actionId));
      await recordHistory(db, input.actionId, ctx.user.id, [
        { champ: "statut", ancienneValeur: current, nouvelleValeur: input.statut },
      ]);

      const [updated] = await db.select().from(capa_actions).where(eq(capa_actions.id, input.actionId)).limit(1);
      return toCapaAction(updated);
    }),
});
