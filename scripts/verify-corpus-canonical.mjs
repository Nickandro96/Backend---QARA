import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const sourcePath = new URL("./questions_import_ready.json", import.meta.url);
const source = JSON.parse(await readFile(sourcePath, "utf8"));
if (!Array.isArray(source)) throw new Error("Le corpus versionné doit être un tableau JSON.");

const keyOf = (row) => String(row.questionKey ?? "").trim();
const sourceKeys = source.map(keyOf).filter(Boolean).sort();
const duplicates = sourceKeys.filter((key, index) => key === sourceKeys[index - 1]);
if (duplicates.length) throw new Error(`Clés dupliquées dans Git: ${[...new Set(duplicates)].join(", ")}`);

const digest = createHash("sha256").update(sourceKeys.join("\n")).digest("hex");
const result = {
  checkedAt: new Date().toISOString(),
  sourceCount: sourceKeys.length,
  sourceQuestionKeySha256: digest,
  productionChecked: false,
  productionCount: null,
  missingInProduction: [],
  unexpectedInProduction: [],
  status: "SOURCE_ONLY",
};

if (process.env.DATABASE_URL) {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.query(
      "SELECT questionKey FROM questions WHERE COALESCE(isActive, 1) = 1 ORDER BY questionKey"
    );
    const productionKeys = rows.map(keyOf).filter(Boolean).sort();
    const sourceSet = new Set(sourceKeys);
    const productionSet = new Set(productionKeys);
    result.productionChecked = true;
    result.productionCount = productionKeys.length;
    result.missingInProduction = sourceKeys.filter((key) => !productionSet.has(key));
    result.unexpectedInProduction = productionKeys.filter((key) => !sourceSet.has(key));
    result.status = result.missingInProduction.length || result.unexpectedInProduction.length
      ? "MISMATCH"
      : "MATCH";
  } finally {
    await connection.end();
  }
}

const outputPath = new URL("../outputs/CORPUS-CANONICAL-STATUS.json", import.meta.url);
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));

if (!result.productionChecked) {
  console.error("DATABASE_URL absent : source vérifiée, production non rapprochée.");
  process.exitCode = 2;
} else if (result.status !== "MATCH") {
  process.exitCode = 1;
}
