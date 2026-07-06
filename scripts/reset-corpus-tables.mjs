/**
 * Réinitialise les tables du corpus réglementaire (questions, referentiels)
 * avant un import propre. Nécessaire une seule fois pour repartir d'un état
 * sain après une corruption causée par des exécutions concurrentes de
 * import-corpus.mjs (voir docs/audit/PROGRESS-deploiement.md — bug de
 * référentiels dupliqués avec des ids incohérents).
 *
 * Sans effet sur les autres tables (users, audits, sites, etc.) : les
 * questions n'ont pas de clé étrangère entrante depuis ces tables-là.
 *
 * Utilise le même verrou nommé MySQL que import-corpus.mjs (voir
 * docs/audit/ETAT-DES-LIEUX-backend.md, bug #4) pour ne jamais s'exécuter en
 * même temps qu'un import en cours. Préférer, pour un déploiement, l'option
 * RESET_BEFORE_IMPORT=1 de import-corpus.mjs (une seule connexion, un seul
 * verrou tenu de bout en bout, aucune fenêtre entre le vidage et l'import) —
 * ce script reste utile pour un vidage manuel ponctuel, hors chaîne de
 * démarrage.
 *
 * Usage : DATABASE_URL=... node scripts/reset-corpus-tables.mjs
 */
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [[{ acquired }]] = await conn.query(
    "SELECT GET_LOCK('qara_import_corpus', 120) AS acquired"
  );
  if (!acquired) {
    console.log("Un import/reset est déjà en cours (verrou non obtenu après 120s) — abandon.");
    await conn.end();
    return;
  }
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("TRUNCATE TABLE `questions`");
    await conn.query("TRUNCATE TABLE `referentiels`");
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Tables questions/referentiels réinitialisées (vidées, compteurs auto_increment remis à zéro).");
  } finally {
    await conn.query("SELECT RELEASE_LOCK('qara_import_corpus')");
    await conn.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
