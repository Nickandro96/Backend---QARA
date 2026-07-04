/**
 * Onboarding — backfill de questions.roleReglementaire / situationTags à
 * partir du economicRole brut. Voir server/onboarding/scopeEngine.ts et
 * docs/audit/12-onboarding.md.
 *
 * Note : `applicableProcesses` a été écarté comme source pour situationTags
 * après vérification en direct — ce champ liste une audience large et
 * dupliquée par process (ex. les 67 questions ISO14971 portent toutes
 * "assembleur si impact risque" aux côtés de "fabricant"/"fabricant IVD"),
 * ce n'est pas un signal fiable de restriction par question. Seul
 * `economicRole` (qui varie réellement question par question) est utilisé.
 *
 * Idempotent : recalcule et écrase à chaque exécution (pas d'accumulation).
 *
 * Usage :
 *   DATABASE_URL=... npx tsx scripts/backfill-role-reglementaire.mjs
 *
 * Pré-requis : migration 0020_onboarding_scope appliquée.
 */
import mysql from "mysql2/promise";
import { normalizeEconomicRole, situationFromEconomicRole } from "../server/onboarding/scopeEngine.ts";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [rows] = await conn.query("SELECT id, economicRole FROM questions");

  let updated = 0;
  for (const row of rows) {
    const roles = normalizeEconomicRole(row.economicRole);
    const situations = situationFromEconomicRole(row.economicRole);

    await conn.execute(
      "UPDATE questions SET roleReglementaire = ?, situationTags = ? WHERE id = ?",
      [JSON.stringify(roles), JSON.stringify(situations), row.id]
    );
    updated++;
  }

  console.log(`Backfill terminé : ${updated}/${rows.length} questions mises à jour.`);

  const [summary] = await conn.query(
    `SELECT economicRole, roleReglementaire, situationTags, COUNT(*) AS n
     FROM questions GROUP BY economicRole, roleReglementaire, situationTags ORDER BY n DESC`
  );
  console.table(summary);

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
