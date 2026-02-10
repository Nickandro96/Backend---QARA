import { getDb } from "./db";
import { audits, findings, actions, sites, processes, referentials, auditChecklistAnswers, aggMonthlySite } from "../drizzle/schema";
import { eq, and, gte, lte, inArray, sql, desc } from "drizzle-orm";

/**
 * Get KPI metrics for the dashboard
 */
export async function getAnalyticsKPIs(userId: number, filters: {
  startDate?: Date;
  endDate?: Date;
  siteIds?: number[];
  processIds?: number[];
  referentialIds?: number[];
  auditType?: string;
}) {
  const db = getDb();
  
  // Build where conditions
  const conditions = [eq(audits.userId, userId)];
  
  if (filters.startDate) {
    conditions.push(gte(audits.startDate, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(audits.endDate, filters.endDate));
  }
  if (filters.siteIds && filters.siteIds.length > 0) {
    conditions.push(inArray(audits.siteId, filters.siteIds));
  }
  
  // Get audits matching filters
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...conditions));
  
  if (userAudits.length === 0) {
    return {
      globalScore: 0,
      conformityRate: 0,
      ncMajor: 0,
      ncMinor: 0,
      observations: 0,
      ofi: 0,
      actionsOverdue: 0,
      closureRate: 0,
      avgClosureDelay: 0,
      trend: 0,
    };
  }
  
  const auditIds = userAudits.map(a => a.id);
  
  // Get findings for these audits
  const userFindings = await db
    .select()
    .from(findings)
    .where(inArray(findings.auditId, auditIds));
  
  // Get actions for these findings
  const findingIds = userFindings.map(f => f.id);
  const userActions = findingIds.length > 0
    ? await db.select().from(actions).where(inArray(actions.findingId, findingIds))
    : [];
  
  // Calculate KPIs
  const avgScore = userAudits.reduce((sum, a) => sum + (parseFloat(a.score?.toString() || "0")), 0) / userAudits.length;
  const avgConformity = userAudits.reduce((sum, a) => sum + (parseFloat(a.conformityRate?.toString() || "0")), 0) / userAudits.length;
  
  const ncMajor = userFindings.filter(f => f.findingType === "nc_major").length;
  const ncMinor = userFindings.filter(f => f.findingType === "nc_minor").length;
  const observations = userFindings.filter(f => f.findingType === "observation").length;
  const ofi = userFindings.filter(f => f.findingType === "ofi").length;
  
  const totalActions = userActions.length;
  const closedActions = userActions.filter(a => a.status === "completed" || a.status === "verified").length;
  const overdueActions = userActions.filter(a => 
    a.dueDate && new Date(a.dueDate) < new Date() && a.status !== "completed" && a.status !== "verified"
  ).length;
  
  const closureRate = totalActions > 0 ? (closedActions / totalActions) * 100 : 0;
  
  // Calculate average closure delay (in days)
  const completedActions = userActions.filter(a => a.completedAt && a.createdAt);
  const avgClosureDelay = completedActions.length > 0
    ? completedActions.reduce((sum, a) => {
        const delay = (new Date(a.completedAt!).getTime() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return sum + delay;
      }, 0) / completedActions.length
    : 0;
  
  return {
    globalScore: Math.round(avgScore * 10) / 10,
    conformityRate: Math.round(avgConformity * 10) / 10,
    ncMajor,
    ncMinor,
    observations,
    ofi,
    actionsOverdue: overdueActions,
    closureRate: Math.round(closureRate * 10) / 10,
    avgClosureDelay: Math.round(avgClosureDelay),
    trend: 3.2, // TODO: Calculate real trend vs previous period
  };
}

/**
 * Get site performance data
 */
