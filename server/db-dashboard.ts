import { getDb } from "./db";
import { auditResponses, questions, processes, findings, actions, isoAuditResponses, mdrAuditResponses } from "../drizzle/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";

/**
 * Get dashboard KPIs for a user
 */
export async function getDashboardKPIs(userId: string) {
  const db = getDb();
  
  // Get responses from all three tables
  const oldResponses = await db.select()
    .from(auditResponses)
    .where(eq(auditResponses.userId, userId));
  
  const isoResponses = await db.select()
    .from(isoAuditResponses)
    .where(eq(isoAuditResponses.userId, userId));
  
  const mdrResponses = await db.select()
    .from(mdrAuditResponses)
    .where(eq(mdrAuditResponses.userId, userId));
  
  // Combine all responses
  const allResponses = [
    ...oldResponses.map(r => ({ status: r.status, responseValue: r.responseValue })),
    ...isoResponses.map(r => ({ status: r.status, responseValue: r.responseValue })),
    ...mdrResponses.map(r => ({ status: r.status, responseValue: r.responseValue }))
  ];
  
  const answeredQuestions = allResponses.length;
  
  // Count by status (using responseValue which is standardized)
  const conforme = allResponses.filter(r => r.responseValue === "compliant" || r.status === "conforme").length;
  const nonConforme = allResponses.filter(r => r.responseValue === "non_compliant" || r.status === "non_conforme").length;
  const partial = allResponses.filter(r => r.responseValue === "partial" || r.status === "partial").length;
  const na = allResponses.filter(r => r.responseValue === "not_applicable" || r.status === "na").length;
  
  // Calculate score (conforme + partial*0.5) / (total - na) * 100
  const totalScored = conforme + nonConforme + partial;
  const scoreGlobal = totalScored > 0 ? ((conforme + partial * 0.5) / totalScored) * 100 : 0;
  
  // Get total questions (approximate)
  const totalQuestions = await db.select({ count: sql<number>`count(*)` })
    .from(questions)
    .then(r => r[0]?.count || 0);
  
  // Calculate progression
  const progression = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
  
  return {
    scoreGlobal: Math.round(scoreGlobal * 10) / 10,
    progression: Math.round(progression * 10) / 10,
    nonConformitiesCount: nonConforme,
    totalQuestions,
    answeredQuestions,
    conforme,
    nonConforme,
    na,
    partial,
  };
}

/**
 * Get progress by process for a user
 */
export async function getProcessProgress(userId: string) {
  const db = getDb();
  
  // Get all processes
  const allProcesses = await db.select().from(processes).orderBy(processes.order);
  
  // Get stats for each process
  const processStats = await Promise.all(
    allProcesses.map(async (process) => {
      // Total questions for this process
      const totalQuestions = await db.select({ count: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.processId, process.id))
        .then(r => r[0]?.count || 0);
      
      // Answered questions for this process
      const answeredQuestions = await db.select({ count: sql<number>`count(distinct ${auditResponses.questionId})` })
        .from(auditResponses)
        .innerJoin(questions, eq(auditResponses.questionId, questions.id))
        .where(and(
          eq(auditResponses.userId, userId),
          eq(questions.processId, process.id)
        ))
        .then(r => r[0]?.count || 0);
      
      // Conformity stats for this process
      const conformityStats = await db.select({
        status: auditResponses.status,
        count: sql<number>`count(*)`,
      })
        .from(auditResponses)
        .innerJoin(questions, eq(auditResponses.questionId, questions.id))
        .where(and(
          eq(auditResponses.userId, userId),
          eq(questions.processId, process.id)
        ))
        .groupBy(auditResponses.status);
      
      const conforme = conformityStats.find(s => s.status === "conforme")?.count || 0;
      const nonConforme = conformityStats.find(s => s.status === "non_conforme")?.count || 0;
      
      const totalScored = conforme + nonConforme;
      const score = totalScored > 0 ? (conforme / totalScored) * 100 : 0;
      const progression = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
      
      return {
        id: process.id,
        name: process.name,
        description: process.description,
        score: Math.round(score * 10) / 10,
        progression: Math.round(progression * 10) / 10,
        totalQuestions,
        answeredQuestions,
        conforme,
        nonConforme,
      };
    })
  );
  
  return processStats;
}

/**
 * Get score trend over time (last 6 months)
 */
