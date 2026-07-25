/**
 * QARA — Vérification post-migration (economicRole + nettoyage
 * fetchAuditScopedQuestions) : confirme qu'un audit MDR réel n'est pas
 * régressé — mêmes questions servies (socle historique préservé), même
 * score. À exécuter APRÈS la normalisation (scripts/normalize-economic-roles.mjs)
 * sur la même base (production ou locale).
 *
 * Usage :
 *   DATABASE_URL=... node scripts/verify-mdr-non-regression.mjs <userId> <auditId>
 *
 * Exemple (audit MDR réel) :
 *   DATABASE_URL=... node scripts/verify-mdr-non-regression.mjs 2 <auditId réel>
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and } from "drizzle-orm";
import { getAuditContextInternal, fetchAuditScopedQuestions } from "../server/mdr-router.ts";
import { questions, auditResponses, audits } from "../drizzle/schema.ts";

const SCORE_MAP = { compliant: 100, partial: 60, non_compliant: 20, not_applicable: 100, in_progress: 50 };

const userId = Number(process.argv[2]);
const auditId = Number(process.argv[3]);

if (!userId || !auditId) {
  console.error("Usage: DATABASE_URL=... node scripts/verify-mdr-non-regression.mjs <userId> <auditId>");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(conn);

  const [audit] = await db.select().from(audits).where(eq(audits.id, auditId)).limit(1);
  if (!audit) {
    console.error(`Audit ${auditId} introuvable pour userId=${userId}.`);
    process.exit(1);
  }

  const referentialIds = JSON.parse(audit.referentialIds || "[]");
  const referentialId = referentialIds[0];

  // Socle historique : questions dont la valeur BRUTE d'origine (préservée
  // dans economicRoleSource) était déjà "fabricant" avant normalisation.
  const baselineRows = await db
    .select({ questionKey: questions.questionKey })
    .from(questions)
    .where(and(eq(questions.referentialId, referentialId), eq(questions.economicRoleSource, "fabricant")));
  const baselineKeys = new Set(baselineRows.map((r) => r.questionKey));

  const ctx = await getAuditContextInternal(db, userId, auditId);
  const rows = await fetchAuditScopedQuestions(db, {
    auditId,
    userId,
    economicRole: ctx.economicRole,
    economicRolesFromOnboarding: ctx.economicRolesFromOnboarding,
    situationTags: ctx.situationTags,
    processIds: ctx.processIds,
    referentialIds: ctx.referentialIds,
    select: { questionKey: questions.questionKey },
  });
  const servedKeys = new Set(rows.map((r) => r.questionKey));

  const missing = [...baselineKeys].filter((k) => !servedKeys.has(k));

  const responseRows = await db
    .select({ questionKey: auditResponses.questionKey, responseValue: auditResponses.responseValue })
    .from(auditResponses)
    .where(and(eq(auditResponses.auditId, auditId), eq(auditResponses.userId, userId)));
  const scoped = responseRows.filter((r) => servedKeys.has(String(r.questionKey)));

  let total = 0;
  for (const r of scoped) total += SCORE_MAP[r.responseValue] ?? 50;
  const score = scoped.length > 0 ? Math.round((total / scoped.length) * 10) / 10 : 0;

  console.log(`Audit ${auditId} ("${audit.name}") — userId=${userId}, referentialId=${referentialId}`);
  console.log(`  Socle historique (economicRoleSource='fabricant')     : ${baselineKeys.size} questions`);
  console.log(`  Questions servies aujourd'hui                          : ${servedKeys.size} questions`);
  console.log(`  Questions du socle absentes des servies                : ${missing.length}${missing.length ? " -> " + JSON.stringify(missing) : " (aucune)"}`);
  console.log(`  Réponses existantes dans le périmètre                  : ${scoped.length}`);
  console.log(`  Score recalculé                                        : ${score}%`);

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
