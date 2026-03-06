import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { questions, referentiels, processus } from "../drizzle/schema";

const EXCEL_PATH =
  process.env.EXCEL_PATH || "data/Questionnaires audits FDA - tous les ref.xlsx";
const SHEET_NAME = process.env.SHEET_NAME || "";
const DEFAULT_REFERENTIAL =
  process.env.DEFAULT_REFERENTIAL || "FDA_QSR_21CFR820";
const STRICT_FDA_FILE = process.env.STRICT_FDA_FILE === "1";
const DRY_RUN = process.env.DRY_RUN === "1";

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
  processLabel: [
    "processus",
    "process",
    "process label",
    "main process",
  ],
  subProcessLabel: [
    "sous-processus / activité",
    "sous-processus",
    "sub-process",
    "subprocess",
    "activité",
  ],
  referential: [
    "référentiel fda",
    "referential",
    "référentiel",
    "framework",
    "frameworkcode",
  ],
  article: [
    "référence exacte",
    "article",
    "clause",
    "21 cfr",
    "reference",
  ],
  annexe: ["annexe", "annex", "subpart", "section"],
  title: [
    "question d’audit (courte)",
    "question d'audit (courte)",
    "title",
    "intitulé",
    "chapter",
    "process title",
    "thème",
  ],
  economicRole: ["economicrole", "role", "rôle", "role économique"],
  applicableProcesses: ["applicableprocesses", "processus concernés", "processes"],
  questionType: ["questiontype", "type"],
  questionText: [
    "question d’audit (détaillée, ouverte, vérifiable)",
    "question d'audit (détaillée, ouverte, vérifiable)",
    "questiontext",
    "question d'audit détaillée",
    "question",
    "detailed question",
  ],
  expectedEvidence: [
    "preuves attendues (documents & enregistrements)",
    "expectedevidence",
    "preuves attendues",
    "expected evidence",
  ],
  criticality: ["criticité", "criticality"],
  interviewFunctions: [
    "interviews (rôles/fonctions)",
    "interviews (roles/fonctions)",
    "interviewfunctions",
    "fonctions interrogées",
    "interviewed functions",
  ],
  actionPlan: [
    "test terrain / échantillonnage recommandé",
    "test terrain / echantillonnage recommandé",
    "actionplan",
    "plan d'action",
    "action plan",
  ],
  aiPrompt: ["aiprompt", "ai prompt"],
  risk: [
    "risque en cas de nc (angle fda)",
    "risque en cas de nc",
    "risk",
    "risque",
  ],
};

