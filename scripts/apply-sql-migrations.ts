import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";

function sha256(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing");

  const u = new URL(url);
  const dbName = u.pathname.replace("/", "");

  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: dbName,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`_drizzle_migrations\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hash VARCHAR(64) NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  const [appliedRows] = await conn.query<any[]>(
    `SELECT hash FROM \`_drizzle_migrations\``
  );
  const applied = new Set(appliedRows.map((r) => String(r.hash)));

  const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("No migrations directory found:", migrationsDir);
    await conn.end();
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("No .sql migrations found in", migrationsDir);
    await conn.end();
    return;
  }

  console.log("Found migrations:", files);

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8").trim();

    if (!sql) {
      console.log(`Skip empty migration: ${file}`);
      continue;
    }

    const hash = sha256(sql);

    if (applied.has(hash)) {
      console.log(`Already applied: ${file} (${hash.slice(0, 8)}...)`);
      continue;
    }

    console.log(`Applying: ${file} (${hash.slice(0, 8)}...)`);
    try {
      await conn.beginTransaction();
      await conn.query(sql);
      await conn.execute(
        `INSERT INTO \`_drizzle_migrations\` (hash, created_at) VALUES (?, ?)`,
        [hash, Date.now()]
      );
      await conn.commit();
      console.log(`✅ Applied: ${file}`);
    } catch (e: any) {
      await conn.rollback();
      console.error(`❌ Failed: ${file}`);
      throw e;
    }
  }

  async function printCols(table: string) {
    const [cols] = await conn.query<any[]>(
      `SELECT COLUMN_NAME, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [table]
    );
    console.log(`\n${table} columns:`);
    console.table(cols);
  }

  await printCols("sites");
  await printCols("organisations");

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
