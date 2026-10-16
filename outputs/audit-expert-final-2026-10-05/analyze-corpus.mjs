import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const source = path.resolve(here, "../../scripts/questions_import_ready.json");
const questions = JSON.parse(fs.readFileSync(source, "utf8"));

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const has = (value) => clean(value).length > 0;
const quote = (value) => `"${clean(value).replaceAll('"', '""')}"`;
const genericText = /Prenez un dossier de lot récent\s*:/i;
const genericEvidence = /procédure ou instruction applicable/i;
const oldFdaRefs = /21\s*CFR\s*820\.(30|50|70|75|90|100|198)\b/i;
const qmsrContext = /(QMSR|ISO\s*13485)/i;
const samdTerms = /(IEC\s*62304|IEC\s*62366|MDCG\s*2021-24|MDCG\s*2022-21|SaMD|cybers[ée]curit|AI\/ML|IA\/ML)/i;
const latamTerms = /(RDC\s*665\/2022|ANVISA|COFEPRIS|INVIMA|NOTIVISA|ANMAT|NOM\b)/i;
const asiaTerms = /(PMDA|JPAL|TGA|ARTG|Health Canada|ANVISA)/i;
const sourceOfficial = /(europa\.eu|eur-lex\.europa\.eu|ecfr\.gov|fda\.gov|iso\.org|canada\.ca|tga\.gov\.au|gov\.br)/i;

const rows = questions.map((q, index) => {
  const blob = [q.title, q.questionText, q.reference, q.article, q.annexe, q.expectedEvidence, q.auditVerifies, q.explanationSimple, q.officialSource].join(" ");
  const exactReference = has(q.reference) && !/^(n\/?a|non renseign|à compléter)$/i.test(clean(q.reference));
  const evidence = has(q.expectedEvidence);
  const discriminating = has(q.auditVerifies) && Array.isArray(q.relances) && q.relances.length >= 1;
  const pedagogy = has(q.explanationSimple) && has(q.concreteExample);
  const grading = Boolean(q.conformityCriteria?.conforme && q.conformityCriteria?.non_conforme) && Array.isArray(q.typicalNc) && q.typicalNc.length >= 2;
  const official = has(q.officialSource) && sourceOfficial.test(q.officialSource);
  const staleFda = q.referentialCode === "FDA_QMSR" && oldFdaRefs.test(blob) && !qmsrContext.test(blob);
  const generic = genericText.test(q.questionText) || genericEvidence.test(q.expectedEvidence);
  const score = [exactReference, evidence, discriminating, pedagogy, grading, official].filter(Boolean).length;
  return {
    row: index + 1,
    questionKey: q.questionKey,
    referentialCode: q.referentialCode,
    processName: q.processName,
    reference: q.reference,
    title: q.title,
    questionText: q.questionText,
    exactReference,
    evidence,
    discriminating,
    pedagogy,
    grading,
    official,
    staleFda,
    generic,
    samd: samdTerms.test(blob),
    latam: latamTerms.test(blob),
    multiMarket: asiaTerms.test(blob),
    score,
  };
});

const byRef = {};
for (const row of rows) {
  const bucket = (byRef[row.referentialCode] ??= {
    count: 0,
    exactReference: 0,
    evidence: 0,
    discriminating: 0,
    pedagogy: 0,
    grading: 0,
    official: 0,
    staleFda: 0,
    generic: 0,
    samd: 0,
    latam: 0,
    multiMarket: 0,
    scoreSum: 0,
    processes: {},
  });
  bucket.count += 1;
  for (const key of ["exactReference", "evidence", "discriminating", "pedagogy", "grading", "official", "staleFda", "generic", "samd", "latam", "multiMarket"]) {
    bucket[key] += row[key] ? 1 : 0;
  }
  bucket.scoreSum += row.score;
  bucket.processes[row.processName] = (bucket.processes[row.processName] ?? 0) + 1;
}

const duplicateTitles = Object.entries(rows.reduce((acc, row) => {
  const key = clean(row.title).toLowerCase();
  (acc[key] ??= []).push(row.questionKey);
  return acc;
}, {})).filter(([, keys]) => keys.length > 1).map(([title, keys]) => ({ title, keys }));

const duplicateTexts = Object.entries(rows.reduce((acc, row) => {
  const key = clean(row.questionText).toLowerCase();
  (acc[key] ??= []).push(row.questionKey);
  return acc;
}, {})).filter(([, keys]) => keys.length > 1).map(([questionText, keys]) => ({ questionText, keys }));

const summary = {
  generatedAt: new Date().toISOString(),
  source: source.replaceAll("\\", "/"),
  total: rows.length,
  byRef,
  duplicateTitles,
  duplicateTexts,
  global: {
    exactReference: rows.filter((r) => r.exactReference).length,
    evidence: rows.filter((r) => r.evidence).length,
    discriminating: rows.filter((r) => r.discriminating).length,
    pedagogy: rows.filter((r) => r.pedagogy).length,
    grading: rows.filter((r) => r.grading).length,
    official: rows.filter((r) => r.official).length,
    generic: rows.filter((r) => r.generic).length,
    staleFda: rows.filter((r) => r.staleFda).length,
  },
};

fs.writeFileSync(path.join(here, "corpus-analysis.json"), JSON.stringify(summary, null, 2));
const columns = ["row", "questionKey", "referentialCode", "processName", "reference", "title", "questionText", "exactReference", "evidence", "discriminating", "pedagogy", "grading", "official", "staleFda", "generic", "samd", "latam", "multiMarket", "score"];
const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => quote(row[column])).join(","))].join("\n");
fs.writeFileSync(path.join(here, "corpus-question-by-question.csv"), `\uFEFF${csv}`);

const issues = rows.filter((r) => r.score < 6 || r.staleFda || r.generic);
const issueCsv = [columns.join(","), ...issues.map((row) => columns.map((column) => quote(row[column])).join(","))].join("\n");
fs.writeFileSync(path.join(here, "corpus-issues.csv"), `\uFEFF${issueCsv}`);

console.log(JSON.stringify(summary, null, 2));