function slug(input: unknown) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugKey(input: unknown) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function stableQuestionKey(row: Record<string, any>) {
  const seed = [
    row.referentialCode,
    row.article,
    row.annexe,
    row.title,
    row.questionText,
  ]
    .map((x) => String(x ?? "").trim())
    .join("|");

  return `fda_${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

function autoAiPrompt(
  questionText: string,
  expectedEvidence: string,
  risk: string,
) {
  return [
    "Explain this FDA requirement in plain language.",
    "Describe what strong compliance looks like during an inspection.",
    `Requirement: ${questionText}`,
    `Expected evidence: ${expectedEvidence || "Not provided"}`,
    `Inspection risk if non-compliant: ${risk || "Not provided"}`,
    "Suggest a concise CAPA-ready action plan.",
  ].join(" ");
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  const s = String(value ?? "").trim();
  if (!s) return [];

  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}

  return s
    .split(/[;,\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function resolveHeader(row: Record<string, any>, logical: keyof typeof HEADER_ALIASES) {
  const entries = Object.entries(row);
  const aliases = HEADER_ALIASES[logical].map(slug);
  const found = entries.find(([key]) => aliases.includes(slug(key)));
  return found?.[1];
}

function normalizeReferentialCode(raw: string) {
  const s = slug(raw);

  if (
    s.includes("820") ||
    s.includes("qmsr") ||
    s.includes("part 820") ||
    s.includes("21 cfr part 820")
  ) {
    return "FDA_QSR_21CFR820";
  }

  if (
    s.includes("807") ||
    s.includes("510k") ||
    s.includes("de novo") ||
    s.includes("pma") ||
    s.includes("udi") ||
    s.includes("postmarket") ||
    s.includes("labeling")
  ) {
    return "FDA_US_MARKET_ACCESS";
  }

  return DEFAULT_REFERENTIAL;
}

function normalizeProcessName(raw: string) {
  const s = slug(raw);

  if (s === "ra") return "RA";
  if (s === "qms") return "QMS";
  if (s === "qmsr") return "QMSR";
  if (s === "postmarket") return "Postmarket";
  if (s === "labeling") return "Labeling";
  if (s.includes("traceabilite") || s.includes("udi")) return "Traçabilité & UDI";

  return String(raw || "").trim() || "General FDA";
}

function buildProcessSlug(raw: string) {
  return `fda_${slugKey(raw)}`;
}

async function getOrCreateProcessId(
  db: any,
  processLabel: string,
  processCache: Map<string, number>,
) {
  const normalizedName = normalizeProcessName(processLabel);
  const processSlug = buildProcessSlug(normalizedName);
  const cacheKey = slug(processSlug);

  if (processCache.has(cacheKey)) {
    return processCache.get(cacheKey)!;
  }

  const allProcesses = await db.select().from(processus);

  const bySlug = allProcesses.find(
    (p: any) => slug((p as any).slug) === slug(processSlug),
  );
  if (bySlug?.id) {
    processCache.set(cacheKey, bySlug.id);
    return bySlug.id;
  }

  const byName = allProcesses.find(
    (p: any) => slug((p as any).name) === slug(normalizedName),
  );
  if (byName?.id) {
    processCache.set(cacheKey, byName.id);
    return byName.id;
  }

  if (DRY_RUN) {
    return -1;
  }

  const insertResult: any = await db.insert(processus).values({
    name: normalizedName,
    slug: processSlug,
    description: `FDA imported process - ${normalizedName}`,
    displayOrder: null,
    icon: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const insertedId =
    Number(insertResult?.insertId) ||
    Number(insertResult?.[0]?.insertId) ||
    null;

  if (!insertedId) {
    throw new Error(`Unable to create process '${normalizedName}'`);
  }

  processCache.set(cacheKey, insertedId);
  return insertedId;
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
  }

  if (STRICT_FDA_FILE && !EXCEL_PATH.toLowerCase().includes("fda")) {
    throw new Error(
      `STRICT_FDA_FILE is enabled but EXCEL_PATH does not look like an FDA workbook: ${EXCEL_PATH}`,
    );
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheets = SHEET_NAME ? [SHEET_NAME] : workbook.SheetNames;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const refRows = await db.select().from(referentiels);
  const refMap = new Map(refRows.map((r: any) => [String(r.code), r.id]));

  const processCache = new Map<string, number>();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let createdProcesses = 0;
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
      const rawReferential = String(
        resolveHeader(row, "referential") || DEFAULT_REFERENTIAL || sheetName,
      ).trim();

      const referentialCode = normalizeReferentialCode(rawReferential);
      const referentialId = refMap.get(referentialCode);

      if (!referentialId) {
        issues.push(`[${sheetName}] Unknown referential code: ${referentialCode}`);
        skipped += 1;
        continue;
      }

      const processLabel = String(resolveHeader(row, "processLabel") || "").trim();
      const subProcessLabel = String(resolveHeader(row, "subProcessLabel") || "").trim();

      if (!processLabel) {
        issues.push(`[${sheetName}] Row ${(row as any).__displayOrder}: missing Processus`);
        skipped += 1;
        continue;
      }

      const processId = await getOrCreateProcessId(db, processLabel, processCache);
      if (!processId || processId === -1 && !DRY_RUN) {
        issues.push(
          `[${sheetName}] Row ${(row as any).__displayOrder}: unable to resolve processId for '${processLabel}'`,
        );
        skipped += 1;
        continue;
      }

      if (processId === -1) {
        createdProcesses += 1;
      }

      const applicableProcesses = [normalizeProcessName(processLabel)];
      if (subProcessLabel) applicableProcesses.push(subProcessLabel);

      const normalized = {
        referentialCode,
        referentialId,
        processId,
        article: String(resolveHeader(row, "article") || "").trim() || null,
        annexe: String(resolveHeader(row, "annexe") || "").trim() || null,
        title: String(resolveHeader(row, "title") || "General").trim(),
        economicRole: String(resolveHeader(row, "economicRole") || "all").trim() || "all",
        applicableProcesses,
        questionType: String(resolveHeader(row, "questionType") || "open").trim() || "open",
        questionText: String(resolveHeader(row, "questionText") || "").trim(),
        expectedEvidence: String(resolveHeader(row, "expectedEvidence") || "").trim() || null,
        criticality: String(resolveHeader(row, "criticality") || "medium")
          .trim()
          .toLowerCase(),
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
        aiPrompt:
          normalized.aiPrompt ||
          autoAiPrompt(
            normalized.questionText,
            normalized.expectedEvidence || "",
            normalized.risk || "",
          ),
        displayOrder: normalized.displayOrder,
        questionKey,
        risk: normalized.risk,
        createdAt: new Date(),
      };

      const [existing] = await db
        .select()
        .from(questions)
        .where(eq(questions.questionKey, questionKey))
        .limit(1);

      if (DRY_RUN) {
        if (existing) updated += 1;
        else inserted += 1;
        continue;
      }

      if (existing) {
        await db.update(questions).set(payload).where(eq(questions.id, existing.id));
        updated += 1;
      } else {
        await db.insert(questions).values(payload);
        inserted += 1;
      }
    }
  }

  const report = {
    excelPath: EXCEL_PATH,
    inserted,
    updated,
    skipped,
    createdProcesses,
    dryRun: DRY_RUN,
    issues,
    requiredOutputColumns: REQUIRED_OUTPUT_COLUMNS,
  };

  fs.writeFileSync(
    path.resolve("./import-report.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(JSON.stringify(report, null, 2));

  if (issues.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
