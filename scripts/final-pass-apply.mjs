/**
 * QARA — Consolidation finale : applique les 24 corrections de `title`
 * (scripts/title-fix-data.mjs) à scripts/questions_import_ready.json, et
 * génère UN SEUL script SQL couvrant tout ce qui reste à exécuter en prod :
 *
 *   1. Migration additive (questionTextSource) — idempotente, à rejouer sans
 *      risque même si déjà appliquée (tolère "Duplicate column name").
 *   2. Backfill de questionTextSource pour les 171 questions de la passe
 *      mécanique — IMPORTANT : voir VALIDATION-titres-tronques.md section B,
 *      le merge de cette passe a probablement déjà corrigé questionText en
 *      prod via le réimport automatique (import-corpus.mjs tourne à chaque
 *      déploiement Railway), MAIS ce script ne touche jamais
 *      questionTextSource — donc cette colonne est probablement encore NULL
 *      pour ces 171 lignes malgré le texte déjà correct. Ce bloc la peuple
 *      avec le VRAI texte original (extrait du commit 60fda8a, avant toute
 *      passe), sans toucher à questionText (déjà bon). Idempotent (IS NULL).
 *   3. Les 45 UPDATE de la passe éditoriale (repris tels quels de
 *      editorial-pass.sql — toujours valides, cette passe n'a pas encore été
 *      exécutée en prod).
 *   4. Les 24 corrections de `title` (nouveau bloc, sans lien avec
 *      questionTextSource — `title` n'a pas de colonne de traçabilité
 *      dédiée, l'original tronqué reste visible dans l'historique git).
 *   5. Vérifications avant/après, formulées pour ne RIEN présumer de l'état
 *      actuel de questionTextSource (juste le rapporter), plutôt que
 *      d'affirmer une valeur qui pourrait être fausse selon ce qui a
 *      réellement été exécuté jusqu'ici.
 *
 * Usage : node scripts/final-pass-apply.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { EDITORIAL_REFORMULATIONS } from "./editorial-pass-data.mjs";
import { TITLE_FIXES } from "./title-fix-data.mjs";

const SOURCE_PATH = new URL("./questions_import_ready.json", import.meta.url);
const OUT_DIR = new URL("./output/", import.meta.url);
const BACKFILL_PATH = new URL("./output/mechanical-pass-original-text-backfill.json", import.meta.url);

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function run() {
  const data = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
  const byKey = new Map(data.map((q) => [q.questionKey, q]));
  const backfill = JSON.parse(readFileSync(BACKFILL_PATH, "utf8"));

  // --- Contrôles avant écriture ---
  const errors = [];
  for (const item of TITLE_FIXES) {
    const row = byKey.get(item.questionKey);
    if (!row) { errors.push(`${item.questionKey} : introuvable`); continue; }
    if (row.title.length !== 250) {
      errors.push(`${item.questionKey} : title actuel ne fait pas 250 caractères (${row.title.length}) — déjà corrigé ou pas le bon candidat`);
    }
    if (!item.title.startsWith(row.title)) {
      errors.push(`${item.questionKey} : la correction ne préserve pas les 250 caractères existants comme préfixe exact`);
    }
    if (item.title.length === 250) {
      errors.push(`${item.questionKey} : la correction fait encore exactement 250 caractères — suspect, vérifier qu'elle n'est pas elle-même tronquée`);
    }
  }
  if (TITLE_FIXES.length !== 24) errors.push(`TITLE_FIXES a ${TITLE_FIXES.length} entrées, 24 attendues`);
  if (Object.keys(backfill).length !== 171) errors.push(`backfill a ${Object.keys(backfill).length} entrées, 171 attendues`);

  if (errors.length) {
    console.error("ÉCHEC des contrôles préalables — rien n'a été écrit :");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // --- Fichier source : applique les 24 corrections de title ---
  const correctedData = data.map((q) => {
    const fix = TITLE_FIXES.find((f) => f.questionKey === q.questionKey);
    return fix ? { ...q, title: fix.title } : q;
  });
  writeFileSync(SOURCE_PATH, JSON.stringify(correctedData, null, 2) + "\n", "utf8");

  // --- SQL consolidé ---
  let sql = `-- QARA — Script final consolidé : questionTextSource (171) + passe éditoriale (45) + titres tronqués (24)
-- Généré par scripts/final-pass-apply.mjs le ${new Date().toISOString()}
--
-- CONTEXTE IMPORTANT : la passe mécanique (171 questions) a été mergée dans
-- qitbxl. Le script "release" de Railway (package.json) exécute migrations +
-- import-corpus.mjs à CHAQUE déploiement — ce dernier réimporte questionText
-- depuis scripts/questions_import_ready.json (upsert par questionKey) mais ne
-- touche JAMAIS questionTextSource. Résultat probable : questionText est
-- déjà correct pour ces 171 lignes (d'où "45/473 restantes" observé), MAIS
-- questionTextSource est probablement encore NULL pour elles — la
-- traçabilité voulue par la migration 0030 n'a jamais été vraiment peuplée.
-- Le bloc 2 ci-dessous corrige ça. Les vérifications ne présument pas du
-- chiffre exact avant correction — elles le rapportent, à comparer au
-- commentaire de chaque requête.
--
-- PROCÉDURE (un bloc à la fois dans l'éditeur Query Railway) :
--   1. Sauvegarde préalable de la table questions (obligatoire, hors de ce fichier).
--   2. Bloc "0. VERIFICATION AVANT" — noter les résultats réels.
--   3. Bloc "1. MIGRATION ADDITIVE" (idempotent, "Duplicate column name" = déjà fait).
--   4. Bloc "2. BACKFILL questionTextSource POUR LES 171".
--   5. Les 6 blocs "3. PASSE EDITORIALE" (un par référentiel).
--   6. Le bloc "4. CORRECTION DES 24 TITRES TRONQUES".
--   7. Bloc "VERIFICATION APRES".
--
-- Aucun questionKey modifié. Aucune ligne supprimée ni ajoutée. Aucune
-- exigence réglementaire inventée.

-- ============================================================
-- 0. VERIFICATION AVANT (lecture seule)
-- ============================================================

-- 0a. Total du corpus (attendu : 473)
SELECT COUNT(*) AS total FROM questions;

-- 0b. Questions encore tronquées dans questionText (attendu : 45 si le
--     réimport automatique a déjà appliqué la passe mécanique ; 216 sinon —
--     dans ce dernier cas, s'arrêter et vérifier pourquoi avant de continuer)
SELECT COUNT(*) AS tronquees FROM questions WHERE questionText LIKE '%…%';

-- 0c. questionTextSource actuellement peuplée (chiffre à noter, pas à
--     présumer — voir le contexte ci-dessus)
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- 0d. Titres encore tronqués à 250 caractères exactement (attendu : 24)
SELECT COUNT(*) AS titres_tronques FROM questions WHERE LENGTH(title) = 250;

-- ============================================================
-- 1. MIGRATION ADDITIVE (idempotente — si "Duplicate column name", déjà faite)
-- ============================================================

ALTER TABLE questions ADD COLUMN questionTextSource TEXT NULL;

-- ============================================================
-- 2. BACKFILL questionTextSource POUR LES 171 QUESTIONS DE LA PASSE MECANIQUE
--    (questionText n'est PAS modifié ici, seulement questionTextSource si NULL)
-- ============================================================

UPDATE questions
SET questionTextSource = CASE questionKey
`;

  for (const [key, text] of Object.entries(backfill)) {
    sql += `    WHEN '${sqlEscape(key)}' THEN '${sqlEscape(text)}'\n`;
  }
  sql += `    ELSE questionTextSource
  END
WHERE questionTextSource IS NULL
  AND questionKey IN (${Object.keys(backfill).map((k) => `'${sqlEscape(k)}'`).join(", ")});

`;

  const refOrder = ["MDR", "IVDR", "FDA_QMSR", "MDSAP", "ISO13485", "ISO14971", "ISO9001"];
  for (const ref of refOrder) {
    const rows = EDITORIAL_REFORMULATIONS.filter((r) => r.referentialCode === ref);
    if (rows.length === 0) continue;
    sql += `-- ============================================================\n`;
    sql += `-- 3. PASSE EDITORIALE — ${ref} (${rows.length} questions)\n`;
    sql += `-- ============================================================\n\n`;
    sql += `UPDATE questions\nSET\n`;
    sql += `  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,\n`;
    sql += `  questionText = CASE questionKey\n`;
    for (const r of rows) {
      sql += `    WHEN '${sqlEscape(r.questionKey)}' THEN '${sqlEscape(r.text)}'\n`;
    }
    sql += `    ELSE questionText\n  END\nWHERE questionKey IN (${rows.map((r) => `'${sqlEscape(r.questionKey)}'`).join(", ")});\n\n`;
  }

  sql += `-- ============================================================
-- 4. CORRECTION DES 24 TITRES TRONQUES (title uniquement, questionText/
--    questionTextSource non touchés par ce bloc)
-- ============================================================

UPDATE questions
SET title = CASE questionKey
`;
  for (const f of TITLE_FIXES) {
    sql += `    WHEN '${sqlEscape(f.questionKey)}' THEN '${sqlEscape(f.title)}'\n`;
  }
  sql += `    ELSE title
  END
WHERE questionKey IN (${TITLE_FIXES.map((f) => `'${sqlEscape(f.questionKey)}'`).join(", ")});

-- ============================================================
-- VERIFICATION APRES
-- ============================================================

-- a. Total du corpus (attendu, inchangé : 473)
SELECT COUNT(*) AS total FROM questions;

-- b. Questions encore tronquées dans questionText (attendu : 0)
SELECT COUNT(*) AS tronquees_restantes FROM questions WHERE questionText LIKE '%…%';

-- c. questionTextSource peuplée sur 171 + 45 = 216 lignes exactement
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- d. Titres encore tronqués à 250 caractères (attendu : 0)
SELECT COUNT(*) AS titres_tronques_restants FROM questions WHERE LENGTH(title) = 250;

-- e. Aucun questionKey dupliqué ou perdu (toujours 473 distincts)
SELECT COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;

-- f. Échantillon de contrôle manuel
SELECT questionKey, LENGTH(title) AS title_len, questionTextSource IS NOT NULL AS a_une_source, questionText
FROM questions
WHERE questionKey IN ('Q-14971-RRG-7446', 'Q-MDR-S-3363', 'Q-FDA-N-2561', 'Q-MDR-DSM-0911')
ORDER BY questionKey;
`;

  writeFileSync(new URL("final-pass.sql", OUT_DIR), sql, "utf8");

  console.log(`Titres corrigés : ${TITLE_FIXES.length}`);
  console.log(`Backfill questionTextSource préparé pour : ${Object.keys(backfill).length} lignes`);
  console.log(`SQL consolidé : scripts/output/final-pass.sql`);
  console.log(`Source corrigée : scripts/questions_import_ready.json (24 title réécrits, rien d'autre)`);
}

run();
