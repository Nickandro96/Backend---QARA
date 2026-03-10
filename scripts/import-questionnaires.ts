import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { questions, referentiels } from "../drizzle/schema";

const EXCEL_PATH = process.env.EXCEL_PATH || "data/Questionnaires audits FDA - tous les ref.xlsx";
const SHEET_NAME = process.env.SHEET_NAME || "";
const DRY_RUN = ["1", "true", "yes"].includes(String(process.env.DRY_RUN || "0").toLowerCase());
const STRICT_FDA_FILE = ["1", "true", "yes"].includes(String(process.env.STRICT_FDA_FILE || "1").toLowerCase());

const REQUIRED_OUTPUT_COLUMNS = [
  "referentialId",
  "processId",
  "article",
  "annexe",
  "title",
  "economicRole",
  "applicableProcesses",
  "questionType",
  "questionText",
  "expectedEvidence",
  "criticality",
  "interviewFunctions",
  "actionPlan",
  "aiPrompt",
  "displayOrder",
  "questionKey",
  "risk",
] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  process: ["processus", "process", "macro process", "processus principal"],
  subProcess: ["sous-processus / activité", "sous-processus", "subprocess", "sub-process", "activité"],
  referential: ["référentiel fda", "referentiel fda", "fda referential", "framework", "referential"],
  reference: ["référence exacte", "reference exacte", "reference", "référence", "21 cfr", "clause", "article"],
  shortQuestion: ["question d’audit (courte)", "question d'audit (courte)", "question courte", "short question", "title"],
  questionText: ["question d’audit (détaillée, ouverte, vérifiable)", "question d'audit (détaillée, ouverte, vérifiable)", "question détaillée", "question detaillee", "questiontext", "question"],
  expectedEvidence: ["preuves attendues (documents & enregistrements)", "preuves attendues", "expected evidence", "expectedevidence"],
  interviewFunctions: ["interviews (rôles/fonctions)", "interviews (roles/fonctions)", "interviews", "fonctions interrogées", "interviewfunctions"],
  sampling: ["test terrain / échantillonnage recommandé", "test terrain / echantillonnage recommande", "test terrain", "échantillonnage recommandé", "sampling", "recommended sampling"],
  risk: ["risque en cas de nc (angle fda)", "risque en cas de nc", "risk", "risque"],
  criticality: ["criticité", "criticite", "criticality"],
};

const REFERENTIAL_CODE_MAP: Array<{ match: RegExp; code: "FDA_QSR_21CFR820" | "FDA_US_MARKET_ACCESS" }> = [
  { match: /21\s*cfr\s*part\s*820|fda\s*qmsr/i, code: "FDA_QSR_21CFR820" },
  { match: /21\s*cfr\s*part\s*807|510\(k\)|de\s*novo|pma|udi|postmarket|labeling/i, code: "FDA_US_MARKET_ACCESS" },
];

function slug(input: unknown) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveHeader(row: Record<string, any>, logical: keyof typeof HEADER_ALIASES) {
  const entries = Object.entries(row);
  const aliases = HEADER_ALIASES[logical].map(slug);
  const found = entries.find(([key]) => aliases.includes(slug(key)));
  return found?.[1];
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((x) => x.trim()).filter(Boolean);
  const s = String(value ?? "").trim();
  if (!s) return [];
  return s.split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean);
}

function mapReferentialCode(rawValue: unknown) {
  const raw = String(rawValue ?? "").trim();
  for (const rule of REFERENTIAL_CODE_MAP) {
    if (rule.match.test(raw)) return rule.code;
  }
  return null;
}

function normalizeCriticality(value: unknown) {
  const v = String(value ?? "medium").trim().toLowerCase();
  if (["critical", "critique"].includes(v)) return "critical";
  if (["high", "haute", "élevée", "elevee"].includes(v)) return "high";
  if (["low", "faible", "mineure", "mineur"].includes(v)) return "low";
  return "medium";
}

