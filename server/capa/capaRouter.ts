import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { audits, capa_actions, capa_action_history } from "../../drizzle/schema";
import { buildScoringResult } from "../scoring/scoringEngine";
import { loadAuditScoringContext } from "../scoring/scoringRouter";
import { buildActionDraft, isValidStatusTransition, sortByPriority, validateTransitionFields } from "./capaEngine";
import type { CapaAction, CapaReferentielImpacte, CapaStatus } from "./types";

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
