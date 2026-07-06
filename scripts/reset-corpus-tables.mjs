/**
 * Réinitialise les tables du corpus réglementaire (questions, referentiels)
 * avant un import propre. Nécessaire une seule fois pour repartir d'un état
 * sain après une corruption causée par des exécutions concurrentes de
 * import-corpus.mjs (voir docs/audit/PROGRESS-deploiement.md — bug de
 * référentiels dupliqués avec des ids incohérents, désormais empêché par un
 * verrou MySQL dans import-corpus.mjs, mais qui ne répare pas un état déjà
 * corrompu).
 *
 * Sans effet sur les autres tables (users, audits, sites, etc.) : les
 * questions n'ont pas de clé étrangère entrante depuis ces tables-là.
 *
 * Usage : DATABASE_URL=... node scripts/reset-corpus-tables.mjs
 */
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  await conn.query("TRUNCATE TABLE `questions`");
  await conn.query("TRUNCATE TABLE `referentiels`");
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Tables questions/referentiels réinitialisées (vidées, compteurs auto_increment remis à zéro).");
  await conn.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
