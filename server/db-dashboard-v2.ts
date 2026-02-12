/**
 * Dashboard V2 - Fonctions d'agrégation basées sur les audits formels
 * Remplace db-dashboard.ts qui utilisait audit_responses
 */

import { getDb } from "./db";
import { 
  audits, 
  findings, 
  actions, 
  auditChecklistAnswers,
  sites,
  processus,
  referentiels,
  questions
} from "../drizzle/schema";
import { eq, and, sql, desc, gte, lte, inArray, or } from "drizzle-orm";

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

/**
 * Helper: Build WHERE conditions from filters
 */
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

function buildFindingFilters(filters?: DashboardFilters) {
  const conditions: any[] = [];
  
  if (filters?.criticality && filters.criticality !== "all") {
    conditions.push(eq(findings.criticality, filters.criticality));
  }
  
  return conditions;
}

/**
 * 1. GET SUMMARY - KPIs macro avec filtres
 */
export async function getDashboardSummary(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const auditConditions = buildAuditFilters(userId, filters);
  
  // Get all audits matching filters
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));
  
  const auditIds = userAudits.map(a => a.id);
  
  if (auditIds.length === 0) {
    return {
      totalAudits: 0,
      auditsByStatus: { draft: 0, in_progress: 0, completed: 0, closed: 0 },
      globalConformityRate: 0,
      averageAuditScore: 0,
      totalFindings: 0,
      findingsByCriticality: { critical: 0, high: 0, medium: 0, low: 0 },
      findingsByType: { nc_major: 0, nc_minor: 0, observation: 0, ofi: 0, positive: 0 },
      topRiskyProcesses: [],
      totalActions: 0,
      actionsByStatus: { open: 0, in_progress: 0, completed: 0, verified: 0, cancelled: 0 },
      overdueActions: 0,
      overduePercentage: 0,
      averageClosureTime: 0
    };
  }
  
  // Count audits by status
  const auditsByStatus = {
    draft: userAudits.filter(a => a.status === "draft").length,
    in_progress: userAudits.filter(a => a.status === "in_progress").length,
    completed: userAudits.filter(a => a.status === "completed").length,
    closed: userAudits.filter(a => a.status === "closed").length
  };
  
  // Calculate average score and conformity rate
  const scoresAndRates = userAudits
    .filter(a => a.score && a.conformityRate)
    .map(a => ({
      score: parseFloat(a.score!),
      conformityRate: parseFloat(a.conformityRate!)
    }));
  
  const averageAuditScore = scoresAndRates.length > 0
    ? scoresAndRates.reduce((sum, s) => sum + s.score, 0) / scoresAndRates.length
    : 0;
  
  const globalConformityRate = scoresAndRates.length > 0
    ? scoresAndRates.reduce((sum, s) => sum + s.conformityRate, 0) / scoresAndRates.length
    : 0;
  
  // Get findings for these audits
  const findingConditions = buildFindingFilters(filters);
  const userFindings = await db
    .select()
    .from(findings)
    .where(and(
      inArray(findings.auditId, auditIds),
      ...findingConditions
    ));
  
  // Count findings by criticality
  const findingsByCriticality = {
    critical: userFindings.filter(f => f.criticality === "critical").length,
    high: userFindings.filter(f => f.criticality === "high").length,
    medium: userFindings.filter(f => f.criticality === "medium").length,
    low: userFindings.filter(f => f.criticality === "low").length
  };
  
  // Count findings by type
  const findingsByType = {
    nc_major: userFindings.filter(f => f.findingType === "nc_major").length,
    nc_minor: userFindings.filter(f => f.findingType === "nc_minor").length,
    observation: userFindings.filter(f => f.findingType === "observation").length,
    ofi: userFindings.filter(f => f.findingType === "ofi").length,
    positive: userFindings.filter(f => f.findingType === "positive").length
  };
  
  // Get top 5 risky processes
  const processRisks = new Map<number, { count: number; criticalCount: number; riskScore: number }>();
  
  for (const finding of userFindings) {
    if (!finding.processId) continue;
    
    const current = processRisks.get(finding.processId) || { count: 0, criticalCount: 0, riskScore: 0 };
    current.count++;
    
    if (finding.criticality === "critical") {
      current.criticalCount++;
      current.riskScore += 100;
    } else if (finding.criticality === "high") {
      current.riskScore += 50;
    } else if (finding.criticality === "medium") {
      current.riskScore += 25;
    } else {
      current.riskScore += 10;
    }
    
    processRisks.set(finding.processId, current);
  }
  
  // Get process names
  const processIds = Array.from(processRisks.keys());
  const processData = processIds.length > 0
    ? await db.select().from(processus).where(inArray(processus.id, processIds))
    : [];
  
  const topRiskyProcesses = Array.from(processRisks.entries())
    .map(([processId, risk]) => ({
      processId,
      processName: processData.find(p => p.id === processId)?.name || `Process ${processId}`,
      ncCount: risk.count,
      criticalCount: risk.criticalCount,
      riskScore: risk.riskScore
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
  
  // Get actions for these findings
  const findingIds = userFindings.map(f => f.id);
  const userActions = findingIds.length > 0
    ? await db.select().from(actions).where(inArray(actions.findingId, findingIds))
    : [];
  
  // Count actions by status
  const actionsByStatus = {
    open: userActions.filter(a => a.status === "open").length,
    in_progress: userActions.filter(a => a.status === "in_progress").length,
    completed: userActions.filter(a => a.status === "completed").length,
    verified: userActions.filter(a => a.status === "verified").length,
    cancelled: userActions.filter(a => a.status === "cancelled").length
  };
  
  // Calculate overdue actions
  const now = new Date();
  const overdueActions = userActions.filter(a => 
    a.dueDate && 
    a.dueDate < now && 
    a.status !== "completed" && 
    a.status !== "verified" && 
    a.status !== "cancelled"
  ).length;
  
  const overduePercentage = userActions.length > 0
    ? (overdueActions / userActions.length) * 100
    : 0;
  
  // Calculate average closure time (in days)
  const completedActions = userActions.filter(a => 
    a.completedAt && 
    a.createdAt
  );
  
  const averageClosureTime = completedActions.length > 0
    ? completedActions.reduce((sum, a) => {
        const days = Math.floor((a.completedAt!.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / completedActions.length
    : 0;
  
  return {
    totalAudits: userAudits.length,
    auditsByStatus,
    globalConformityRate: Math.round(globalConformityRate * 10) / 10,
    averageAuditScore: Math.round(averageAuditScore * 10) / 10,
    totalFindings: userFindings.length,
    findingsByCriticality,
    findingsByType,
    topRiskyProcesses,
    totalActions: userActions.length,
    actionsByStatus,
    overdueActions,
    overduePercentage: Math.round(overduePercentage * 10) / 10,
    averageClosureTime: Math.round(averageClosureTime * 10) / 10
  };
}

/**
 * 2. GET FUNNEL - Données pour graphique entonnoir
 */
export async function getDashboardFunnel(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const auditConditions = buildAuditFilters(userId, filters);
  
  // Get audits
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));
  
  const auditIds = userAudits.map(a => a.id);
  
  if (auditIds.length === 0) {
    return {
      stages: [
        { name: "Audits", count: 0 },
        { name: "Constats", count: 0 },
        { name: "Non-conformités", count: 0 },
        { name: "Actions", count: 0 },
        { name: "Actions clôturées", count: 0 }
      ],
      conversionRates: {
        auditsToFindings: 0,
        findingsToNC: 0,
        ncToActions: 0,
        actionsToCompleted: 0
      }
    };
  }
  
  // Get findings
  const userFindings = await db
    .select()
    .from(findings)
    .where(inArray(findings.auditId, auditIds));
  
  // Count NC (major + minor)
  const ncFindings = userFindings.filter(f => 
    f.findingType === "nc_major" || f.findingType === "nc_minor"
  );
  
  // Get actions
  const findingIds = userFindings.map(f => f.id);
  const userActions = findingIds.length > 0
    ? await db.select().from(actions).where(inArray(actions.findingId, findingIds))
    : [];
  
  // Count completed actions
  const completedActions = userActions.filter(a => 
    a.status === "completed" || a.status === "verified"
  );
  
  // Calculate conversion rates
  const auditsToFindings = userAudits.length > 0
    ? (userFindings.length / userAudits.length) * 100
    : 0;
  
  const findingsToNC = userFindings.length > 0
    ? (ncFindings.length / userFindings.length) * 100
    : 0;
  
  const ncToActions = ncFindings.length > 0
    ? (userActions.length / ncFindings.length) * 100
    : 0;
  
  const actionsToCompleted = userActions.length > 0
    ? (completedActions.length / userActions.length) * 100
    : 0;
  
  return {
    stages: [
      { name: "Audits", count: userAudits.length },
      { name: "Constats", count: userFindings.length },
      { name: "Non-conformités", count: ncFindings.length },
      { name: "Actions", count: userActions.length },
      { name: "Actions clôturées", count: completedActions.length }
    ],
    conversionRates: {
      auditsToFindings: Math.round(auditsToFindings * 10) / 10,
      findingsToNC: Math.round(findingsToNC * 10) / 10,
      ncToActions: Math.round(ncToActions * 10) / 10,
      actionsToCompleted: Math.round(actionsToCompleted * 10) / 10
    }
  };
}

/**
 * 3. GET TIMESERIES - Évolution temporelle sur 12 mois
 */
export async function getDashboardTimeseries(
  userId: number, 
  filters?: DashboardFilters,
  granularity: "month" | "week" = "month"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Default period: last 12 months
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  
  const periodFilters = {
    ...filters,
    period: filters?.period || {
      start: twelveMonthsAgo,
      end: now
    }
  };
  
  const auditConditions = buildAuditFilters(userId, periodFilters);
  
  // Get audits
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions))
    .orderBy(audits.startDate);
  
  const auditIds = userAudits.map(a => a.id);
  
  // Get findings
  const userFindings = auditIds.length > 0
    ? await db.select().from(findings).where(inArray(findings.auditId, auditIds))
    : [];
  
  // Get actions
  const findingIds = userFindings.map(f => f.id);
  const userActions = findingIds.length > 0
    ? await db.select().from(actions).where(inArray(actions.findingId, findingIds))
    : [];
  
  // Group by period
  const timeseriesMap = new Map<string, {
    auditsCount: number;
    totalScore: number;
    totalConformityRate: number;
    findingsCount: number;
    ncMajorCount: number;
    ncMinorCount: number;
    actionsCreated: number;
    actionsCompleted: number;
  }>();
  
  // Process audits
  for (const audit of userAudits) {
    if (!audit.startDate) continue;
    
    const period = granularity === "month"
      ? audit.startDate.toISOString().slice(0, 7) // "2025-08"
      : `${audit.startDate.getFullYear()}-W${Math.ceil((audit.startDate.getDate()) / 7)}`; // "2025-W32"
    
    const current = timeseriesMap.get(period) || {
      auditsCount: 0,
      totalScore: 0,
      totalConformityRate: 0,
      findingsCount: 0,
      ncMajorCount: 0,
      ncMinorCount: 0,
      actionsCreated: 0,
      actionsCompleted: 0
    };
    
    current.auditsCount++;
    if (audit.score) current.totalScore += parseFloat(audit.score);
    if (audit.conformityRate) current.totalConformityRate += parseFloat(audit.conformityRate);
    
    timeseriesMap.set(period, current);
  }
  
  // Process findings
  for (const finding of userFindings) {
    const audit = userAudits.find(a => a.id === finding.auditId);
    if (!audit || !audit.startDate) continue;
    
    const period = granularity === "month"
      ? audit.startDate.toISOString().slice(0, 7)
      : `${audit.startDate.getFullYear()}-W${Math.ceil((audit.startDate.getDate()) / 7)}`;
    
    const current = timeseriesMap.get(period);
    if (!current) continue;
    
    current.findingsCount++;
    if (finding.findingType === "nc_major") current.ncMajorCount++;
    if (finding.findingType === "nc_minor") current.ncMinorCount++;
  }
  
  // Process actions
  for (const action of userActions) {
    const finding = userFindings.find(f => f.id === action.findingId);
    if (!finding) continue;
    
    const audit = userAudits.find(a => a.id === finding.auditId);
    if (!audit || !audit.startDate) continue;
    
    const period = granularity === "month"
      ? audit.startDate.toISOString().slice(0, 7)
      : `${audit.startDate.getFullYear()}-W${Math.ceil((audit.startDate.getDate()) / 7)}`;
    
    const current = timeseriesMap.get(period);
    if (!current) continue;
    
    current.actionsCreated++;
    if (action.status === "completed" || action.status === "verified") {
      current.actionsCompleted++;
    }
  }
  
  // Convert to array and calculate averages
  const timeseries = Array.from(timeseriesMap.entries())
    .map(([period, data]) => ({
      period,
      auditsCount: data.auditsCount,
      averageScore: data.auditsCount > 0 
        ? Math.round((data.totalScore / data.auditsCount) * 10) / 10 
        : 0,
      conformityRate: data.auditsCount > 0 
        ? Math.round((data.totalConformityRate / data.auditsCount) * 10) / 10 
        : 0,
      findingsCount: data.findingsCount,
      ncMajorCount: data.ncMajorCount,
      ncMinorCount: data.ncMinorCount,
      actionsCreated: data.actionsCreated,
      actionsCompleted: data.actionsCompleted
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
  
  return { timeseries };
}

/**
 * 4. GET HEATMAP - Processus vs criticité
 */
export async function getDashboardHeatmap(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const auditConditions = buildAuditFilters(userId, filters);
  
  // Get audits
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));
  
  const auditIds = userAudits.map(a => a.id);
  
  if (auditIds.length === 0) {
    return { heatmap: [] };
  }
  
  // Get findings
  const userFindings = await db
    .select()
    .from(findings)
    .where(inArray(findings.auditId, auditIds));
  
  // Group by process
  const processMap = new Map<number, {
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>();
  
  for (const finding of userFindings) {
    if (!finding.processId) continue;
    
    const current = processMap.get(finding.processId) || {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    if (finding.criticality === "critical") current.critical++;
    else if (finding.criticality === "high") current.high++;
    else if (finding.criticality === "medium") current.medium++;
    else if (finding.criticality === "low") current.low++;
    
    processMap.set(finding.processId, current);
  }
  
  // Get process names
  const processIds = Array.from(processMap.keys());
  const processData = processIds.length > 0
    ? await db.select().from(processus).where(inArray(processus.id, processIds))
    : [];
  
  // Build heatmap
  const heatmap = Array.from(processMap.entries())
    .map(([processId, counts]) => ({
      processId,
      processName: processData.find(p => p.id === processId)?.name || `Process ${processId}`,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
      total: counts.critical + counts.high + counts.medium + counts.low
    }))
    .sort((a, b) => b.total - a.total);
  
  return { heatmap };
}

/**
 * 5. GET RADAR - 7 dimensions
 */

// Mapping processus → dimensions (à adapter selon les IDs réels)
const PROCESS_DIMENSION_MAPPING: Record<string, number[]> = {
  "Conformité documentaire": [1, 2, 3, 4, 5], // Documentation, Dossier technique, etc.
  "Conformité terrain": [6, 7, 8, 9, 10], // Production, Contrôle qualité, etc.
  "Gestion des risques": [11, 12, 13], // Analyse de risques, ISO 14971
  "Traçabilité / UDI": [14, 15, 16], // Traçabilité, UDI, Étiquetage
  "PMS / Vigilance": [17, 18, 19], // PMS, Vigilance, PSUR
  "Fournisseurs": [20, 21, 22], // Achats, Qualification fournisseurs
  "IT / Cybersécurité": [23, 24, 25] // IT, Cybersécurité, MDR Annexe I
};

export async function getDashboardRadar(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const auditConditions = buildAuditFilters(userId, filters);
  
  // Get audits
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));
  
  const auditIds = userAudits.map(a => a.id);
  
  if (auditIds.length === 0) {
    return {
      dimensions: Object.keys(PROCESS_DIMENSION_MAPPING).map(name => ({
        name,
        score: 0,
        description: "Aucune donnée disponible",
        drilldownData: {
          totalQuestions: 0,
          conformeCount: 0,
          ncCount: 0
        }
      }))
    };
  }
  
  // Get findings
  const userFindings = await db
    .select()
    .from(findings)
    .where(inArray(findings.auditId, auditIds));
  
  // Calculate score for each dimension
  const dimensions = [];
  
  for (const [dimensionName, processIds] of Object.entries(PROCESS_DIMENSION_MAPPING)) {
    // Get findings for this dimension
    const dimensionFindings = userFindings.filter(f => 
      f.processId && processIds.includes(f.processId)
    );
    
    // Get audits that cover these processes
    const dimensionAudits = userAudits.filter(a => {
      if (!a.processIds) return false;
      try {
        const auditProcessIds = JSON.parse(a.processIds as string);
        return auditProcessIds.some((id: number) => processIds.includes(id));
      } catch {
        return false;
      }
    });
    
    // Calculate base score (average of audit scores)
    let baseScore = 100;
    if (dimensionAudits.length > 0) {
      const scores = dimensionAudits
        .filter(a => a.score)
        .map(a => parseFloat(a.score!));
      
      if (scores.length > 0) {
        baseScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
    }
    
    // Apply penalties
    let penalties = 0;
    const ncMajorCount = dimensionFindings.filter(f => f.findingType === "nc_major").length;
    const ncMinorCount = dimensionFindings.filter(f => f.findingType === "nc_minor").length;
    
    penalties += ncMajorCount * 20; // -20 points per major NC
    penalties += ncMinorCount * 10; // -10 points per minor NC
    
    // Final score (0-100)
    const finalScore = Math.max(0, Math.min(100, baseScore - penalties));
    
    dimensions.push({
      name: dimensionName,
      score: Math.round(finalScore * 10) / 10,
      description: `${dimensionFindings.length} constats identifiés (${ncMajorCount} NC majeures, ${ncMinorCount} NC mineures)`,
      drilldownData: {
        totalQuestions: dimensionAudits.length * 10, // Estimation
        conformeCount: dimensionAudits.length * 8, // Estimation
        ncCount: ncMajorCount + ncMinorCount
      }
    });
  }
  
  return { dimensions };
}

/**
 * 6. GET DRILLDOWN - Navigation détaillée
 */
export async function getDashboardDrilldown(
  userId: number,
  type: "findings" | "actions" | "audits",
  filters: Record<string, any>,
  pagination: { page: number; pageSize: number },
  sort: { field: string; order: "asc" | "desc" }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;
  
  if (type === "findings") {
    // Build conditions
    const conditions: any[] = [];
    
    // Get user's audits first
    const userAudits = await db
      .select()
      .from(audits)
      .where(eq(audits.userId, userId));
    
    const auditIds = userAudits.map(a => a.id);
    if (auditIds.length === 0) {
      return { data: [], total: 0, page, pageSize };
    }
    
    conditions.push(inArray(findings.auditId, auditIds));
    
    if (filters.processId) {
      const processId = typeof filters.processId === 'string' 
        ? parseInt(filters.processId, 10) 
        : filters.processId;
      console.log('[Drilldown] Filtering by processId:', processId, 'type:', typeof processId);
      conditions.push(eq(findings.processId, processId));
    }
    if (filters.criticality) {
      conditions.push(eq(findings.criticality, filters.criticality));
    }
    if (filters.status) {
      conditions.push(eq(findings.status, filters.status));
    }
    if (filters.findingType) {
      conditions.push(eq(findings.findingType, filters.findingType));
    }
    
    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(findings)
      .where(and(...conditions));
    
    const total = Number(totalResult[0]?.count || 0);
    
    // Get paginated data
    const data = await db
      .select()
      .from(findings)
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset);
    
    // Get related data (processes, referentials)
    const processIds = [...new Set(data.map(f => f.processId).filter(Boolean))];
    const referentialIds = [...new Set(data.map(f => f.referentialId).filter(Boolean))];
    
    const processData = processIds.length > 0
    ? await db.select().from(processus).where(inArray(processus.id, processIds))
    : [];
    const referentialData = referentialIds.length > 0
    ? await db.select().from(referentiels).where(inArray(referentiels.id, referentialIds))
    : [];
    // Format response
    const formattedData = data.map(f => ({
      id: f.id,
      code: f.findingCode || "",
      title: f.title || "",
      type: f.findingType || "",
      criticality: f.criticality || "",
      status: f.status || "",
      processName: processData.find(p => p.id === f.processId)?.name || "",
      referentialName: referentialData.find(r => r.id === f.referentialId)?.name || "",
      date: f.createdAt,
      owner: "", // Not stored in findings
      dueDate: null
    }));
    
    return { data: formattedData, total, page, pageSize };
  }
  
  if (type === "actions") {
    // Get user's findings first
    const userAudits = await db
      .select()
      .from(audits)
      .where(eq(audits.userId, userId));
    
    const auditIds = userAudits.map(a => a.id);
    if (auditIds.length === 0) {
      return { data: [], total: 0, page, pageSize };
    }
    
    const userFindings = await db
      .select()
      .from(findings)
      .where(inArray(findings.auditId, auditIds));
    
    const findingIds = userFindings.map(f => f.id);
    if (findingIds.length === 0) {
      return { data: [], total: 0, page, pageSize };
    }
    
    // Build conditions
    const conditions: any[] = [inArray(actions.findingId, findingIds)];
    
    if (filters.status) {
      conditions.push(eq(actions.status, filters.status));
    }
    if (filters.priority) {
      conditions.push(eq(actions.priority, filters.priority));
    }
    
    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(actions)
      .where(and(...conditions));
    
    const total = Number(totalResult[0]?.count || 0);
    
    // Get paginated data
    const data = await db
      .select()
      .from(actions)
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset);
    
    // Get related findings
    const relatedFindings = await db
      .select()
      .from(findings)
      .where(inArray(findings.id, data.map(a => a.findingId)));
    
    // Get processes
    const processIds = [...new Set(relatedFindings.map(f => f.processId).filter(Boolean))];
    const processData = processIds.length > 0
      ? await db.select().from(processes).where(inArray(processes.id, processIds as number[]))
      : [];
    
    // Format response
    const formattedData = data.map(a => {
      const finding = relatedFindings.find(f => f.id === a.findingId);
      return {
        id: a.id,
        code: a.actionCode || "",
        title: a.title || "",
        type: a.actionType || "",
        criticality: a.priority || "",
        status: a.status || "",
        processName: processData.find(p => p.id === finding?.processId)?.name || "",
        referentialName: "",
        date: a.createdAt,
        owner: a.responsibleName || "",
        dueDate: a.dueDate
      };
    });
    
    return { data: formattedData, total, page, pageSize };
  }
  
  // type === "audits"
  const conditions: any[] = [eq(audits.userId, userId)];
  
  if (filters.status) {
    conditions.push(eq(audits.status, filters.status));
  }
  if (filters.siteId) {
    conditions.push(eq(audits.siteId, filters.siteId));
  }
  
  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(audits)
    .where(and(...conditions));
  
  const total = Number(totalResult[0]?.count || 0);
  
  // Get paginated data
  const data = await db
    .select()
    .from(audits)
    .where(and(...conditions))
    .limit(pageSize)
    .offset(offset);
  
  // Get sites
  const siteIds = [...new Set(data.map(a => a.siteId).filter(Boolean))];
  const siteData = siteIds.length > 0
    ? await db.select().from(sites).where(inArray(sites.id, siteIds as number[]))
    : [];
  
  // Format response
  const formattedData = data.map(a => ({
    id: a.id,
    code: "", // Audits don't have codes
    title: a.name || "",
    type: a.auditType || "",
    criticality: "", // Not applicable
    status: a.status || "",
    processName: siteData.find(s => s.id === a.siteId)?.name || "",
    referentialName: "",
    date: a.startDate,
    owner: a.auditorName || "",
    dueDate: a.endDate
  }));
  
  return { data: formattedData, total, page, pageSize };
}

/**
 * 7. GET SCORING - Scores par processus avec pénalités
 */
export async function getDashboardScoring(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const auditConditions = buildAuditFilters(userId, filters);
  
  // Get audits
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));
  
  const auditIds = userAudits.map(a => a.id);
  
  if (auditIds.length === 0) {
    return { processScores: [] };
  }
  
  // Get findings
  const userFindings = await db
    .select()
    .from(findings)
    .where(inArray(findings.auditId, auditIds));
  
  // Get actions
  const findingIds = userFindings.map(f => f.id);
  const userActions = findingIds.length > 0
    ? await db.select().from(actions).where(inArray(actions.findingId, findingIds))
    : [];
  
  // Group by process
  const processScoresMap = new Map<number, {
    auditsCount: number;
    totalScore: number;
    findingsCount: number;
    ncMajorCount: number;
    ncMinorCount: number;
    actionsCount: number;
    overdueActionsCount: number;
  }>();
  
  // Process audits
  for (const audit of userAudits) {
    if (!audit.processIds) continue;
    
    try {
      const auditProcessIds = JSON.parse(audit.processIds as string) as number[];
      const auditScore = audit.score ? parseFloat(audit.score) : 0;
      
      for (const processId of auditProcessIds) {
        const current = processScoresMap.get(processId) || {
          auditsCount: 0,
          totalScore: 0,
          findingsCount: 0,
          ncMajorCount: 0,
          ncMinorCount: 0,
          actionsCount: 0,
          overdueActionsCount: 0
        };
        
        current.auditsCount++;
        current.totalScore += auditScore;
        
        processScoresMap.set(processId, current);
      }
    } catch {
      // Skip invalid JSON
    }
  }
  
  // Process findings
  for (const finding of userFindings) {
    if (!finding.processId) continue;
    
    const current = processScoresMap.get(finding.processId);
    if (!current) continue;
    
    current.findingsCount++;
    if (finding.findingType === "nc_major") current.ncMajorCount++;
    if (finding.findingType === "nc_minor") current.ncMinorCount++;
  }
  
  // Process actions
  const now = new Date();
  for (const action of userActions) {
    const finding = userFindings.find(f => f.id === action.findingId);
    if (!finding || !finding.processId) continue;
    
    const current = processScoresMap.get(finding.processId);
    if (!current) continue;
    
    current.actionsCount++;
    
    if (action.dueDate && 
        action.dueDate < now && 
        action.status !== "completed" && 
        action.status !== "verified" &&
        action.status !== "cancelled") {
      current.overdueActionsCount++;
    }
  }
  
  // Get process names
  const processIds = Array.from(processScoresMap.keys());
  const processData = processIds.length > 0
    ? await db.select().from(processus).where(inArray(processus.id, processIds))
    : [];
  
  // Calculate final scores
  const processScores = Array.from(processScoresMap.entries())
    .map(([processId, data]) => {
      const baseScore = data.auditsCount > 0
        ? data.totalScore / data.auditsCount
        : 0;
      
      const ncMajorPenalty = data.ncMajorCount * 20;
      const ncMinorPenalty = data.ncMinorCount * 10;
      const overduePenalty = data.overdueActionsCount * 5;
      
      const totalPenalties = ncMajorPenalty + ncMinorPenalty + overduePenalty;
      const finalScore = Math.max(0, baseScore - totalPenalties);
      
      return {
        processId,
        processName: processData.find(p => p.id === processId)?.name || `Process ${processId}`,
        score: Math.round(finalScore * 10) / 10,
        baseScore: Math.round(baseScore * 10) / 10,
        penalties: {
          ncMajor: ncMajorPenalty,
          ncMinor: ncMinorPenalty,
          overdueActions: overduePenalty
        },
        details: {
          auditsCount: data.auditsCount,
          findingsCount: data.findingsCount,
          actionsCount: data.actionsCount,
          overdueActionsCount: data.overdueActionsCount
        }
      };
    })
    .sort((a, b) => a.score - b.score); // Sort by score ascending (worst first)
  
  return { processScores };
}

