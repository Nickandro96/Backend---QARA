// server/findings-router.ts
//
// Frontend expects trpc.findings.list({ auditId }) et trpc.actions.list({ auditId })
// (client/src/pages/AuditDetail.tsx) — namespaces absents de qitbxl jusqu'ici
// (recherche exhaustive, zéro résultat), confirmé via INVENTAIRE-BUGS.md #4.
// Les tables `findings`/`actions` existent déjà dans le schéma
// (drizzle/schema.ts) ; seuls les routeurs manquaient.
//
// Mapping de champs (additif, sans toucher au schéma) : le frontend attend
// `criticality`/`processName`/`title` que les tables ne portent pas telles
// quelles (`severity`, pas de colonne process, `description` seulement pour
// actions) — alias au niveau de la réponse plutôt que migration.
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { findings, actions, audits, audit_responses, questions, capa_actions, capa_tasks } from "../drizzle/schema";
import { classifyNonConformityResponse } from "./capa/capaEngine";

async function assertOwnsAudit(db: any, userId: number, auditId: number) {
  const [audit] = await db
    .select({ id: audits.id })
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);
  return !!audit;
}

export const findingsRouter = router({
  list: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      if (!(await assertOwnsAudit(db, ctx.user.id, input.auditId))) return [];

      const rows = await db
        .select()
        .from(findings)
        .where(eq(findings.auditId, input.auditId));

      const responseRows = await db
        .select()
        .from(audit_responses)
        .where(and(eq(audit_responses.auditId, input.auditId), eq(audit_responses.userId, ctx.user.id)));
      const ncResponses = responseRows.filter((row: any) => classifyNonConformityResponse(row.responseValue) !== null);
      const questionRows = ncResponses.length ? await db.select().from(questions) : [];
      const questionByKey = new Map(questionRows.map((q: any) => [q.questionKey, q]));
      const capaRows = await db
        .select()
        .from(capa_actions)
        .where(and(eq(capa_actions.auditId, input.auditId), eq(capa_actions.userId, ctx.user.id)));
      const capaByQuestionKey = new Map(capaRows.map((row: any) => [row.questionKey, row]));

      // Même remarque que pour les actions : le frontend ne reconnaît que
      // 'Open'/'InProgress'/'Closed' explicitement, sinon affiche la valeur
      // brute — normalise la casse pour ces trois cas connus.
      const STATUS_MAP: Record<string, string> = {
        open: "Open",
        in_progress: "InProgress",
        closed: "Closed",
      };

      // `severity` est écrit en anglais (critical/high/medium/low, voir
      // fda-router.ts CRITICALITY_WEIGHTS) mais AuditDetail.tsx comparait
      // `criticality === 'Critique'/'Majeure'/'Mineure'/'Observation'`
      // (français) sans jamais rien mapper — les compteurs "NC Critiques"/
      // "NC Majeures" affichaient donc toujours 0, quelle que soit la
      // vraie sévérité (CORRECTIONS.md LOT 5, trouvé en corrigeant BUG 1/2).
      const CRITICALITY_MAP: Record<string, string> = {
        critical: "Critique",
        high: "Majeure",
        medium: "Mineure",
        low: "Observation",
      };

      const legacyRows = rows.map((f: any) => ({
        ...f,
        criticality: CRITICALITY_MAP[String(f.severity ?? "").toLowerCase()] ?? f.severity,
        processName: null,
        status: STATUS_MAP[f.status] ?? f.status,
      }));

      const legacyQuestionKeys = new Set(legacyRows.map((row: any) => row.questionKey).filter(Boolean));
      const responseFindings = ncResponses
        .filter((response: any) => !legacyQuestionKeys.has(response.questionKey))
        .map((response: any) => {
          const question: any = questionByKey.get(response.questionKey);
          const capa: any = capaByQuestionKey.get(response.questionKey);
          const rawCriticality = String(capa?.criticality ?? question?.criticality ?? "medium").toLowerCase();
          return {
            id: `response-${response.id}`,
            auditId: input.auditId,
            questionKey: response.questionKey,
            title: question?.title ?? question?.questionText ?? response.questionKey,
            description: response.responseComment ?? response.note ?? capa?.ecartIdentifie ?? `Réponse « ${response.responseValue} »`,
            criticality: CRITICALITY_MAP[rawCriticality] ?? "Mineure",
            processName: capa?.processName ?? question?.processDetail ?? null,
            status: capa?.statut?.startsWith("cloturee") ? "Closed" : capa?.statut === "en_cours" ? "InProgress" : "Open",
            source: "audit_response",
            responseValue: response.responseValue,
          };
        });

      return [...legacyRows, ...responseFindings];
    }),
});

