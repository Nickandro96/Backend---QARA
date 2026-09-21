import { and, eq, inArray } from "drizzle-orm";
import { audits, audit_responses, capa_actions } from "../drizzle/schema";
import { getDb } from "./db";
import { classifyNonConformityResponse } from "./capa/capaEngine";

/** Source unique des compteurs « NC ouvertes » affichés dans QARA. */
export async function getOpenNCCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const auditRows = await db.select({ id: audits.id }).from(audits).where(eq(audits.userId, userId));
  const auditIds = auditRows.map((audit) => audit.id);
  if (!auditIds.length) return 0;

  const [responses, capas] = await Promise.all([
    db.select({ auditId: audit_responses.auditId, questionKey: audit_responses.questionKey, responseValue: audit_responses.responseValue })
      .from(audit_responses)
      .where(and(eq(audit_responses.userId, userId), inArray(audit_responses.auditId, auditIds))),
    db.select({ auditId: capa_actions.auditId, questionKey: capa_actions.questionKey, statut: capa_actions.statut })
      .from(capa_actions)
      .where(eq(capa_actions.userId, userId)),
  ]);

  const closedKeys = new Set(capas.filter((c) => c.statut.startsWith("cloturee")).map((c) => `${c.auditId}:${c.questionKey}`));
  return responses.filter((r) => classifyNonConformityResponse(r.responseValue) !== null && !closedKeys.has(`${r.auditId}:${r.questionKey}`)).length;
}
