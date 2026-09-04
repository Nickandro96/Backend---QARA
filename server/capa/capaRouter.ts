import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, safeJsonParse } from "../db";
import { audits, audit_responses, capa_actions, capa_action_history, capa_tasks, questions, referentiels, regulatoryUpdates } from "../../drizzle/schema";
import { buildScoringResult } from "../scoring/scoringEngine";
import { loadAuditScoringContext } from "../scoring/scoringRouter";
import { buildActionDraft, classifyFinding, classifyNonConformityResponse, isTaskOverdue, isValidStatusTransition, sortByPriority, validateCapaTaskReadiness, validateTaskTransition, validateTransitionFields } from "./capaEngine";
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

function assertCapaEditable(status: string) {
  if (status.startsWith("cloturee")) {
    throw new TRPCError({ code: "CONFLICT", message: "Cette CAPA est clôturée et ne peut plus être modifiée directement." });
  }
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
  qualify: protectedProcedure.input(z.object({
    actionId: z.number().int().positive(),
    decision: z.enum(["capa_requise", "correction_simple", "surveillance", "acceptation_justifiee", "doublon", "non_applicable_apres_revue"]),
    justification: z.string().trim().max(4000).optional(),
    owner: z.string().trim().max(255).optional(),
    impactPatient: z.enum(["aucun", "potentiel", "avere", "inconnu"]).optional(),
    impactReglementaire: z.enum(["aucun", "potentiel", "avere", "inconnu"]).optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const [existing] = await db.select().from(capa_actions).where(and(eq(capa_actions.id, input.actionId), eq(capa_actions.userId, ctx.user.id))).limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier introuvable" });
    assertCapaEditable(existing.statut);
    if (input.decision !== "capa_requise" && !input.justification?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Une justification est obligatoire lorsqu'une CAPA n'est pas requise." });
    }
    await db.update(capa_actions).set({
      qualificationDecision: input.decision,
      qualificationJustification: input.justification?.trim() || null,
      qualificationOwner: input.owner?.trim() || null,
      qualificationAt: new Date(),
      impactPatient: input.impactPatient,
      impactReglementaire: input.impactReglementaire,
    }).where(eq(capa_actions.id, input.actionId));
    await recordHistory(db, input.actionId, ctx.user.id, [
      { champ: "qualificationDecision", ancienneValeur: existing.qualificationDecision, nouvelleValeur: input.decision },
      { champ: "qualificationJustification", ancienneValeur: existing.qualificationJustification, nouvelleValeur: input.justification?.trim() || null },
    ]);
    return { success: true };
  }),

  listTasks: protectedProcedure.input(z.object({ capaId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const [capa] = await db.select({ id: capa_actions.id }).from(capa_actions).where(and(eq(capa_actions.id, input.capaId), eq(capa_actions.userId, ctx.user.id))).limit(1);
    if (!capa) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier CAPA introuvable" });
    return db.select().from(capa_tasks).where(and(eq(capa_tasks.capaId, input.capaId), eq(capa_tasks.userId, ctx.user.id))).orderBy(capa_tasks.createdAt);
  }),

  createTask: protectedProcedure.input(z.object({
    capaId: z.number().int().positive(), title: z.string().trim().min(3).max(500), description: z.string().max(5000).optional(),
    responsible: z.string().max(255).optional(), dueDate: z.string().datetime().optional(),
    priority: z.enum(["basse", "moyenne", "haute", "critique"]).default("moyenne"), effectivenessCriterion: z.string().max(3000).optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const [capa] = await db.select({ id: capa_actions.id, statut: capa_actions.statut }).from(capa_actions).where(and(eq(capa_actions.id, input.capaId), eq(capa_actions.userId, ctx.user.id))).limit(1);
    if (!capa) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier CAPA introuvable" });
    assertCapaEditable(capa.statut);
    const [{ insertId }] = await db.insert(capa_tasks).values({ userId: ctx.user.id, capaId: input.capaId, title: input.title, description: input.description, responsible: input.responsible, dueDate: input.dueDate ? new Date(input.dueDate) : undefined, priority: input.priority, effectivenessCriterion: input.effectivenessCriterion });
    await recordHistory(db, input.capaId, ctx.user.id, [{ champ: "action_creee", ancienneValeur: null, nouvelleValeur: String(insertId) }]);
    return { id: Number(insertId) };
  }),

  updateTask: protectedProcedure.input(z.object({
    taskId: z.number().int().positive(), title: z.string().trim().min(3).max(500).optional(), description: z.string().max(5000).nullish(), responsible: z.string().max(255).nullish(), dueDate: z.string().datetime().nullish(),
    priority: z.enum(["basse", "moyenne", "haute", "critique"]).optional(), status: z.enum(["a_faire", "en_cours", "a_verifier", "cloturee", "annulee"]).optional(), completionEvidence: z.string().max(5000).nullish(), effectivenessCriterion: z.string().max(3000).nullish(), effectivenessResult: z.enum(["efficace", "inefficace", "non_verifiee"]).optional(), reopeningReason: z.string().trim().max(2000).optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const [task] = await db.select().from(capa_tasks).where(and(eq(capa_tasks.id, input.taskId), eq(capa_tasks.userId, ctx.user.id))).limit(1);
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Action introuvable" });
    const [parent] = await db.select({ statut: capa_actions.statut }).from(capa_actions).where(and(eq(capa_actions.id, task.capaId), eq(capa_actions.userId, ctx.user.id))).limit(1);
    if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Dossier CAPA introuvable" });
    assertCapaEditable(parent.statut);
    if (input.status && input.status !== task.status) {
      const transitionError = validateTaskTransition(task.status, input.status, {
        completionEvidence: input.completionEvidence ?? task.completionEvidence,
        effectivenessResult: input.effectivenessResult ?? task.effectivenessResult,
        reopeningReason: input.reopeningReason,
      });
      if (transitionError) throw new TRPCError({ code: "BAD_REQUEST", message: transitionError });
    }
    const { taskId, reopeningReason, ...values } = input;
    await db.update(capa_tasks).set({ ...values, dueDate: values.dueDate === undefined ? undefined : values.dueDate ? new Date(values.dueDate) : null }).where(eq(capa_tasks.id, taskId));
    if (reopeningReason?.trim()) await recordHistory(db, task.capaId, ctx.user.id, [{ champ: `action_${task.id}_motif_reouverture`, ancienneValeur: null, nouvelleValeur: reopeningReason.trim() }]);
    return { success: true };
  }),
  createFromWatchItem: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive(), watchItemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await assertAuditOwnership(db, input.auditId, ctx.user.id);
      const [item] = await db.select().from(regulatoryUpdates).where(eq(regulatoryUpdates.id, input.watchItemId)).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Alerte réglementaire introuvable" });
      const questionKey = `watch:${item.id}`;
      const [existing] = await db.select().from(capa_actions).where(and(eq(capa_actions.userId, ctx.user.id), eq(capa_actions.auditId, input.auditId), eq(capa_actions.questionKey, questionKey))).limit(1);
      if (existing) return existing;
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
      });
      const [created] = await db.select().from(capa_actions).where(and(eq(capa_actions.userId, ctx.user.id), eq(capa_actions.auditId, input.auditId), eq(capa_actions.questionKey, questionKey))).limit(1);
      return created;
    }),
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const actionRows = await db.select().from(capa_actions).where(eq(capa_actions.userId, ctx.user.id));
    const taskRows = await db.select().from(capa_tasks).where(eq(capa_tasks.userId, ctx.user.id));
    const tasksByCapa = new Map<number, typeof taskRows>();
    for (const task of taskRows) tasksByCapa.set(task.capaId, [...(tasksByCapa.get(task.capaId) ?? []), task]);
    const auditRows = await db.select({ id: audits.id, name: audits.name }).from(audits).where(eq(audits.userId, ctx.user.id));
    const auditNameById = new Map(auditRows.map((a) => [a.id, a.name]));
    const responseRows = await db.select().from(audit_responses).where(eq(audit_responses.userId, ctx.user.id));
    const questionRows = await db.select().from(questions);
    const questionByKey = new Map(questionRows.map((q) => [q.questionKey, q]));
    const actionKeys = new Set(actionRows.map((a) => `${a.auditId}:${a.questionKey}`));
    const auditIds = new Set(auditRows.map((a) => a.id));
    const ncResponseRows = responseRows.filter((r) => {
      return auditIds.has(r.auditId) && classifyNonConformityResponse(r.responseValue) !== null;
    });
    const occurrencesByQuestionKey = new Map<string, number>();
    for (const response of ncResponseRows) occurrencesByQuestionKey.set(response.questionKey, (occurrencesByQuestionKey.get(response.questionKey) ?? 0) + 1);
    const unplanned = ncResponseRows.flatMap((r) => {
      if (actionKeys.has(`${r.auditId}:${r.questionKey}`)) return [];
      const q = questionByKey.get(r.questionKey);
      const criticality = q?.criticality ?? "medium";
      const gravite = criticality === "critical" || criticality === "high" ? "majeur" : "mineur";
      return [{ id: `NC-${r.auditId}-${r.id}`, auditId: r.auditId, auditName: auditNameById.get(r.auditId) ?? `Audit ${r.auditId}`, questionKey: r.questionKey, questionText: q?.questionText ?? q?.title ?? r.questionKey, referentialId: q?.referentialId ?? null, requirement: [q?.article, q?.annexe].filter(Boolean).join(" / ") || null, criticality, classification: classifyFinding(gravite, criticality), processName: q?.processDetail ?? null, articleReference: [q?.article, q?.annexe].filter(Boolean).join(" / ") || null, responseValue: r.responseValue, responseComment: r.responseComment, objectiveEvidence: r.note, evidenceFiles: r.evidenceFiles, authorId: r.answeredBy ?? r.userId, detectedAt: (r.answeredAt ?? r.updatedAt ?? r.createdAt).toISOString(), updatedAt: r.updatedAt.toISOString(), status: "a_qualifier" as const, recurrenceCount: occurrencesByQuestionKey.get(r.questionKey) ?? 1 }];
    });
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rawById = new Map(actionRows.map((row) => [row.id, row]));
    const watchIds = actionRows.flatMap((row) => row.watchItemId ? [row.watchItemId] : []);
    const watchRows = watchIds.length ? await db.select({ id: regulatoryUpdates.id, title: regulatoryUpdates.title, sourceName: regulatoryUpdates.sourceName, sourceUrl: regulatoryUpdates.sourceUrl }).from(regulatoryUpdates) : [];
    const watchById = new Map(watchRows.filter((row) => watchIds.includes(row.id)).map((row) => [row.id, row]));
    const actions = sortByPriority(actionRows.map(toCapaAction)).map((a) => {
      const raw = rawById.get(a.id)!;
      const year = raw.createdAt.getUTCFullYear();
      const phase = raw.statut.startsWith("cloturee") ? "cloture" : raw.statut === "a_verifier" ? "verification" : raw.analyseCauseRacine ? "mise_en_oeuvre" : raw.ai5Pourquoi ? "cause_racine" : "qualification";
      const completedFields = [raw.analyseCauseRacine, raw.actionRetenue, raw.responsible, raw.dueDate, raw.preuveRealisation, raw.preuveEfficacite].filter(Boolean).length;
      return { ...a, classification: classifyFinding(a.gravite, a.criticality), qualificationDecision: raw.qualificationDecision, qualificationJustification: raw.qualificationJustification, qualificationOwner: raw.qualificationOwner, qualificationAt: raw.qualificationAt?.toISOString() ?? null, impactPatient: raw.impactPatient, impactReglementaire: raw.impactReglementaire, tasks: (tasksByCapa.get(a.id) ?? []).map((task) => ({ ...task, overdue: isTaskOverdue(task.dueDate, task.status, now), dueDate: task.dueDate?.toISOString() ?? null, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(), actionIdentifier: `ACT-${task.createdAt.getUTCFullYear()}-${String(task.id).padStart(4, "0")}` })), capaIdentifier: `CAPA-${year}-${String(a.id).padStart(4, "0")}`, actionIdentifier: `ACT-${year}-${String(a.id).padStart(4, "0")}`, phase, progress: Math.round((completedFields / 6) * 100), overdue: isTaskOverdue(raw.dueDate, raw.statut.startsWith("cloturee") ? "cloturee" : "en_cours", now), hasAIAnalysis: Boolean(raw.ai5Pourquoi), correctionImmediate: raw.correctionImmediate, auditName: auditNameById.get(a.auditId) ?? `Audit ${a.auditId}`, source: raw.source, watchItemId: raw.watchItemId, watchItem: raw.watchItemId ? watchById.get(raw.watchItemId) ?? null : null };
    });
    const capaById = new Map(actions.map((action) => [action.id, action]));
    const operationalActions = taskRows.map((task) => {
      const capa = capaById.get(task.capaId);
      return { ...task, actionRetenue: task.title, statut: task.status, resultatEfficacite: task.effectivenessResult, overdue: isTaskOverdue(task.dueDate, task.status, now), dueDate: task.dueDate?.toISOString() ?? null, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(), actionIdentifier: `ACT-${task.createdAt.getUTCFullYear()}-${String(task.id).padStart(4, "0")}`, capaIdentifier: capa?.capaIdentifier ?? `CAPA-${task.capaId}`, auditId: capa?.auditId ?? null, auditName: capa?.auditName ?? null, source: capa?.source ?? "audit" };
    });
    const closedRows = actionRows.filter((a) => a.statut.startsWith("cloturee"));
    const closedWithDueDate = closedRows.filter((a) => a.dueDate);
    const closedOnTime = closedWithDueDate.filter((a) => a.dueDate && a.updatedAt <= a.dueDate).length;
    const checkedEffectiveness = actionRows.filter((a) => a.resultatEfficacite);
    const effective = checkedEffectiveness.filter((a) => a.resultatEfficacite === "efficace").length;
    const resolvedDurations = closedRows.map((a) => a.updatedAt.getTime() - a.createdAt.getTime()).filter((duration) => duration >= 0);
    const averageResolutionDays = resolvedDurations.length ? Math.round(resolvedDurations.reduce((sum, duration) => sum + duration, 0) / resolvedDurations.length / 86_400_000) : null;
    const monthBuckets = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - offset), 1));
      const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
      return { month: date.toISOString().slice(0, 7), opened: ncResponseRows.filter((r) => r.createdAt >= date && r.createdAt < next).length, closed: closedRows.filter((a) => a.updatedAt >= date && a.updatedAt < next).length };
    });
    const processCounts = new Map<string, number>();
    for (const item of [...unplanned.map((nc) => nc.processName), ...actionRows.map((action) => action.processName)]) {
      const label = item || "Non renseigné";
      processCounts.set(label, (processCounts.get(label) ?? 0) + 1);
    }
    const nonConformities = [
      ...unplanned.map((nc) => ({ ...nc, capaIdentifier: null })),
      ...actions.map((action) => ({
        id: `NC-${action.auditId}-${action.id}`,
        auditId: action.auditId,
        auditName: action.auditName,
        questionKey: action.questionKey,
        questionText: action.ecartIdentifie,
        criticality: action.criticality,
        processName: action.processName,
        articleReference: action.referentialCode,
        responseComment: null,
        objectiveEvidence: null,
        detectedAt: action.createdAt,
        status: String(action.statut).startsWith("cloturee") ? "cloturee" as const : "en_traitement" as const,
        recurrenceCount: occurrencesByQuestionKey.get(action.questionKey) ?? 1,
        capaIdentifier: action.capaIdentifier,
      })),
    ].sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    return {
      stats: {
        ncOuvertes: unplanned.length + actionRows.filter((a) => !a.statut.startsWith("cloturee")).length,
        ncSansCapa: unplanned.length,
        ncRecurrentes: unplanned.filter((nc) => nc.recurrenceCount > 1).length,
        capaOuvertes: actionRows.filter((a) => !a.statut.startsWith("cloturee")).length,
        capaEnRetard: actionRows.filter((a) => isTaskOverdue(a.dueDate, a.statut.startsWith("cloturee") ? "cloturee" : "en_cours", now)).length,
        actionsOuvertes: taskRows.filter((a) => !["cloturee", "annulee"].includes(a.status)).length,
        enCours: taskRows.filter((a) => a.status === "en_cours").length,
        aVerifier: taskRows.filter((a) => a.status === "a_verifier").length,
        efficaciteAVerifier: actionRows.filter((a) => a.statut === "a_verifier").length + taskRows.filter((a) => a.status === "a_verifier").length,
        enRetard: taskRows.filter((a) => isTaskOverdue(a.dueDate, a.status, now)).length,
        clotureesCeMois: actionRows.filter((a) => a.statut.startsWith("cloturee") && a.updatedAt >= monthStart).length,
        tauxClotureDansLesDelais: closedWithDueDate.length ? Math.round((closedOnTime / closedWithDueDate.length) * 100) : null,
        tauxEfficacite: checkedEffectiveness.length ? Math.round((effective / checkedEffectiveness.length) * 100) : null,
        delaiMoyenResolutionJours: averageResolutionDays,
      },
      unplanned,
      nonConformities,
      actions,
      operationalActions,
      trends: monthBuckets,
      processBreakdown: Array.from(processCounts, ([process, count]) => ({ process, count })).sort((a, b) => b.count - a.count),
      ncByCriticality: Object.fromEntries(["critical", "high", "medium", "low"].map((level) => [level, nonConformities.filter((nc) => nc.criticality === level && nc.status !== "cloturee").length])),
      upcomingDeadlines: operationalActions.filter((action) => action.dueDate && !["cloturee", "annulee"].includes(action.status)).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 8),
    };
  }),

  generateAnalysis: protectedProcedure
    .input(z.object({ auditId: z.number().int().positive(), questionKey: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      console.info("[CAPA AI] generateAnalysis requested", { userId: ctx.user.id, auditId: input.auditId, questionKey: input.questionKey });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [audit] = await db.select().from(audits).where(and(eq(audits.id, input.auditId), eq(audits.userId, ctx.user.id))).limit(1);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND", message: "Audit introuvable" });
      const [response] = await db.select().from(audit_responses).where(and(eq(audit_responses.auditId, input.auditId), eq(audit_responses.userId, ctx.user.id), eq(audit_responses.questionKey, input.questionKey))).limit(1);
      if (!response) throw new TRPCError({ code: "NOT_FOUND", message: "Réponse d'audit introuvable" });
      const responseValue = classifyNonConformityResponse(response.responseValue);
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
      console.info("[CAPA AI] generateAnalysis completed", { userId: ctx.user.id, auditId: input.auditId, questionKey: input.questionKey, proposedActions: result.actionsCorrectivesProposees.length, confidence: result.niveauConfiance });
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
      assertCapaEditable(existing.statut);
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
      const existingTasks = await db.select({ title: capa_tasks.title }).from(capa_tasks).where(and(eq(capa_tasks.capaId, existing.id), eq(capa_tasks.userId, ctx.user.id)));
      const existingTitles = new Set(existingTasks.map((task) => task.title.trim().toLocaleLowerCase("fr")));
      const newTasks = input.selectedActions.filter((action) => !existingTitles.has(action.titre.trim().toLocaleLowerCase("fr"))).map((action) => ({
        capaId: existing.id,
        userId: ctx.user.id,
        title: action.titre,
        description: action.description,
        responsible: input.responsible,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        priority: (action.priorite === "immediate" ? "critique" : action.priorite === "court_terme" ? "haute" : "moyenne") as "critique" | "haute" | "moyenne",
        effectivenessCriterion: action.indicateurEfficacite,
      }));
      if (newTasks.length) await db.insert(capa_tasks).values(newTasks);
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

    const taskRows = await db.select().from(capa_tasks).where(eq(capa_tasks.userId, ctx.user.id));
    const actions = rows.map((row) => ({
      ...toCapaAction(row),
      qualificationDecision: row.qualificationDecision,
      qualificationJustification: row.qualificationJustification,
      qualificationOwner: row.qualificationOwner,
      qualificationAt: row.qualificationAt?.toISOString() ?? null,
      impactPatient: row.impactPatient,
      impactReglementaire: row.impactReglementaire,
      tasks: taskRows.filter((task) => task.capaId === row.id).map((task) => ({ ...task, dueDate: task.dueDate?.toISOString() ?? null, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() })),
    }));
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

      if (String(existing.statut).startsWith("cloturee")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Une CAPA clôturée est immuable. Réouvrez-la via une transition de statut autorisée." });
      }

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

      const taskRows = await db.select({ status: capa_tasks.status, effectivenessResult: capa_tasks.effectivenessResult })
        .from(capa_tasks)
        .where(and(eq(capa_tasks.capaId, input.actionId), eq(capa_tasks.userId, ctx.user.id)));
      const taskError = validateCapaTaskReadiness(input.statut, taskRows);
      if (taskError) throw new TRPCError({ code: "BAD_REQUEST", message: taskError });

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