function stableQuestionKey(input: {
  referentialCode: string;
  reference: string | null;
  shortQuestion: string;
  questionText: string;
}) {
  const seed = [input.referentialCode, input.reference || "", input.shortQuestion, input.questionText]
    .map((x) => x.trim())
    .join("|");
  return `fda_${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

function autoAiPrompt(questionText: string, expectedEvidence: string | null, risk: string | null) {
  return [
    "Explain this FDA requirement in plain language.",
    "Describe what strong compliance looks like during an inspection.",
    `Requirement: ${questionText}`,
    `Expected evidence: ${expectedEvidence || "Not provided"}`,
    `Inspection risk if non-compliant: ${risk || "Not provided"}`,
    "Suggest a concise CAPA-ready action plan.",
  ].join(" ");
}

function normalizeRow(row: Record<string, any>, displayOrder: number) {
  const processName = String(resolveHeader(row, "process") || "").trim();
  const subProcessName = String(resolveHeader(row, "subProcess") || "").trim();
  const rawReferential = String(resolveHeader(row, "referential") || "").trim();
  const referentialCode = mapReferentialCode(rawReferential);
  const reference = String(resolveHeader(row, "reference") || "").trim() || null;
  const shortQuestion = String(resolveHeader(row, "shortQuestion") || "").trim() || "General";
  const questionText = String(resolveHeader(row, "questionText") || "").trim();
  const expectedEvidence = String(resolveHeader(row, "expectedEvidence") || "").trim() || null;
  const interviewFunctions = normalizeList(resolveHeader(row, "interviewFunctions"));
  const sampling = String(resolveHeader(row, "sampling") || "").trim() || null;
  const risk = String(resolveHeader(row, "risk") || "").trim() || null;
  const criticality = normalizeCriticality(resolveHeader(row, "criticality"));

  const applicableProcesses = [processName, subProcessName].filter(Boolean);

  return {
    rawReferential,
    referentialCode,
    processId: null,
    article: reference,
    annexe: null,
    title: shortQuestion,
    economicRole: "all",
    applicableProcesses,
    questionType: "open",
    questionText,
    expectedEvidence,
    criticality,
    interviewFunctions,
    actionPlan: sampling,
    aiPrompt: autoAiPrompt(questionText, expectedEvidence, risk),
    displayOrder,
    risk,
    questionKey: referentialCode
      ? stableQuestionKey({
          referentialCode,
          reference,
          shortQuestion,
          questionText,
        })
      : null,
  };
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
  }

  if (STRICT_FDA_FILE && !/questionnaires audits fda/i.test(path.basename(EXCEL_PATH))) {
    throw new Error(`Safety stop: this import is restricted to the FDA workbook only. Received: ${EXCEL_PATH}`);
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheets = SHEET_NAME ? [SHEET_NAME] : workbook.SheetNames;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const refRows = await db.select().from(referentiels);
  const refMap = new Map(refRows.map((r: any) => [String(r.code), r.id]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const issues: string[] = [];

  for (const sheetName of sheets) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const normalized = normalizeRow(row, index + 1);

      if (!normalized.questionText) {
        skipped += 1;
        issues.push(`[${sheetName}] Row ${index + 2}: missing detailed question text`);
        continue;
      }

      if (!normalized.referentialCode || !normalized.questionKey) {
        skipped += 1;
        issues.push(`[${sheetName}] Row ${index + 2}: unsupported FDA referential '${normalized.rawReferential}'`);
        continue;
      }

      const referentialId = refMap.get(normalized.referentialCode);
      if (!referentialId) {
        skipped += 1;
        issues.push(`[${sheetName}] Row ${index + 2}: referential code '${normalized.referentialCode}' missing in table referentiels`);
        continue;
      }

      const payload: any = {
        referentialId,
        processId: normalized.processId,
        article: normalized.article,
        annexe: normalized.annexe,
        title: normalized.title,
        economicRole: normalized.economicRole,
        applicableProcesses: normalized.applicableProcesses,
        questionType: normalized.questionType,
        questionText: normalized.questionText,
        expectedEvidence: normalized.expectedEvidence,
        criticality: normalized.criticality,
        interviewFunctions: normalized.interviewFunctions,
        actionPlan: normalized.actionPlan,
        aiPrompt: normalized.aiPrompt,
        displayOrder: normalized.displayOrder,
        questionKey: normalized.questionKey,
        risk: normalized.risk,
      };

      const [existing] = await db.select().from(questions).where(eq(questions.questionKey, normalized.questionKey)).limit(1);
      if (existing) {
        if (!DRY_RUN) {
          await db.update(questions).set(payload).where(eq(questions.id, existing.id));
        }
        updated += 1;
      } else {
        if (!DRY_RUN) {
          await db.insert(questions).values({ ...payload, createdAt: new Date() });
        }
        inserted += 1;
      }
    }
  }

  const report = {
    excelPath: EXCEL_PATH,
    sheetName: SHEET_NAME || null,
    dryRun: DRY_RUN,
    inserted,
    updated,
    skipped,
    issues,
    requiredOutputColumns: REQUIRED_OUTPUT_COLUMNS,
  };

  fs.writeFileSync(path.resolve("./import-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
