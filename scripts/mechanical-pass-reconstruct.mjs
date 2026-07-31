/**
 * QARA — Passe mécanique du corpus : reconstruction des questions tronquées.
 *
 * Contexte : scripts/questions_import_ready.json (473 questions) contient 216
 * questions dont `questionText` porte un artefact de troncature ("…") — voir
 * VALIDATION-passe-mecanique.md à la racine du dépôt pour la méthode complète
 * et sa validation.
 *
 * Méthode : le `title` de chaque ligne n'est jamais tronqué (0/473). 17 paires
 * (ouverture de phrase fixe, clôture de phrase fixe) sont dérivées des 257
 * questions NON tronquées du corpus (chaque paire confirmée par 2 à 31
 * occurrences intactes). Pour chaque question tronquée dont l'ouverture
 * correspond à un gabarit connu ET dont le fragment avant "…" est un préfixe
 * du `title` de la même ligne, la reconstruction est : ouverture + title +
 * clôture canonique — jamais le reliquat de texte après "…", qui peut lui-même
 * être partiellement tronqué (voir section B de VALIDATION-passe-mecanique.md).
 *
 * Ce script ne touche à aucune base de données. Il ne fait que :
 *   1. Lire scripts/questions_import_ready.json (lecture seule) ;
 *   2. Classer les 216 questions tronquées en "reconstructible" / "manuel" ;
 *   3. Écrire un rapport JSON (scripts/output/mechanical-pass-report.json) ;
 *   4. Écrire le SQL prêt à coller dans Railway (scripts/output/mechanical-pass.sql),
 *      un bloc par référentiel, à exécuter un bloc à la fois.
 *
 * Ce script réécrit aussi scripts/questions_import_ready.json en place (seul
 * questionText change, sur les questionKey reconstructibles). Il est donc
 * conçu pour être exécuté UNE fois contre la source pré-passe-mécanique ; la
 * revue git de ce commit est la trace du fichier original. Une exécution
 * ultérieure sur une source déjà corrigée ne trouvera plus que le résidu
 * éditorial (45 questions) et ne régénérera pas les mêmes blocs SQL — c'est
 * attendu, pas un bug d'idempotence (les instructions SQL elles-mêmes, une
 * fois appliquées en base, restent rejouables sans effet grâce au CASE/IS NULL
 * sur questionTextSource).
 *
 * Usage : node scripts/mechanical-pass-reconstruct.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const SOURCE_PATH = new URL("./questions_import_ready.json", import.meta.url);
const OUT_DIR = new URL("./output/", import.meta.url);

const CANON = [
  ["Déroulez un cas concret concerné par", " : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ?"],
  ["Choisissons un document soumis à", " : montrez-moi sa version en vigueur, son approbation et le retrait des versions périmées."],
  ["Montrez-moi, sur un cas réel récent, comment", " est appliquée en pratique et où en est la preuve."],
  ["Montrez-moi comment", " relie votre analyse de risques à une décision concrète sur le produit."],
  ["Prenez un dossier de lot récent : montrez-moi comment", " est appliquée au poste, pas seulement décrite dans une procédure."],
  ["Prenez la dernière action corrective liée à", " : déroulez-la du déclencheur jusqu'à la preuve d'efficacité vérifiée à distance."],
  ["Ouvrons le dernier dossier de conception concerné par", " : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation."],
  ["Prouvez-moi, sur un projet réel, que", " a été appliquée et vérifiée, pas seulement planifiée."],
  ["Montrez-moi, sur un cas daté, comment vous respectez", " et prouvez-le par les dates."],
  ["Déroulez un cas d'achat récent et prouvez que", " a été respectée avant utilisation du produit reçu."],
  ["Prenez un fournisseur critique : montrez-moi comment", " est appliquée, de la sélection à la surveillance des performances."],
  ["Prouvez-moi, sur un exemple de votre choix des trois derniers mois, que", " est réellement mise en œuvre et pas seulement documentée."],
  ["Montrez-moi comment vous prouvez que l'action prise sur", " a réellement empêché le problème de revenir."],
  ["Déroulez la fabrication d'un lot et prouvez que", " a été respectée et enregistrée."],
  ["Montrez-moi comment vous garantissez que", " est respectée sur un enregistrement récent."],
  ["Sortez le dernier cas concerné par", " et reconstituons la chronologie : date de connaissance, décision, date d'action. Le délai a-t-il été tenu ?"],
  ["Choisissons un danger réel concerné par", " : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu."],
].sort((a, b) => b[0].length - a[0].length); // longest opener first, avoids ambiguous prefix matches

function cleanTitleVariants(title) {
  const variants = [];
  const idx = title.indexOf(" — ");
  if (idx >= 0) variants.push(title.slice(idx + 3));
  variants.push(title);
  return variants;
}

function matchOpener(text) {
  for (const [opener, closer] of CANON) {
    if (text.startsWith(opener)) return [opener, closer];
  }
  return [null, null];
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function run() {
  const data = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
  if (data.length !== 473) {
    console.warn(`ATTENTION : ${data.length} questions lues, 473 attendues — vérifier la source avant de continuer.`);
  }

  const truncated = data.filter((q) => q.questionText && q.questionText.includes("…"));
  const reconstructible = [];
  const manual = [];

  for (const q of truncated) {
    const qt = q.questionText;
    const [opener, closer] = matchOpener(qt);
    if (!opener) {
      manual.push({ questionKey: q.questionKey, referentialCode: q.referentialCode, questionText: qt, title: q.title, reason: "no-opener-match" });
      continue;
    }
    const idx = qt.indexOf("…");
    const fragAfterOpener = qt.slice(opener.length + 1, idx); // +1 for the space after opener
    let resolved = false;
    for (const ct of cleanTitleVariants(q.title)) {
      const fao = fragAfterOpener.trimEnd();
      const fullPrefix = ct.startsWith(fao);
      const withGarbageTail = fao.startsWith(ct) && fao.length - ct.length <= 6;
      if (fullPrefix || withGarbageTail) {
        const newText = `${opener} ${ct}${closer}`;
        reconstructible.push({
          questionKey: q.questionKey,
          referentialCode: q.referentialCode,
          before: qt,
          after: newText,
        });
        resolved = true;
        break;
      }
    }
    if (!resolved) {
      manual.push({ questionKey: q.questionKey, referentialCode: q.referentialCode, questionText: qt, title: q.title, reason: "title-mismatch" });
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // --- Report ---
  const byRef = (arr) => arr.reduce((acc, x) => ((acc[x.referentialCode] = (acc[x.referentialCode] || 0) + 1), acc), {});
  const report = {
    generatedAt: new Date().toISOString(),
    totalQuestions: data.length,
    totalTruncated: truncated.length,
    reconstructibleCount: reconstructible.length,
    manualCount: manual.length,
    reconstructibleByRef: byRef(reconstructible),
    manualByRef: byRef(manual),
    reconstructibleKeys: reconstructible.map((r) => r.questionKey).sort(),
    manual: manual.map((m) => ({ questionKey: m.questionKey, referentialCode: m.referentialCode, reason: m.reason })),
  };
  writeFileSync(new URL("mechanical-pass-report.json", OUT_DIR), JSON.stringify(report, null, 2), "utf8");

  // --- SQL ---
  const refOrder = ["MDR", "IVDR", "FDA_QMSR", "MDSAP", "ISO13485", "ISO14971", "ISO9001"];
  let sql = `-- QARA — Passe mécanique du corpus : script de reconstruction
-- Généré par scripts/mechanical-pass-reconstruct.mjs le ${new Date().toISOString()}
-- Total questions reconstruites : ${reconstructible.length} (sur ${truncated.length} tronquées, ${manual.length} restent pour la passe éditoriale)
--
-- PROCÉDURE (un bloc à la fois dans l'éditeur Query Railway) :
--   1. Sauvegarde préalable de la table questions (obligatoire, hors de ce fichier).
--   2. Bloc "0. VERIFICATION AVANT" — noter les résultats.
--   3. Bloc "1. MIGRATION ADDITIVE" — ajoute questionTextSource si absente.
--      Si erreur "Duplicate column name" : déjà appliquée, passer au bloc suivant.
--   4. Un bloc UPDATE par référentiel (idempotent : rejouable sans double effet,
--      questionTextSource n'est peuplée qu'une seule fois grâce au CASE/IS NULL).
--   5. Bloc "VERIFICATION APRES" — comparer aux résultats attendus.
--
-- Aucun questionKey n'est modifié. Aucune ligne n'est supprimée ni ajoutée.

-- ============================================================
-- 0. VERIFICATION AVANT (lecture seule)
-- ============================================================

-- 0a. Total du corpus (attendu : 473)
SELECT COUNT(*) AS total FROM questions;

-- 0b. Questions encore tronquées (attendu avant script : 216)
SELECT COUNT(*) AS tronquees FROM questions WHERE questionText LIKE '%…%';

-- 0c. Colonne questionTextSource existe-t-elle déjà ?
SELECT COUNT(*) AS colonne_deja_presente
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'questions' AND column_name = 'questionTextSource';

-- ============================================================
-- 1. MIGRATION ADDITIVE (une seule fois — si "Duplicate column name 'questionTextSource'", c'est déjà fait, passer au bloc 2)
-- ============================================================

ALTER TABLE questions ADD COLUMN questionTextSource TEXT NULL;

`;

  for (const ref of refOrder) {
    const rows = reconstructible.filter((r) => r.referentialCode === ref);
    if (rows.length === 0) continue;
    sql += `-- ============================================================\n`;
    sql += `-- 2. RECONSTRUCTION — ${ref} (${rows.length} questions)\n`;
    sql += `-- ============================================================\n\n`;
    sql += `UPDATE questions\nSET\n`;
    sql += `  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,\n`;
    sql += `  questionText = CASE questionKey\n`;
    for (const r of rows) {
      sql += `    WHEN '${sqlEscape(r.questionKey)}' THEN '${sqlEscape(r.after)}'\n`;
    }
    sql += `    ELSE questionText\n  END\nWHERE questionKey IN (${rows.map((r) => `'${sqlEscape(r.questionKey)}'`).join(", ")});\n\n`;
  }

  sql += `-- ============================================================
-- 3. VERIFICATION APRES
-- ============================================================

-- 3a. Total du corpus (attendu, inchangé : 473)
SELECT COUNT(*) AS total FROM questions;

-- 3b. Questions encore tronquées (attendu après script : ${manual.length}, la passe éditoriale)
SELECT COUNT(*) AS tronquees_restantes FROM questions WHERE questionText LIKE '%…%';

-- 3c. questionTextSource peuplée sur exactement ${reconstructible.length} lignes
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- 3d. Aucun questionKey dupliqué ou modifié (le compte de clés distinctes doit rester 473)
SELECT COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;

-- 3e. Échantillon de contrôle manuel (à comparer visuellement à VALIDATION-passe-mecanique.md section D)
SELECT questionKey, questionTextSource, questionText
FROM questions
WHERE questionKey IN ('Q-14971-PGR-8687', 'Q-MDR-MC-8407', 'Q-9001-EO-6948')
ORDER BY questionKey;
`;

  writeFileSync(new URL("mechanical-pass.sql", OUT_DIR), sql, "utf8");

  // --- Fichier source corrigé (empêche la régression au prochain import) ---
  // Seul questionText change, sur exactement les questionKey listés dans
  // reconstructible.map(r => r.questionKey) — aucun autre champ touché.
  const reconstructByKey = new Map(reconstructible.map((r) => [r.questionKey, r.after]));
  const correctedData = data.map((q) =>
    reconstructByKey.has(q.questionKey) ? { ...q, questionText: reconstructByKey.get(q.questionKey) } : q
  );
  writeFileSync(SOURCE_PATH, JSON.stringify(correctedData, null, 2) + "\n", "utf8");

  console.log(`Tronquées : ${truncated.length}`);
  console.log(`Reconstructibles (script) : ${reconstructible.length}`);
  console.log(`Résidu manuel (passe éditoriale) : ${manual.length}`);
  console.log(`Rapport : scripts/output/mechanical-pass-report.json`);
  console.log(`SQL     : scripts/output/mechanical-pass.sql`);
  console.log(`Source corrigée : scripts/questions_import_ready.json (${reconstructible.length} questionText réécrits, rien d'autre)`);
}

run();
