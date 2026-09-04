/**
 * Dashboard - Fonctions d'agrégation consommées par le tableau de bord réel
 * (client/src/pages/Dashboard.tsx via dashboard.getKPIs / dashboard.getRecentFindings).
 *
 * Historique (voir CORRECTIONS.md, Tâche C, correction du 2026-07-23) :
 * ce fichier contenait de nombreuses fonctions (getDashboardTimeseries,
 * getDashboardHeatmap, getDashboardRadar, getDashboardScoring,
 * getDashboardProcessus, et les branches "actions"/"audits" de
 * getDashboardDrilldown) qui n'étaient plus appelées que par des pages
 * jamais routées (DashboardV2.tsx, DashboardExecutive.tsx — toutes deux
 * supprimées) et contenaient des colonnes fantômes (`findings.criticality`,
 * `findings.processId`, `findings.findingType`, `actions.priority`,
 * `actions.title`, `actions.responsibleName`, valeurs `"completed"`/
 * `"verified"`/`"cancelled"` inexistantes sur l'enum réel de `actions.status`).
 * Supprimées avec leurs appelants plutôt que corrigées, pour ne pas laisser
 * de code mort et cassé comme piège pour un futur rebranchement.
 *
 * Les deux fonctions restantes (getDashboardSummary, getDashboardDrilldown
 * côté "findings") sont réellement utilisées par le dashboard en production
 * (via getKPIs/getRecentFindings) et ont été corrigées ici pour utiliser les
 * vraies colonnes de `findings`/`actions` (voir drizzle/schema.ts).
 */

import { getDb } from "./db";
import { audits, findings, actions } from "../drizzle/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { computeGenericAuditProgressSafe, computeGenericAuditScoreSafe, mapSeverityToFindingType } from "./audit-scoring";

// Types pour les filtres
export interface DashboardFilters {
  market?: "eu" | "us" | "all";
  referentialIds?: number[];
  economicRole?: "fabricant" | "importateur" | "distributeur" | "all";
  period?: {
    start: Date;
    end: Date;
  };
  siteId?: number;
  auditStatus?: "draft" | "in_progress" | "completed" | "closed" | "all";
  criticality?: "critical" | "high" | "medium" | "low" | "all";
}

function buildAuditFilters(userId: number, filters?: DashboardFilters) {
  const conditions: any[] = [eq(audits.userId, userId)];

  if (filters?.siteId) {
    conditions.push(eq(audits.siteId, filters.siteId));
  }

  if (filters?.auditStatus && filters.auditStatus !== "all") {
    conditions.push(eq(audits.status, filters.auditStatus));
  }

  if (filters?.period) {
    if (filters.period.start) {
      conditions.push(gte(audits.startDate, filters.period.start));
    }
    if (filters.period.end) {
      conditions.push(lte(audits.startDate, filters.period.end));
    }
  }

  return conditions;
}

/**
 * GET SUMMARY - KPIs macro avec filtres (utilisé par dashboard.getKPIs, réel).
 *
 * Corrections apportées (Tâche C) :
 * - `finding.criticality` (n'existe pas) → `finding.severity` (colonne réelle).
 * - `finding.findingType` (n'existe pas) → dérivé de `severity` via
 *   `mapSeverityToFindingType`, même mapping que le générateur de rapport
 *   (server/report-generator.ts) pour rester cohérent partout.
 * - `actions.status === "completed"/"verified"/"cancelled"` (valeurs jamais
 *   présentes, l'enum réel est `open`/`in_progress`/`closed`) → `"closed"`.
 * - `action.completedAt` (n'existe pas) → approximé par `updatedAt` sur les
 *   actions closes (seule donnée réelle disponible pour dater une clôture) ;
 *   si aucune action close, la moyenne n'est pas calculée (0, pas de valeur
 *   inventée).
 */