export const actionsRouter = router({
  list: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      if (!(await assertOwnsAudit(db, ctx.user.id, input.auditId))) return [];

      const findingRows = await db
        .select({ id: findings.id })
        .from(findings)
        .where(eq(findings.auditId, input.auditId));
      const findingIds = findingRows.map((f: any) => f.id);
      const rows = findingIds.length === 0 ? [] : await db
        .select()
        .from(actions)
        .where(inArray(actions.findingId, findingIds));

      const capaRows = await db
        .select({ id: capa_actions.id })
        .from(capa_actions)
        .where(and(eq(capa_actions.auditId, input.auditId), eq(capa_actions.userId, ctx.user.id)));
      const taskRows = capaRows.length === 0 ? [] : await db
        .select()
        .from(capa_tasks)
        .where(and(inArray(capa_tasks.capaId, capaRows.map((row: any) => row.id)), eq(capa_tasks.userId, ctx.user.id)));

      // Le frontend (AuditDetail.tsx) ne reconnaît que 'Completed'/'InProgress'
      // explicitement dans son badge ; toute autre valeur affiche "Planifiée"
      // par défaut — donc seuls closed/in_progress ont besoin d'un mapping,
      // 'open' tombe naturellement sur le bon libellé sans mapping.
      const STATUS_MAP: Record<string, string> = {
        in_progress: "InProgress",
        closed: "Completed",
      };

      const legacyActions = rows.map((a: any) => ({
        ...a,
        title: a.actionCode || a.description?.slice(0, 60) || `Action #${a.id}`,
        status: STATUS_MAP[a.status] ?? a.status,
      }));

      const capaActions = taskRows.map((task: any) => ({
        id: `capa-task-${task.id}`,
        findingId: null,
        actionCode: null,
        title: task.title,
        description: task.description,
        responsible: task.responsible,
        dueDate: task.dueDate,
        status: task.status === "cloturee" ? "Completed" : task.status === "en_cours" || task.status === "a_verifier" ? "InProgress" : task.status,
        source: "capa_task",
      }));

      return [...legacyActions, ...capaActions];
    }),

  /**
   * Frontend expects: trpc.actions.listMine() (ActionDashboard.tsx, page
   * "Plan d'action") — vue agrégée sur TOUS les audits de l'utilisateur,
   * contrairement à `list` qui est scopé à un seul audit. Remplace la page
   * "Plan d'action" qui montait jusqu'ici une ancienne page d'accueil avec
   * des données entièrement inventées (72%, "3 écarts critiques", etc. —
   * voir CORRECTIONS.md LOT 5, BUG 3).
   */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const myAudits = await db
      .select({ id: audits.id, name: audits.name })
      .from(audits)
      .where(eq(audits.userId, ctx.user.id));
    if (myAudits.length === 0) return [];
    const auditNameById = new Map(myAudits.map((a: any) => [a.id, a.name]));

    const myFindings = await db
      .select({ id: findings.id, auditId: findings.auditId })
      .from(findings)
      .where(inArray(findings.auditId, myAudits.map((a: any) => a.id)));
    if (myFindings.length === 0) return [];
    const auditIdByFindingId = new Map(myFindings.map((f: any) => [f.id, f.auditId]));

    const rows = await db
      .select()
      .from(actions)
      .where(inArray(actions.findingId, myFindings.map((f: any) => f.id)));

    const STATUS_MAP: Record<string, string> = {
      in_progress: "InProgress",
      closed: "Completed",
    };

    return rows.map((a: any) => {
      const auditId = auditIdByFindingId.get(a.findingId) ?? null;
      return {
        ...a,
        title: a.actionCode || a.description?.slice(0, 60) || `Action #${a.id}`,
        status: STATUS_MAP[a.status] ?? a.status,
        auditId,
        auditName: auditId ? auditNameById.get(auditId) ?? null : null,
      };
    });
  }),
});
