/**
 * QARA — Import du corpus vérifié (473 questions, 7 référentiels) dans MySQL.
 * Remplace les scripts d'import cassés/invalides du dépôt et le contenu MDR/FDA
 * précédemment importé (voir docs/audit/07-import-corpus.md — décision validée :
 * remplacement complet, pas de coexistence avec l'ancien contenu MDR/FDA).
 *
 * Usage :
 *   DATABASE_URL=... node scripts/import-corpus.mjs
 *
 * Pré-requis : migration 0018_rich_question_fields appliquée (colonnes riches).
 *
 * Idempotent pour les référentiels ISO13485/ISO9001/ISO14971/IVDR/MDSAP (upsert
 * par questionKey). Pour MDR/FDA, la toute première exécution purge l'ancien
 * contenu (voir §0) ; les exécutions suivantes sont un upsert normal.
 *
 * Option RESET_BEFORE_IMPORT=1 : vide entièrement `questions`/`referentiels`
 * avant l'import, DANS LA MÊME section verrouillée (voir plus bas) — utile
 * pour repartir d'un état propre après une corruption (voir
 * docs/audit/PROGRESS-deploiement.md). Contrairement à un script séparé non
 * verrouillé, ce chemin ne laisse aucune fenêtre où une autre exécution
 * concurrente pourrait vider les tables pendant un import en cours.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { referentiels, processus, questions } from "../drizzle/schema.ts";
import { CANONICAL_PROCESSES } from "../server/processes-catalog.ts";

const REFS = [
  { code: "MDR", name: "Règlement (UE) 2017/745 (MDR)", type: "regulation" },
  { code: "IVDR", name: "Règlement (UE) 2017/746 (IVDR)", type: "regulation" },
  { code: "FDA_QMSR", name: "FDA QMSR (21 CFR 820, eff. 2026-02-02)", type: "regulation" },
  { code: "MDSAP", name: "MDSAP Audit Model (AU P0002.009)", type: "program" },
  { code: "ISO13485", name: "ISO 13485:2016", type: "standard" },
  { code: "ISO14971", name: "ISO 14971:2019", type: "standard" },
  { code: "ISO9001", name: "ISO 9001:2015", type: "standard" },
];

// Anciens référentiels FDA remplacés par le nouveau code consolidé FDA_QMSR.
const OLD_FDA_CODES = ["FDA_QSR_21CFR820", "FDA_US_MARKET_ACCESS"];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Verrou nommé MySQL : ce script fait des "SELECT puis INSERT si absent" sur
  // referentiels/processus (pas de contrainte UNIQUE sur ces colonnes de
  // matching), donc deux exécutions concurrentes (ex. double démarrage de
  // conteneur au déploiement) peuvent créer des doublons ou provoquer une
  // violation de clé étrangère. Le verrou sérialise : la deuxième exécution
  // attend que la première ait fini (idempotente) plutôt que de courir en
  // parallèle sur les mêmes lignes.
  const [[{ acquired }]] = await conn.query(
    "SELECT GET_LOCK('qara_import_corpus', 120) AS acquired"
  );
  if (!acquired) {
    console.log("Un autre import est déjà en cours (verrou non obtenu après 120s) — abandon.");
    await conn.end();
    return;
  }

  try {
    await runImport(conn);
  } finally {
    await conn.query("SELECT RELEASE_LOCK('qara_import_corpus')");
    await conn.end();
  }
}

async function runImport(conn) {
  const db = drizzle(conn);
  const rows = JSON.parse(readFileSync(new URL("./questions_import_ready.json", import.meta.url)));

  if (process.env.RESET_BEFORE_IMPORT === "1") {
    console.log("[RESET] RESET_BEFORE_IMPORT=1 — vidage de questions/referentiels avant import...");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("TRUNCATE TABLE `questions`");
    await conn.query("TRUNCATE TABLE `referentiels`");
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("[RESET] Tables vidées, compteurs auto_increment remis à zéro.");
  }

  // 0) Remplacement de l'ancien contenu MDR/FDA (décision validée le 04/07/2026 —
  //    voir docs/audit/07-import-corpus.md). N'affecte pas ISO9001/ISO13485 (déjà
  //    vides) ni les référentiels tiers.
  const [mdrRef] = await db.select().from(referentiels).where(eq(referentiels.code, "MDR"));
  if (mdrRef) {
    const [countRows] = await conn.query("SELECT COUNT(*) AS count FROM questions WHERE referentialId = ?", [
      mdrRef.id,
    ]);
    const count = countRows[0].count;
    if (count > 0) {
      console.log(`[REPLACE] Suppression de ${count} anciennes questions MDR (referentialId=${mdrRef.id})...`);
      await conn.execute("DELETE FROM questions WHERE referentialId = ?", [mdrRef.id]);
    }
  }
  for (const code of OLD_FDA_CODES) {
    const [oldRef] = await db.select().from(referentiels).where(eq(referentiels.code, code));
    if (oldRef) {
      console.log(`[REPLACE] Suppression de l'ancien référentiel ${code} (id=${oldRef.id}) et de ses questions...`);
      await conn.execute("DELETE FROM questions WHERE referentialId = ?", [oldRef.id]);
      await conn.execute("DELETE FROM referentiels WHERE id = ?", [oldRef.id]);
    }
  }

  // 1) Référentiels (upsert par code)
  const refIdByCode = {};
  for (const r of REFS) {
    const existing = await db.select().from(referentiels).where(eq(referentiels.code, r.code));
    if (existing.length) {
      refIdByCode[r.code] = existing[0].id;
      await conn.execute("UPDATE referentiels SET name = ?, type = ?, updatedAt = NOW() WHERE id = ?", [
        r.name,
        r.type,
        existing[0].id,
      ]);
    } else {
      const [res] = await conn.execute(
        "INSERT INTO referentiels (code, name, type, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())",
        [r.code, r.name, r.type]
      );
      refIdByCode[r.code] = res.insertId;
    }
  }

  // 2) Processus : table PARTAGÉE entre référentiels, limitée aux 15 catégories
  //    canoniques (server/processes-catalog.ts). Le corpus classe ses questions
  //    en 228 intitulés fins (row.processName) — un matching mot-à-mot contre les
  //    15 catégories créait des dizaines de processus "fantômes" (une seule
  //    correspondance exacte sur 228), rendant le filtrage par processus de
  //    l'audit inopérant pour 472 questions sur 473 (voir
  //    docs/audit/ETAT-DES-LIEUX-mission5-deploiement-complet.md §7).
  //    scripts/process_mapping_228_to_15.json résout chaque intitulé fin vers
  //    l'une des 15 catégories ; l'intitulé fin lui-même est conservé dans
  //    questions.processDetail (migration 0023) pour ne rien perdre.
  const processMapping = JSON.parse(
    readFileSync(new URL("./process_mapping_228_to_15.json", import.meta.url))
  );

  const existingProcesses = await db.select().from(processus);
  const procIdByName = {};
  for (const p of existingProcesses) procIdByName[p.name] = p.id;

  const procIdByCanonicalId = {};
  for (const c of CANONICAL_PROCESSES) {
    const pid = procIdByName[c.name];
    if (pid === undefined) {
      throw new Error(
        `Processus canonique introuvable en base : "${c.name}" (id="${c.id}"). ` +
          `Vérifier que les migrations 0007/0012 (seed des 15 processus canoniques) sont bien appliquées.`
      );
    }
    procIdByCanonicalId[c.id] = pid;
  }

  // 3) Questions (upsert par questionKey)
  let inserted = 0, updated = 0;
  for (const row of rows) {
    const refId = refIdByCode[row.referentialCode];

    let pid = null;
    if (row.processName) {
      const canonicalId = processMapping[row.processName];
      if (!canonicalId) {
        throw new Error(
          `Intitulé de processus absent du mapping : "${row.processName}" (question ${row.questionKey}). ` +
            `Ajouter une entrée dans scripts/process_mapping_228_to_15.json avant de réimporter.`
        );
      }
      pid = procIdByCanonicalId[canonicalId] ?? null;
    }

    const values = {
      referentialId: refId,
      processId: pid,
      processDetail: row.processName || null,
      questionKey: row.questionKey,
      article: row.article || null,
      annexe: row.annexe || null,
      title: row.title || null,
      economicRole: row.economicRole || null,
      applicableProcesses: row.applicableProcesses ?? [],
      questionType: row.questionType,
      questionText: row.questionText,
      expectedEvidence: row.expectedEvidence || null,
      criticality: row.criticality,
      risk: row.risk || null,
      interviewFunctions: row.interviewFunctions ?? null,
      actionPlan: row.actionPlan || null,
      aiPrompt: row.aiPrompt || null,
      displayOrder: row.displayOrder,
      // champs riches (colonnes ajoutées par la migration 0018)
      auditVerifies: row.auditVerifies || null,
      relances: row.relances ?? [],
      explanationSimple: row.explanationSimple || null,
      concreteExample: row.concreteExample || null,
      conformityCriteria: row.conformityCriteria ?? {},
      typicalNc: row.typicalNc ?? [],
      mappings: row.mappings ?? [],
      referenceStatus: row.referenceStatus || null,
      officialSource: row.officialSource || null,
    };
    const existing = await db.select().from(questions).where(eq(questions.questionKey, row.questionKey));
    if (existing.length) {
      await db.update(questions).set(values).where(eq(questions.questionKey, row.questionKey));
      updated++;
    } else {
      await db.insert(questions).values(values);
      inserted++;
    }
  }

  console.log(`Import terminé : ${inserted} insérées, ${updated} mises à jour, sur ${rows.length}.`);

  // 4) Nettoyage des processus "fantômes" créés par d'anciennes exécutions de ce
  //    script (avant le mapping vers les 15 catégories canoniques) : plus aucune
  //    question n'y référence désormais, sûr de les supprimer.
  const canonicalIds = Object.values(procIdByCanonicalId);
  const [orphans] = await conn.query(
    `SELECT id FROM processus WHERE id NOT IN (${canonicalIds.map(() => "?").join(",")})
       AND id NOT IN (SELECT DISTINCT processId FROM questions WHERE processId IS NOT NULL)`,
    canonicalIds
  );
  if (orphans.length > 0) {
    const ids = orphans.map((o) => o.id);
    console.log(`[CLEANUP] Suppression de ${ids.length} processus fantômes non référencés (ids: ${ids.slice(0, 10).join(", ")}${ids.length > 10 ? "..." : ""})...`);
    await conn.query(`DELETE FROM processus WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
