import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import XLSX from "xlsx";
import { and, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { questions, referentiels } from "../drizzle/schema";

const EXCEL_PATH = process.env.EXCEL_PATH || "data/Questionnaires audits FDA - tous les ref.xlsx";
const SHEET_NAME = process.env.SHEET_NAME || "";
const DEFAULT_REFERENTIAL = process.env.DEFAULT_REFERENTIAL || "FDA_QSR_21CFR820";

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
  referential: ["referential", "référentiel", "framework", "frameworkcode"],
  article: ["article", "clause", "21 cfr", "reference"],
  annexe: ["annexe", "annex", "subpart", "section"],
  title: ["title", "intitulé", "chapter", "process title", "thème"],
  economicRole: ["economicrole", "role", "rôle", "role économique"],
  applicableProcesses: ["applicableprocesses", "processus concernés", "processes", "process"],
  questionType: ["questiontype", "type"],
  questionText: ["questiontext", "question d'audit détaillée", "question", "detailed question"],
  expectedEvidence: ["expectedevidence", "preuves attendues", "expected evidence"],
  criticality: ["criticality", "criticité"],
  interviewFunctions: ["interviewfunctions", "fonctions interrogées", "interviewed functions"],
  actionPlan: ["actionplan", "plan d'action", "action plan"],
  aiPrompt: ["aiprompt", "ai prompt"],
  risk: ["risk", "risque", "risque en cas de nc"],
};

function slug(input: unknown) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stableQuestionKey(row: Record<string, any>) {
  const seed = [row.referentialCode, row.article, row.annexe, row.title, row.questionText].map((x) => String(x ?? "").trim()).join("|");
  return `fda_${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

function autoAiPrompt(questionText: string, expectedEvidence: string) {
  return `Explain this FDA requirement in plain language, describe what good looks like during an inspection, and suggest a CAPA-ready action plan. Requirement: ${questionText}. Expected evidence: ${expectedEvidence || "Not provided"}.`;
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const s = String(value ?? "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}
  return s.split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean);
}

function resolveHeader(row: Record<string, any>, logical: keyof typeof HEADER_ALIASES) {
  const entries = Object.entries(row);
  const aliases = HEADER_ALIASES[logical].map(slug);
  const found = entries.find(([key]) => aliases.includes(slug(key)));
  return found?.[1];
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
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

    rows.forEach((row, index) => {
      (row as any).__sheetName = sheetName;
      (row as any).__displayOrder = index + 1;
    });

    for (const row of rows) {
      const referentialCode = String(resolveHeader(row, "referential") || DEFAULT_REFERENTIAL || sheetName).trim();
      const referentialId = refMap.get(referentialCode);
      if (!referentialId) {
        issues.push(`[${sheetName}] Unknown referential code: ${referentialCode}`);
        skipped += 1;
        continue;
      }

      const normalized = {
        referentialCode,
        referentialId,
        processId: null,
        article: String(resolveHeader(row, "article") || "").trim() || null,
        annexe: String(resolveHeader(row, "annexe") || "").trim() || null,
        title: String(resolveHeader(row, "title") || "General").trim(),
        economicRole: String(resolveHeader(row, "economicRole") || "all").trim() || "all",
        applicableProcesses: normalizeList(resolveHeader(row, "applicableProcesses")),
        questionType: String(resolveHeader(row, "questionType") || "open").trim() || "open",
        questionText: String(resolveHeader(row, "questionText") || "").trim(),
        expectedEvidence: String(resolveHeader(row, "expectedEvidence") || "").trim() || null,
        criticality: String(resolveHeader(row, "criticality") || "medium").trim().toLowerCase(),
        interviewFunctions: normalizeList(resolveHeader(row, "interviewFunctions")),
        actionPlan: String(resolveHeader(row, "actionPlan") || "").trim() || null,
        aiPrompt: String(resolveHeader(row, "aiPrompt") || "").trim(),
        risk: String(resolveHeader(row, "risk") || "").trim() || null,
        displayOrder: Number((row as any).__displayOrder),
      };

      if (!normalized.questionText) {
        issues.push(`[${sheetName}] Row ${normalized.displayOrder}: missing questionText`);
        skipped += 1;
        continue;
      }

      const questionKey = stableQuestionKey(normalized);
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
        aiPrompt: normalized.aiPrompt || autoAiPrompt(normalized.questionText, normalized.expectedEvidence || ""),
        displayOrder: normalized.displayOrder,
        questionKey,
        risk: normalized.risk,
        createdAt: new Date(),
      };

      const [existing] = await db.select().from(questions).where(eq(questions.questionKey, questionKey)).limit(1);
      if (existing) {
        await db.update(questions).set(payload).where(eq(questions.id, existing.id));
        updated += 1;
      } else {
        await db.insert(questions).values(payload);
        inserted += 1;
      }
    }
  }

  const report = { excelPath: EXCEL_PATH, inserted, updated, skipped, issues, requiredOutputColumns: REQUIRED_OUTPUT_COLUMNS };
  fs.writeFileSync(path.resolve("./import-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (issues.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
