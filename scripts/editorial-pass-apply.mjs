/**
 * QARA — Passe éditoriale du corpus : applique les 45 reformulations validées
 * (scripts/editorial-pass-data.mjs) à scripts/questions_import_ready.json et
 * génère le SQL prêt à coller dans Railway.
 *
 * Contrôles avant écriture :
 *   - chaque questionKey de EDITORIAL_REFORMULATIONS doit exister dans le
 *     corpus, exactement une fois ;
 *   - le questionText actuel de chaque ligne doit encore contenir "…" (sinon
 *     elle a déjà été traitée ou n'était pas dans le résidu des 45 — on
 *     s'arrête plutôt que d'écraser silencieusement autre chose) ;
 *   - aucune reformulation ne doit elle-même contenir "…".
 * Si un contrôle échoue, le script s'arrête sans rien écrire.
 *
 * Comme mechanical-pass-reconstruct.mjs, ce script réécrit
 * scripts/questions_import_ready.json en place (seul questionText change,
 * sur exactement les 45 questionKey listés). Conçu pour être exécuté une
 * fois contre la source encore non éditée.
 *
 * Usage : node scripts/editorial-pass-apply.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { EDITORIAL_REFORMULATIONS } from "./editorial-pass-data.mjs";

const SOURCE_PATH = new URL("./questions_import_ready.json", import.meta.url);
const OUT_DIR = new URL("./output/", import.meta.url);

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function run() {
  const data = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
  const byKey = new Map(data.map((q) => [q.questionKey, q]));

  const errors = [];
  for (const item of EDITORIAL_REFORMULATIONS) {
    const row = byKey.get(item.questionKey);
    if (!row) {
      errors.push(`${item.questionKey} : introuvable dans le corpus`);
      continue;
    }
    if (!row.questionText || !row.questionText.includes("…")) {
      errors.push(`${item.questionKey} : questionText actuel ne contient plus "…" (déjà traité ? hors résidu des 45 ?) — texte actuel: ${JSON.stringify(row.questionText)}`);
    }
    if (item.text.includes("…")) {
      errors.push(`${item.questionKey} : la reformulation elle-même contient "…" — refusé`);
    }
  }
  const seen = new Set();
  for (const item of EDITORIAL_REFORMULATIONS) {
    if (seen.has(item.questionKey)) errors.push(`${item.questionKey} : dupliqué dans EDITORIAL_REFORMULATIONS`);
    seen.add(item.questionKey);
  }
  if (EDITORIAL_REFORMULATIONS.length !== 45) {
    errors.push(`Nombre de reformulations = ${EDITORIAL_REFORMULATIONS.length}, 45 attendues`);
  }

  if (errors.length) {
    console.error("ÉCHEC des contrôles préalables — rien n'a été écrit :");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // --- Fichier source corrigé ---
  const beforeByKey = new Map(EDITORIAL_REFORMULATIONS.map((item) => [item.questionKey, byKey.get(item.questionKey).questionText]));
  const correctedData = data.map((q) => {
    const item = EDITORIAL_REFORMULATIONS.find((r) => r.questionKey === q.questionKey);
    return item ? { ...q, questionText: item.text } : q;
  });
  writeFileSync(SOURCE_PATH, JSON.stringify(correctedData, null, 2) + "\n", "utf8");

  // --- Rapport ---
  const byRef = (arr) => arr.reduce((acc, x) => ((acc[x.referentialCode] = (acc[x.referentialCode] || 0) + 1), acc), {});
  const report = {
    generatedAt: new Date().toISOString(),
    totalReformulated: EDITORIAL_REFORMULATIONS.length,
    byRef: byRef(EDITORIAL_REFORMULATIONS),
    titleTruncatedCount: EDITORIAL_REFORMULATIONS.filter((r) => r.titleTruncated).length,
    titleTruncatedKeys: EDITORIAL_REFORMULATIONS.filter((r) => r.titleTruncated).map((r) => r.questionKey),
    keys: EDITORIAL_REFORMULATIONS.map((r) => r.questionKey).sort(),
  };
  writeFileSync(new URL("editorial-pass-report.json", OUT_DIR), JSON.stringify(report, null, 2), "utf8");

  // --- SQL ---
  const refOrder = ["MDR", "IVDR", "FDA_QMSR", "MDSAP", "ISO13485", "ISO14971", "ISO9001"];
  let sql = `-- QARA — Passe éditoriale du corpus : script de reconstruction (45 questions)
-- Généré par scripts/editorial-pass-apply.mjs le ${new Date().toISOString()}
-- Fait suite à la passe mécanique (171 questions, migration 0030, déjà en prod).
--
-- PROCÉDURE (un bloc à la fois dans l'éditeur Query Railway) :
--   1. Sauvegarde préalable de la table questions (obligatoire, hors de ce fichier).
--   2. Bloc "0. VERIFICATION AVANT" — noter les résultats.
--   3. Un bloc UPDATE par référentiel (idempotent : rejouable sans double effet,
--      questionTextSource n'est peuplée qu'une seule fois via CASE/IS NULL —
--      la colonne existe déjà, migration 0030 appliquée avec la passe mécanique).
--   4. Bloc "VERIFICATION APRES" — comparer aux résultats attendus.
--
-- Aucun questionKey modifié. Aucune ligne supprimée ni ajoutée. Aucune
-- exigence réglementaire inventée — reformulations ancrées sur title/
-- expectedEvidence/officialSource de chaque ligne et, pour 13 lignes au
-- title lui-même tronqué à 250 caractères (voir rapport), sur le texte
-- réglementaire réel vérifié (21 CFR 860 Subpart D, FD&C 524B, MDR Art.
-- 32/10(14), ISO 9001 Amd.1:2024, MDSAP AU P0002).

-- ============================================================
-- 0. VERIFICATION AVANT (lecture seule)
-- ============================================================

-- 0a. Total du corpus (attendu : 473, inchangé)
SELECT COUNT(*) AS total FROM questions;

-- 0b. Questions encore tronquées (attendu avant ce script : 45 — la passe
--     mécanique a déjà ramené 216 à 45)
SELECT COUNT(*) AS tronquees FROM questions WHERE questionText LIKE '%…%';

-- 0c. questionTextSource déjà peuplée sur 171 lignes (passe mécanique) —
--     confirme qu'on repart du bon état
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

`;

  for (const ref of refOrder) {
    const rows = EDITORIAL_REFORMULATIONS.filter((r) => r.referentialCode === ref);
    if (rows.length === 0) continue;
    sql += `-- ============================================================\n`;
    sql += `-- RECONSTRUCTION EDITORIALE — ${ref} (${rows.length} questions)\n`;
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
-- VERIFICATION APRES
-- ============================================================

-- a. Total du corpus (attendu, inchangé : 473)
SELECT COUNT(*) AS total FROM questions;

-- b. Questions encore tronquées (attendu : 0 — fin de la troncature "…" sur
--    tout le scope initial des 216 ; les 11 questions au title tronqué hors
--    scope de cette passe ne sont pas concernées par ce compte, leur
--    questionText n'a jamais été tronqué)
SELECT COUNT(*) AS tronquees_restantes FROM questions WHERE questionText LIKE '%…%';

-- c. questionTextSource peuplée sur 171 + 45 = 216 lignes au total
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- d. Aucun questionKey dupliqué ou perdu (toujours 473 distincts)
SELECT COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;

-- e. Échantillon de contrôle manuel
SELECT questionKey, questionTextSource, questionText
FROM questions
WHERE questionKey IN ('Q-14971-RRG-7446', 'Q-MDR-S-3363', 'Q-9001-RO-2538')
ORDER BY questionKey;
`;

  writeFileSync(new URL("editorial-pass.sql", OUT_DIR), sql, "utf8");

  console.log(`Reformulées : ${EDITORIAL_REFORMULATIONS.length}`);
  console.log(`  dont title tronqué (complété sur texte réglementaire vérifié) : ${report.titleTruncatedCount}`);
  console.log(`Répartition : ${JSON.stringify(report.byRef)}`);
  console.log(`Rapport : scripts/output/editorial-pass-report.json`);
  console.log(`SQL     : scripts/output/editorial-pass.sql`);
  console.log(`Source corrigée : scripts/questions_import_ready.json (45 questionText réécrits, rien d'autre)`);
}

run();
