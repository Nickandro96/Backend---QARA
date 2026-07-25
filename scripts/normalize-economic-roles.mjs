/**
 * QARA — Normalisation de questions.economicRole vers les 4 opérateurs
 * économiques réglementaires (fabricant/mandataire/importateur/distributeur)
 * ou NULL (universel), selon la table de correspondance validée ligne par
 * ligne — voir CORRECTIONS.md.
 *
 * Non destructif : la valeur brute est d'abord préservée dans
 * economicRoleSource (migration 0028_economic_role_source.sql, à appliquer
 * avant ce script) avant toute écriture sur economicRole. Idempotent : la
 * correspondance est calculée à partir d'economicRoleSource (jamais réécrit
 * une fois posé), donc une deuxième exécution ne re-mappe pas une valeur
 * déjà normalisée.
 *
 * Usage :
 *   DATABASE_URL=... node scripts/normalize-economic-roles.mjs
 *
 * Pré-requis : migration 0028 appliquée (colonne economicRoleSource).
 *
 * Table de correspondance (validée) :
 *   fabricant                      -> fabricant (inchangé)
 *   finished device manufacturer   -> fabricant
 *   fabricant IVD                  -> fabricant
 *   fabricant participant MDSAP    -> fabricant
 *   assembleur                     -> fabricant + situationTags: ["assemblage"] (Art. 22(3) MDR)
 *   U.S. agent                     -> fabricant + situationTags: ["acces_marche_us"] (21 CFR 807.40 —
 *                                      questions rédigées du point de vue du fabricant étranger qui
 *                                      doit désigner l'agent, jamais du distributeur/importateur)
 *   mandataire                     -> mandataire (inchangé)
 *   importateur                    -> importateur (inchangé)
 *   distributeur                   -> distributeur (inchangé)
 *   organisme DM                   -> NULL (universel — ISO13485 audite l'organisme, pas l'opérateur)
 *   organisme                      -> NULL (universel — ISO9001 s'applique à toute organisation)
 *   direction                      -> NULL (universel — générique, aucun rôle)
 */
import mysql from "mysql2/promise";

const MAPPING = {
  fabricant: { role: "fabricant" },
  "finished device manufacturer": { role: "fabricant" },
  "fabricant IVD": { role: "fabricant" },
  "fabricant participant MDSAP": { role: "fabricant" },
  assembleur: { role: "fabricant", situationTags: ["assemblage"] },
  "U.S. agent": { role: "fabricant", situationTags: ["acces_marche_us"] },
  mandataire: { role: "mandataire" },
  importateur: { role: "importateur" },
  distributeur: { role: "distributeur" },
  "organisme DM": { role: null },
  organisme: { role: null },
  direction: { role: null },
};

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1) Préserve la valeur brute (une seule fois — jamais écrasée ensuite)
  const [backfillResult] = await conn.execute(
    "UPDATE questions SET economicRoleSource = economicRole WHERE economicRoleSource IS NULL"
  );
  console.log(`[backfill] economicRoleSource peuplé sur ${backfillResult.affectedRows} lignes.`);

  // 2) Applique la correspondance, calculée à partir d'economicRoleSource
  const [rows] = await conn.query(
    "SELECT id, economicRoleSource, situationTags FROM questions WHERE economicRoleSource IS NOT NULL"
  );

  let updated = 0;
  let unmapped = new Set();

  for (const row of rows) {
    const mapping = MAPPING[row.economicRoleSource];
    if (!mapping) {
      unmapped.add(row.economicRoleSource);
      continue;
    }

    const existingTags = Array.isArray(row.situationTags)
      ? row.situationTags
      : typeof row.situationTags === "string" && row.situationTags
      ? JSON.parse(row.situationTags)
      : [];

    const nextTags = mapping.situationTags
      ? Array.from(new Set([...existingTags, ...mapping.situationTags]))
      : existingTags;

    await conn.execute(
      "UPDATE questions SET economicRole = ?, situationTags = ? WHERE id = ?",
      [mapping.role, JSON.stringify(nextTags), row.id]
    );
    updated++;
  }

  console.log(`[normalisation] ${updated}/${rows.length} lignes mises à jour selon la table de correspondance.`);
  if (unmapped.size > 0) {
    console.warn(
      `[normalisation] ATTENTION : ${unmapped.size} valeur(s) economicRoleSource sans correspondance connue : ${JSON.stringify(
        Array.from(unmapped)
      )}. Aucune ligne les portant n'a été modifiée — compléter MAPPING avant de relancer.`
    );
  }

  // 3) Résumé de contrôle
  const [summary] = await conn.query(
    `SELECT economicRoleSource, economicRole, situationTags, COUNT(*) AS n
     FROM questions GROUP BY economicRoleSource, economicRole, situationTags ORDER BY n DESC`
  );
  console.table(summary);

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
