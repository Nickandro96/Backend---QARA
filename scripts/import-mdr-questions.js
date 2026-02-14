/* scripts/import-mdr-questions.js
 * Import Excel -> MySQL table `questions`
 * - Keeps the schema (columns) as-is
 * - Replaces ALL rows in `questions`
 * - Generates questionKey (stable md5)
 *
 * Required env:
 * - DATABASE_URL (mysql://user:pass@host:port/db)
 */

const path = require("path");
const crypto = require("crypto");
const xlsx = require("xlsx");
const mysql = require("mysql2/promise");

const EXCEL_PATH = path.join(process.cwd(), "data", "MDR_questionnaire_V7_CORRIGE.xlsx");

const PROCESS_MAP = {
  "Gouvernance & stratégie réglementaire": "gov_strat",
  "Affaires réglementaires (RA)": "ra",
  "Système de management qualité (QMS)": "qms",
  "Gestion des risques (ISO 14971)": "risk_mgmt",
  "Conception & développement": "design_dev",
  "Achats & fournisseurs": "purchasing_suppliers",
  "Production & sous-traitance": "production_sub",
  "Traçabilité / UDI": "traceability_udi",
  "PMS / PMCF": "pms_pmcf",
  "Vigilance & incidents": "vigilance_incidents",
  "Distribution & logistique": "distribution_logistics",
  "Importation": "importation",
  "Documentation technique": "tech_doc",
  "Audits & conformité": "audits_conformity",
  "IT / données / cybersécurité": "it_data_cybersecurity",
};

const CRIT_MAP = {
  "élevé": "high",
  "eleve": "high",
  "haut": "high",
  "moyen": "medium",
  "moyenne": "medium",
  "faible": "low",
  "bas": "low",
};

function normStr(v) {
  return (v ?? "").toString().trim();
}

function md5(s) {
  return crypto.createHash("md5").update(String(s)).digest("hex");
}

function extractEconomicRole(intitule) {
  // e.g. "[Fabricant] Objet ..." -> "fabricant"
  const m = normStr(intitule).match(/\[(.*?)\]/);
  if (!m) return null;
  const raw = m[1].toLowerCase().trim();
  if (raw.includes("fabricant")) return "fabricant";
  if (raw.includes("importateur")) return "importateur";
  if (raw.includes("distributeur")) return "distributeur";
  if (raw.includes("mandataire")) return "mandataire";
  return null;
}

function normalizeCriticality(v) {
  const s = normStr(v).toLowerCase();
  if (!s) return null;
  const key = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove accents
  return CRIT_MAP[key] ?? s;
}

function splitFunctions(v) {
  // Example: "Fabricant – Qualité, RA"
  const s = normStr(v);
  if (!s) return [];
  // take part after dash if exists
  const parts = s.split("–").map((x) => x.trim());
  const afterDash = parts.length > 1 ? parts.slice(1).join(" ").trim() : s;
  return afterDash
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildApplicableProcesses(processusConcerne) {
  const label = normStr(processusConcerne);
  if (!label) return [];
  const token = PROCESS_MAP[label] || null;

  // To maximize matching with your router (token OR french name)
  const out = [];
  if (token) out.push(token);
  out.push(label);
  return Array.from(new Set(out));
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify([]);
  }
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("Missing env DATABASE_URL");
  }

  console.log("[IMPORT] Excel path:", EXCEL_PATH);

  const wb = xlsx.readFile(EXCEL_PATH);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

  console.log("[IMPORT] Rows read from Excel:", rows.length);

  // Expected columns (from your file):
  // Processus concerné
  // Objectif du processus
  // Clause MDR
  // Intitulé
  // Question d’audit détaillée
  // Type
  // Risque en cas de NC
  // Preuves attendues
  // Fonctions interrogées
  // Criticité

  const transformed = rows
    .map((r, idx) => {
      const processusConcerne = r["Processus concerné"];
      const clause = r["Clause MDR"];
      const intitule = r["Intitulé"];
      const questionText = r["Question d’audit détaillée"];
      const type = r["Type"];
      const risks = r["Risque en cas de NC"];
      const expectedEvidence = r["Preuves attendues"];
      const fonctions = r["Fonctions interrogées"];
      const criticite = r["Criticité"];

      const economicRole = extractEconomicRole(intitule);
      const applicableProcesses = buildApplicableProcesses(processusConcerne);
      const interviewFunctions = splitFunctions(fonctions);

      const questionKey = "q_" + md5(`${clause}__${economicRole ?? ""}__${applicableProcesses.join("|")}__${questionText}`);

      return {
        // Keep DB columns intact
        referentialId: 1, // MDR
        processId: null, // optional (you filter via applicableProcesses)
        questionKey,
        article: normStr(clause) || null,
        annexe: null,
        title: normStr(intitule) || null,
        economicRole: economicRole || null,
        applicableProcesses: safeJsonStringify(applicableProcesses),
        questionType: normStr(type) || null,
        questionText: normStr(questionText) || null,
        expectedEvidence: normStr(expectedEvidence) || null,
        criticality: normalizeCriticality(criticite),
        risk: null,
        risks: normStr(risks) || null,
        interviewFunctions: safeJsonStringify(interviewFunctions),
        actionPlan: null,
        aiPrompt: null,
        displayOrder: idx + 1,
      };
    })
    .filter((x) => x.questionText && x.questionText.length > 0);

  console.log("[IMPORT] Transformed rows:", transformed.length);

  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("[IMPORT] Connected to DB");

  try {
    await conn.beginTransaction();

    // Optional backup table
    const backupName = `questions_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    console.log("[IMPORT] Creating backup table:", backupName);
    await conn.query(`CREATE TABLE IF NOT EXISTS \`${backupName}\` LIKE \`questions\``);
    await conn.query(`INSERT INTO \`${backupName}\` SELECT * FROM \`questions\``);

    console.log("[IMPORT] Truncating questions...");
    await conn.query("TRUNCATE TABLE `questions`");

    const sqlInsert = `
      INSERT INTO \`questions\`
      (\`referentialId\`, \`processId\`, \`questionKey\`, \`article\`, \`annexe\`, \`title\`,
       \`economicRole\`, \`applicableProcesses\`, \`questionType\`, \`questionText\`, \`expectedEvidence\`,
       \`criticality\`, \`risk\`, \`risks\`, \`interviewFunctions\`, \`actionPlan\`, \`aiPrompt\`, \`displayOrder\`)
      VALUES ?
    `;

    const chunkSize = 300;
    for (let i = 0; i < transformed.length; i += chunkSize) {
      const chunk = transformed.slice(i, i + chunkSize).map((t) => [
        t.referentialId,
        t.processId,
        t.questionKey,
        t.article,
        t.annexe,
        t.title,
        t.economicRole,
        t.applicableProcesses,
        t.questionType,
        t.questionText,
        t.expectedEvidence,
        t.criticality,
        t.risk,
        t.risks,
        t.interviewFunctions,
        t.actionPlan,
        t.aiPrompt,
        t.displayOrder,
      ]);
      await conn.query(sqlInsert, [chunk]);
      console.log(`[IMPORT] Inserted ${Math.min(i + chunkSize, transformed.length)} / ${transformed.length}`);
    }

    await conn.commit();
    console.log("[IMPORT] ✅ Import finished successfully");
  } catch (e) {
    await conn.rollback();
    console.error("[IMPORT] ❌ Import failed, rolled back:", e);
    throw e;
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