export async function getSitePerformance(userId: number, filters: any) {
  const db = getDb();
  
  const conditions = [eq(audits.userId, userId)];
  if (filters.startDate) conditions.push(gte(audits.startDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(audits.endDate, filters.endDate));
  
  const userAudits = await db
    .select({
      siteId: audits.siteId,
      siteName: sites.name,
      score: audits.score,
      conformityRate: audits.conformityRate,
    })
    .from(audits)
    .leftJoin(sites, eq(audits.siteId, sites.id))
    .where(and(...conditions));
  
  // Group by site
  const siteMap = new Map<number, { name: string; scores: number[]; conformityRates: number[] }>();
  
  userAudits.forEach(audit => {
    if (!audit.siteId) return;
    
    if (!siteMap.has(audit.siteId)) {
      siteMap.set(audit.siteId, {
        name: audit.siteName || `Site ${audit.siteId}`,
        scores: [],
        conformityRates: [],
      });
    }
    
    const site = siteMap.get(audit.siteId)!;
    if (audit.score) site.scores.push(parseFloat(audit.score.toString()));
    if (audit.conformityRate) site.conformityRates.push(parseFloat(audit.conformityRate.toString()));
  });
  
  return Array.from(siteMap.entries()).map(([siteId, data]) => ({
    siteId,
    siteName: data.name,
    avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    avgConformityRate: data.conformityRates.length > 0 ? data.conformityRates.reduce((a, b) => a + b, 0) / data.conformityRates.length : 0,
    auditCount: data.scores.length,
  }));
}

/**
 * Get process performance data
 */
export async function getProcessPerformance(userId: number, filters: any) {
  const db = getDb();
  
  const conditions = [eq(audits.userId, userId)];
  if (filters.startDate) conditions.push(gte(audits.startDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(audits.endDate, filters.endDate));
  
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...conditions));
  
  const auditIds = userAudits.map(a => a.id);
  if (auditIds.length === 0) return [];
  
  const userFindings = await db
    .select({
      processId: findings.processId,
      processName: processes.name,
      findingType: findings.findingType,
    })
    .from(findings)
    .leftJoin(processes, eq(findings.processId, processes.id))
    .where(inArray(findings.auditId, auditIds));
  
  // Group by process
  const processMap = new Map<number, { name: string; ncMajor: number; ncMinor: number; observations: number }>();
  
  userFindings.forEach(finding => {
    if (!finding.processId) return;
    
    if (!processMap.has(finding.processId)) {
      processMap.set(finding.processId, {
        name: finding.processName || `Process ${finding.processId}`,
        ncMajor: 0,
        ncMinor: 0,
        observations: 0,
      });
    }
    
    const process = processMap.get(finding.processId)!;
    if (finding.findingType === "nc_major") process.ncMajor++;
    if (finding.findingType === "nc_minor") process.ncMinor++;
    if (finding.findingType === "observation") process.observations++;
  });
  
  return Array.from(processMap.entries()).map(([processId, data]) => ({
    processId,
    processName: data.name,
    ncMajor: data.ncMajor,
    ncMinor: data.ncMinor,
    observations: data.observations,
    total: data.ncMajor + data.ncMinor + data.observations,
  }));
}

/**
 * Get findings list with filters
 */
export async function getFilteredFindings(userId: number, filters: any) {
  const db = getDb();
  
  const conditions = [eq(audits.userId, userId)];
  if (filters.startDate) conditions.push(gte(audits.startDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(audits.endDate, filters.endDate));
  
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...conditions));
  
  const auditIds = userAudits.map(a => a.id);
  if (auditIds.length === 0) return [];
  
  const findingConditions = [inArray(findings.auditId, auditIds)];
  if (filters.status) findingConditions.push(eq(findings.status, filters.status));
  if (filters.findingType) findingConditions.push(eq(findings.findingType, filters.findingType));
  
  const userFindings = await db
    .select({
      id: findings.id,
      findingCode: findings.findingCode,
      title: findings.title,
      findingType: findings.findingType,
      status: findings.status,
      clause: findings.clause,
      processName: processes.name,
      siteName: sites.name,
      createdAt: findings.createdAt,
    })
    .from(findings)
    .leftJoin(processes, eq(findings.processId, processes.id))
    .leftJoin(audits, eq(findings.auditId, audits.id))
    .leftJoin(sites, eq(audits.siteId, sites.id))
    .where(and(...findingConditions))
    .orderBy(desc(findings.createdAt))
    .limit(100);
  
  return userFindings;
}