/**
 * 8. GET SUGGESTIONS - Suggestions automatiques de plan d'action
 */export async function getDashboardReferentiels(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get scoring first
  const { processScores } = await getDashboardScoring(userId, filters);
  
  // Get the 3 worst processes
  const worstProcesses = processScores.slice(0, 3);
  
  if (worstProcesses.length === 0) {
    return { suggestions: [] };
  }
  
  const auditConditions = buildAuditFilters(userId, filters);
  
  // Get audits
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));
  
  const auditIds = userAudits.map(a => a.id);
  
  // Get findings for these processes
  const userFindings = auditIds.length > 0
    ? await db.select().from(findings).where(inArray(findings.auditId, auditIds))
    : [];
  
  const suggestions = [];
  
  for (const process of worstProcesses) {
    const processFindings = userFindings.filter(f => f.processId === process.processId);
    
    const ncMajor = processFindings.filter(f => f.findingType === "nc_major");
    const ncMinor = processFindings.filter(f => f.findingType === "nc_minor");
    const observations = processFindings.filter(f => f.findingType === "observation");
    
    // Determine priority
    let priority: "critical" | "high" | "medium" = "medium";
    if (ncMajor.length > 0) priority = "critical";
    else if (ncMinor.length > 2) priority = "high";
    
    // Generate issue description
    let issue = "";
    if (ncMajor.length > 0) {
      issue = `${ncMajor.length} non-conformité(s) majeure(s) identifiée(s) nécessitant une action corrective immédiate.`;
    } else if (ncMinor.length > 0) {
      issue = `${ncMinor.length} non-conformité(s) mineure(s) identifiée(s) nécessitant une action corrective.`;
    } else if (observations.length > 0) {
      issue = `${observations.length} observation(s) identifiée(s) pouvant évoluer en non-conformité.`;
    } else {
      issue = `Score faible (${process.score}/100) nécessitant une amélioration continue.`;
    }
    
    // Generate recommended actions
    const recommendedActions = [];
    
    if (ncMajor.length > 0) {
      recommendedActions.push({
        title: "Traiter les non-conformités majeures",
        description: "Mettre en place des actions correctives immédiates pour les NC majeures identifiées",
        actionType: "corrective" as const,
        suggestedOwner: "Responsable Qualité",
        suggestedDeadline: 30,
        expectedEvidence: [
          "Analyse de cause racine",
          "Plan d'action corrective",
          "Preuve de mise en œuvre",
          "Vérification d'efficacité"
        ]
      });
    }
    
    if (ncMinor.length > 0) {
      recommendedActions.push({
        title: "Traiter les non-conformités mineures",
        description: "Mettre en place des actions correctives pour les NC mineures",
        actionType: "corrective" as const,
        suggestedOwner: "Responsable de processus",
        suggestedDeadline: 60,
        expectedEvidence: [
          "Analyse de cause",
          "Plan d'action",
          "Preuve de mise en œuvre"
        ]
      });
    }
    
    if (observations.length > 2) {
      recommendedActions.push({
        title: "Mettre en place des actions préventives",
        description: "Éviter que les observations n'évoluent en non-conformités",
        actionType: "preventive" as const,
        suggestedOwner: "Responsable de processus",
        suggestedDeadline: 90,
        expectedEvidence: [
          "Analyse de tendance",
          "Plan d'amélioration",
          "Indicateurs de suivi"
        ]
      });
    }
    
    if (process.details.overdueActionsCount > 0) {
      recommendedActions.push({
        title: "Clôturer les actions en retard",
        description: `${process.details.overdueActionsCount} action(s) en retard nécessitent une attention immédiate`,
        actionType: "corrective" as const,
        suggestedOwner: "Responsable Qualité",
        suggestedDeadline: 15,
        expectedEvidence: [
          "Preuve de réalisation",
          "Vérification d'efficacité"
        ]
      });
    }
    
    // Rationale
    const rationale = `Ce processus présente un score de ${process.score}/100 avec ${process.details.findingsCount} constat(s) identifié(s). Les pénalités appliquées sont : NC majeures (-${process.penalties.ncMajor} points), NC mineures (-${process.penalties.ncMinor} points), actions en retard (-${process.penalties.overdueActions} points).`;
    
    suggestions.push({
      priority,
      processId: process.processId,
      processName: process.processName,
      issue,
      recommendedActions,
      rationale
    });
  }
  
  return { suggestions };
}

export async function getDashboardProcessus(userId: number, filters?: DashboardFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const auditConditions = buildAuditFilters(userId, filters);

  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...auditConditions));

  const auditIds = userAudits.map(a => a.id);

  if (auditIds.length === 0) {
    return [];
  }

  const processIds = [...new Set(userAudits.flatMap(a => a.processIds ? JSON.parse(a.processIds) : []))];

  if (processIds.length === 0) {
    return [];
  }

  const allProcessus = await db.select().from(processus).where(inArray(processus.id, processIds));

    return allProcessus.map(p => ({
    id: p.id,
    name: p.name
  }));
}

export async function getDashboardStats(userId: number, filters?: DashboardFilters) {
  const [summary, funnel] = await Promise.all([
    getDashboardSummary(userId, filters),
    getDashboardFunnel(userId, filters)
  ]);

  return {
    ...summary,
    funnel
  };
}