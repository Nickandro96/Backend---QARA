/**
 * Calcul de score générique, par audit, à la volée — partagé entre
 * server/audit-router.ts (endpoints audit.get/getStats/getScore) et
 * server/db-dashboard-v2.ts (agrégats dashboard).
 *
 * Extrait ici (plutôt que dupliqué) car la table `audits` n'a pas de
 * colonnes `score`/`conformityRate` (vérifié dans drizzle/schema.ts) —
 * rien ne les écrit jamais pour MDR/ISO, donc tout code qui les lisait
 * directement obtenait toujours 0. Le score doit être recalculé à partir
 * de `audit_responses`, scopé par référentiel/rôle comme le fait déjà
 * mdr.getAuditDashboard (même barème).
 */
import { eq, and } from "drizzle-orm";
import { auditResponses, questions } from "../drizzle/schema";
import { getAuditContextInternal, fetchAuditScopedQuestions } from "./mdr-router";
import { calculateAuditProgress } from "./audit-progress";

export const SCORE_MAP: Record<string, number> = {
  compliant: 100,
  partial: 60,
  non_compliant: 20,
  not_applicable: 100,
  in_progress: 50,
};

/**
 * `findings.severity` (colonne réelle) → type de constat.
 * `findings` n'a pas de colonne `findingType`/`criticality` (vérifié dans
 * drizzle/schema.ts) — cette dérivation est partagée entre report-generator.ts
 * et db-dashboard-v2.ts pour éviter deux mappings divergents.
 */
export const FINDING_TYPE_BY_SEVERITY: Record<string, string> = {
  critical: "nc_major",
  high: "nc_major",
  medium: "nc_minor",
  low: "observation",
};

export function mapSeverityToFindingType(severity: string | null | undefined): string {
  return FINDING_TYPE_BY_SEVERITY[String(severity ?? "").toLowerCase()] ?? "ofi";
}

export async function computeGenericAuditStats(db: any, userId: number, auditId: number) {
  const auditContext = await getAuditContextInternal(db, userId, auditId);

  const questionRows = await fetchAuditScopedQuestions(db, {
    auditId,
    userId,
    economicRole: auditContext.economicRole,
    economicRolesFromOnboarding: auditContext.economicRolesFromOnboarding,
    situationTags: auditContext.situationTags,
    processIds: auditContext.processIds,
    referentialIds: auditContext.referentialIds,
    select: { questionKey: (questions as any).questionKey },
  });

  const scopedKeys = new Set<string>((questionRows || []).map((q: any) => String(q.questionKey)));
  const totalQuestions = scopedKeys.size;

  const responseRows = await db
    .select({
      questionKey: (auditResponses as any).questionKey,
      responseValue: (auditResponses as any).responseValue,
    })
    .from(auditResponses)
    .where(and(eq((auditResponses as any).auditId, auditId), eq((auditResponses as any).userId, userId)));

  const scopedResponses = (responseRows || []).filter((r: any) => scopedKeys.has(String(r.questionKey)));

  const stats = {
    totalQuestions,
    answered: 0,
    compliant: 0,
    partial: 0,
    non_compliant: 0,
    not_applicable: 0,
    in_progress: 0,
  };

  let scoreTotal = 0;
  let scoreCount = 0;

  for (const r of scopedResponses) {
    const status = String(r.responseValue || "in_progress");
    if (status in stats) {
      (stats as any)[status] += 1;
      if (status !== "in_progress") stats.answered += 1;
    }
    scoreTotal += SCORE_MAP[status] ?? 50;
    scoreCount += 1;
  }

  const score = scoreCount > 0 ? Math.round((scoreTotal / scoreCount) * 10) / 10 : 0;

  const progress = calculateAuditProgress(scopedKeys, scopedResponses);
  return { audit: auditContext.audit, stats, score, progress };
}

/**
 * Variante silencieuse pour les agrégats dashboard : un audit sans scope
 * résolvable (ex. brouillon jamais rattaché à un référentiel) ne doit pas
 * faire échouer tout le dashboard — renvoie score=null plutôt que de
 * lever une erreur, pour que l'appelant l'exclue de la moyenne comme le
 * faisait le filtre `a.score && a.conformityRate` d'origine.
 */
export async function computeGenericAuditScoreSafe(db: any, userId: number, auditId: number): Promise<number | null> {
  try {
    const { stats, score } = await computeGenericAuditStats(db, userId, auditId);
    if (stats.answered === 0) return null;
    return score;
  } catch {
    return null;
  }
}

export async function computeGenericAuditProgressSafe(db: any, userId: number, auditId: number) {
  try {
    return (await computeGenericAuditStats(db, userId, auditId)).progress;
  } catch {
    return null;
  }
}