export async function getScoreTrend(userId: string) {
  const db = getDb();
  
  // Get responses grouped by month
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const responses = await db.select({
    month: sql<string>`DATE_FORMAT(${auditResponses.createdAt}, '%Y-%m')`,
    status: auditResponses.status,
    count: sql<number>`count(*)`,
  })
    .from(auditResponses)
    .where(and(
      eq(auditResponses.userId, userId),
      gte(auditResponses.createdAt, sixMonthsAgo)
    ))
    .groupBy(sql`DATE_FORMAT(${auditResponses.createdAt}, '%Y-%m')`, auditResponses.status)
    .orderBy(sql`DATE_FORMAT(${auditResponses.createdAt}, '%Y-%m')`);
  
  // Group by month and calculate score
  const monthlyScores = new Map<string, { conforme: number; nonConforme: number }>();
  
  responses.forEach(r => {
    if (!monthlyScores.has(r.month)) {
      monthlyScores.set(r.month, { conforme: 0, nonConforme: 0 });
    }
    const stats = monthlyScores.get(r.month)!;
    if (r.status === "conforme") stats.conforme = r.count;
    if (r.status === "non_conforme") stats.nonConforme = r.count;
  });
  
  // Convert to array with scores
  const trend = Array.from(monthlyScores.entries()).map(([month, stats]) => {
    const total = stats.conforme + stats.nonConforme;
    const score = total > 0 ? (stats.conforme / total) * 100 : 0;
    return {
      month,
      score: Math.round(score * 10) / 10,
    };
  });
  
  return trend;
}

/**
 * Get recent findings/actions
 */
export async function getRecentFindings(userId: string, limit: number = 10) {
  const db = getDb();
  
  // Get recent non-conforme responses with question details
  const recentFindings = await db.select({
    id: auditResponses.id,
    questionId: auditResponses.questionId,
    questionText: questions.question,
    processName: processes.name,
    referential: questions.referential,
    article: questions.article,
    status: auditResponses.status,
    comment: auditResponses.comment,
    createdAt: auditResponses.createdAt,
  })
    .from(auditResponses)
    .innerJoin(questions, eq(auditResponses.questionId, questions.id))
    .innerJoin(processes, eq(questions.processId, processes.id))
    .where(and(
      eq(auditResponses.userId, userId),
      eq(auditResponses.status, "non_conforme")
    ))
    .orderBy(desc(auditResponses.createdAt))
    .limit(limit);
  
  return recentFindings;
}

/**
 * Get detailed process info for modal
 */
export async function getProcessDetails(userId: string, processId: number) {
  const db = getDb();
  
  // Get process info
  const process = await db.select().from(processes).where(eq(processes.id, processId)).then(r => r[0]);
  
  if (!process) {
    return null;
  }
  
  // Get questions for this process
  const processQuestions = await db.select({
    id: questions.id,
    question: questions.question,
    article: questions.article,
    referential: questions.referential,
  })
    .from(questions)
    .where(eq(questions.processId, processId));
  
  // Get user responses for these questions
  const userResponses = await db.select({
    questionId: auditResponses.questionId,
    status: auditResponses.status,
  })
    .from(auditResponses)
    .where(and(
      eq(auditResponses.userId, userId),
      sql`${auditResponses.questionId} IN (${sql.join(processQuestions.map(q => q.id), sql`, `)})`
    ));
  
  // Group by article/clause
  const clauseStats = new Map<string, { conforme: number; nonConforme: number; total: number }>();
  
  processQuestions.forEach(q => {
    const key = `${q.referential} ${q.article}`;
    if (!clauseStats.has(key)) {
      clauseStats.set(key, { conforme: 0, nonConforme: 0, total: 0 });
    }
    
    const response = userResponses.find(r => r.questionId === q.id);
    const stats = clauseStats.get(key)!;
    stats.total++;
    
    if (response?.status === "conforme") stats.conforme++;
    if (response?.status === "non_conforme") stats.nonConforme++;
  });
  
  // Convert to array
  const clauseDetails = Array.from(clauseStats.entries()).map(([clause, stats]) => ({
    clause,
    conforme: stats.conforme,
    nonConforme: stats.nonConforme,
    total: stats.total,
    score: stats.total > 0 ? (stats.conforme / (stats.conforme + stats.nonConforme || 1)) * 100 : 0,
  }));
  
  // Calculate overall process stats
  const totalQuestions = processQuestions.length;
  const answeredQuestions = userResponses.length;
  const conforme = userResponses.filter(r => r.status === "conforme").length;
  const nonConforme = userResponses.filter(r => r.status === "non_conforme").length;
  const totalScored = conforme + nonConforme;
  const score = totalScored > 0 ? (conforme / totalScored) * 100 : 0;
  const progression = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
  
  return {
    process,
    score: Math.round(score * 10) / 10,
    progression: Math.round(progression * 10) / 10,
    totalQuestions,
    answeredQuestions,
    conforme,
    nonConforme,
    clauseDetails,
  };
}