export async function getDashboardSummary(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const auditConditions = buildAuditFilters(userId, filters);

  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));

  const auditIds = userAudits.map((a: any) => a.id);

  if (auditIds.length === 0) {
    return {
      totalAudits: 0,
      auditsByStatus: { draft: 0, planned: 0, in_progress: 0, completed: 0, closed: 0, cancelled: 0 },
      globalConformityRate: 0,
      averageAuditScore: 0,
      totalFindings: 0,
      findingsByCriticality: { critical: 0, high: 0, medium: 0, low: 0 },
      findingsByStatus: { open: 0, in_progress: 0, closed: 0 },
      findingsByType: { nc_major: 0, nc_minor: 0, observation: 0, ofi: 0, positive: 0 },
      topRiskyProcesses: [],
      totalActions: 0,
      actionsByStatus: { open: 0, in_progress: 0, closed: 0 },
      overdueActions: 0,
      overduePercentage: 0,
      averageClosureTime: 0,
      averageProgression: 0,
      actuallyCompleteAudits: 0,
    };
  }

  const auditsByStatus = {
    draft: userAudits.filter((a: any) => a.status === "draft").length,
    planned: userAudits.filter((a: any) => a.status === "planned").length,
    in_progress: userAudits.filter((a: any) => a.status === "in_progress").length,
    completed: userAudits.filter((a: any) => a.status === "completed").length,
    closed: userAudits.filter((a: any) => a.status === "closed").length,
    cancelled: userAudits.filter((a: any) => a.status === "cancelled").length,
  };

  // `audits` n'a pas de colonnes `score`/`conformityRate` — recalcul à la
  // volée via le même barème que mdr.getAuditDashboard (audit-scoring.ts).
  const computedScores = (
    await Promise.all(userAudits.map((a: any) => computeGenericAuditScoreSafe(db, userId, a.id)))
  ).filter((s: number | null): s is number => s !== null);

  const averageAuditScore =
    computedScores.length > 0
      ? computedScores.reduce((sum: number, s: number) => sum + s, 0) / computedScores.length
      : 0;

  const globalConformityRate = averageAuditScore;
  const computedProgress = (
    await Promise.all(userAudits.map((a: any) => computeGenericAuditProgressSafe(db, userId, a.id)))
  ).filter(Boolean) as Array<{ percentage: number; isComplete: boolean }>;
  const averageProgression = computedProgress.length
    ? computedProgress.reduce((sum, item) => sum + item.percentage, 0) / computedProgress.length
    : 0;
  const actuallyCompleteAudits = computedProgress.filter((item) => item.isComplete).length;

  const userFindings = await db
    .select()
    .from(findings)
    .where(inArray(findings.auditId, auditIds));

  const findingsByCriticality = {
    critical: userFindings.filter((f: any) => f.severity === "critical").length,
    high: userFindings.filter((f: any) => f.severity === "high").length,
    medium: userFindings.filter((f: any) => f.severity === "medium").length,
    low: userFindings.filter((f: any) => f.severity === "low").length,
  };

  const findingTypes = userFindings.map((f: any) => mapSeverityToFindingType(f.severity));
  const findingsByStatus = {
    open: userFindings.filter((f: any) => f.status === "open").length,
    in_progress: userFindings.filter((f: any) => f.status === "in_progress").length,
    closed: userFindings.filter((f: any) => f.status === "closed").length,
  };
  const findingsByType = {
    nc_major: findingTypes.filter((t: string) => t === "nc_major").length,
    nc_minor: findingTypes.filter((t: string) => t === "nc_minor").length,
    observation: findingTypes.filter((t: string) => t === "observation").length,
    ofi: findingTypes.filter((t: string) => t === "ofi").length,
    positive: 0, // `findings` ne distingue pas les constats positifs — jamais fabriqué
  };

  // `findings` n'a pas de `processId` — le regroupement par processus n'est
  // pas calculable depuis cette table (elle n'a jamais eu cette colonne, voir
  // drizzle/schema.ts). Section omise plutôt que remplie de valeurs inventées.
  const topRiskyProcesses: Array<{
    processId: number;
    processName: string;
    ncCount: number;
    criticalCount: number;
    riskScore: number;
  }> = [];

  const findingIds = userFindings.map((f: any) => f.id);
  const userActions = findingIds.length > 0
    ? await db.select().from(actions).where(inArray(actions.findingId, findingIds))
    : [];

  const actionsByStatus = {
    open: userActions.filter((a: any) => a.status === "open").length,
    in_progress: userActions.filter((a: any) => a.status === "in_progress").length,
    closed: userActions.filter((a: any) => a.status === "closed").length,
  };

  const now = new Date();
  const overdueActions = userActions.filter(
    (a: any) => a.dueDate && a.dueDate < now && a.status !== "closed"
  ).length;

  const overduePercentage = userActions.length > 0 ? (overdueActions / userActions.length) * 100 : 0;

  const closedActions = userActions.filter((a: any) => a.status === "closed" && a.updatedAt && a.createdAt);
  const averageClosureTime =
    closedActions.length > 0
      ? closedActions.reduce((sum: number, a: any) => {
          const days = Math.floor(
            (a.updatedAt.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }, 0) / closedActions.length
      : 0;

  return {
    totalAudits: userAudits.length,
    auditsByStatus,
    globalConformityRate: Math.round(globalConformityRate * 10) / 10,
    averageAuditScore: Math.round(averageAuditScore * 10) / 10,
    totalFindings: userFindings.length,
    findingsByCriticality,
    findingsByStatus,
    findingsByType,
    topRiskyProcesses,
    totalActions: userActions.length,
    actionsByStatus,
    overdueActions,
    overduePercentage: Math.round(overduePercentage * 10) / 10,
    averageClosureTime: Math.round(averageClosureTime * 10) / 10,
    averageProgression: Math.round(averageProgression * 10) / 10,
    actuallyCompleteAudits,
  };
}

/** GET STATS - utilisé par dashboard.getKPIs (réel). */
export async function getDashboardStats(userId: number, filters?: DashboardFilters) {
  return await getDashboardSummary(userId, filters);
}

/**
 * GET DRILLDOWN ("findings" uniquement) - utilisé par dashboard.getRecentFindings
 * (réel, widget "Constats récents" de Dashboard.tsx).
 *
 * Les branches "actions" et "audits" ont été supprimées avec la suppression de
 * dashboard.getDrilldown (procédure directe, appelée uniquement par
 * DrilldownModal.tsx/DashboardV2.tsx, jamais routés) — elles référençaient
 * des colonnes fantômes (`actions.title`, `actions.priority`,
 * `actions.responsibleName`, `audits.auditType`).
 */
export async function getDashboardDrilldown(
  userId: number,
  type: "findings",
  filters: Record<string, any>,
  pagination: { page: number; pageSize: number },
  sort: { field: string; order: "asc" | "desc" }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const userAudits = await db.select().from(audits).where(eq(audits.userId, userId));
  const auditIds = userAudits.map((a: any) => a.id);
  if (auditIds.length === 0) {
    return { data: [], total: 0, page, pageSize };
  }

  const conditions: any[] = [inArray(findings.auditId, auditIds)];

  if (filters.status) {
    conditions.push(eq(findings.status, filters.status));
  }

  const allMatching = await db
    .select()
    .from(findings)
    .where(and(...conditions));

  const total = allMatching.length;

  const sorted = [...allMatching].sort((a: any, b: any) => {
    const field = sort.field === "date" ? "createdAt" : sort.field;
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    const cmp = av > bv ? 1 : -1;
    return sort.order === "asc" ? cmp : -cmp;
  });

  const data = sorted.slice(offset, offset + pageSize);

  const formattedData = data.map((f: any) => ({
    id: f.id,
    code: `FIND-${String(f.id).padStart(4, "0")}`,
    title: f.title || `Constat #${f.id}`,
    type: mapSeverityToFindingType(f.severity),
    criticality: f.severity || "N/A",
    status: f.status || "",
    processName: "", // `findings` n'a pas de processId — non renseigné plutôt qu'inventé
    referentialName: "",
    date: f.createdAt,
    owner: "",
    dueDate: null,
  }));

  return { data: formattedData, total, page, pageSize };
}