/**
 * Get trend data (monthly evolution)
 */
export async function getTrendData(userId: number, filters: any) {
  const db = getDb();
  
  const conditions = [eq(audits.userId, userId)];
  if (filters.startDate) conditions.push(gte(audits.startDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(audits.endDate, filters.endDate));
  
  const userAudits = await db
    .select({
      startDate: audits.startDate,
      score: audits.score,
      conformityRate: audits.conformityRate,
    })
    .from(audits)
    .where(and(...conditions))
    .orderBy(audits.startDate);
  
  // Group by month
  const monthMap = new Map<string, { scores: number[]; conformityRates: number[] }>();
  
  userAudits.forEach(audit => {
    if (!audit.startDate) return;
    
    const month = audit.startDate.toISOString().substring(0, 7); // "2026-01"
    
    if (!monthMap.has(month)) {
      monthMap.set(month, { scores: [], conformityRates: [] });
    }
    
    const data = monthMap.get(month)!;
    if (audit.score) data.scores.push(parseFloat(audit.score.toString()));
    if (audit.conformityRate) data.conformityRates.push(parseFloat(audit.conformityRate.toString()));
  });
  
  return Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    avgConformityRate: data.conformityRates.length > 0 ? data.conformityRates.reduce((a, b) => a + b, 0) / data.conformityRates.length : 0,
  }));
}

/**
 * Get heatmap data (Site × Process conformity matrix)
 */
export async function getHeatmapData(userId: number, filters: any) {
  const db = getDb();
  
  const conditions = [eq(audits.userId, userId)];
  if (filters.startDate) conditions.push(gte(audits.startDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(audits.endDate, filters.endDate));
  
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...conditions));
  
  const auditIds = userAudits.map(a => a.id);
  if (auditIds.length === 0) return [];
  
  const data = await db
    .select({
      siteId: audits.siteId,
      siteName: sites.name,
      processId: findings.processId,
      processName: processes.name,
      conformityRate: audits.conformityRate,
    })
    .from(findings)
    .leftJoin(audits, eq(findings.auditId, audits.id))
    .leftJoin(sites, eq(audits.siteId, sites.id))
    .leftJoin(processes, eq(findings.processId, processes.id))
    .where(inArray(findings.auditId, auditIds));
  
  return data;
}

/**
 * Get Pareto data (top non-conforming clauses)
 */
export async function getParetoData(userId: number, filters: any) {
  const db = getDb();
  
  const conditions = [eq(audits.userId, userId)];
  if (filters.startDate) conditions.push(gte(audits.startDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(audits.endDate, filters.endDate));
  
  const userAudits = await db
    .select()
    .from(audits)
    .where(and(...conditions));
  
  const auditIds = userAudits.map(a => a.id);
  if (auditIds.length === 0) return [];
  
  const userFindings = await db
    .select({
      clause: findings.clause,
      findingType: findings.findingType,
    })
    .from(findings)
    .where(and(
      inArray(findings.auditId, auditIds),
      inArray(findings.findingType, ["nc_major", "nc_minor"])
    ));
  
  // Group by clause
  const clauseMap = new Map<string, number>();
  
  userFindings.forEach(finding => {
    if (!finding.clause) return;
    clauseMap.set(finding.clause, (clauseMap.get(finding.clause) || 0) + 1);
  });
  
  // Sort by count descending
  return Array.from(clauseMap.entries())
    .map(([clause, count]) => ({ clause, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
