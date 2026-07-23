import fs from "fs";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";

function sha256(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Codes MySQL/MariaDB "déjà appliqué" tolérés — l'objet DB existe déjà avec
 * le nom attendu, donc rien à faire. Vérifiés par code symbolique (e.code,
 * ce que renvoie mysql2 en usage normal) ET par errno numérique (défense en
 * profondeur si un driver/une version renvoie uniquement le numéro — voir
 * incident du 2026-07-23, CORRECTIONS.md : 0026_mandatory_documents.sql avait
 * déjà été appliquée par le pipeline Railway hors de ce script, sans être
 * enregistrée dans _drizzle_migrations ; ER_FK_DUP_NAME (1826) n'était pas
 * toléré, ce qui a bloqué toute la chaîne de migrations à cette étape).
 */
const IGNORABLE_CODES: Record<string, number> = {
  ER_DUP_FIELDNAME: 1060, // Duplicate column name
  ER_DUP_KEYNAME: 1061, // Duplicate key name
  ER_TABLE_EXISTS_ERROR: 1050, // Table already exists
  ER_MULTIPLE_PRI_KEY: 1068, // Multiple primary key defined
  ER_FK_DUP_NAME: 1826, // Duplicate foreign key constraint name
  ER_NO_SUCH_TABLE: 1146, // Table doesn't exist yet (voir C-01 ci-dessous)
};

function isIgnorableMigrationError(e: any) {
  const code = e?.code;
  const errno = e?.errno;
  const msg = String(e?.sqlMessage || e?.message || "");

  // ✅ Cas typiques : colonnes déjà ajoutées / index déjà existant / table déjà
  // existante / contrainte déjà existante — par code symbolique OU par errno.
  for (const [symbolicCode, numericErrno] of Object.entries(IGNORABLE_CODES)) {
    if (code === symbolicCode || errno === numericErrno) return true;
  }

  if (code === "ER_CANT_DROP_FIELD_OR_KEY" && msg.includes("check that column/key exists")) return true;
  // ✅ Sur une base neuve, les migrations 0000-0017 (ALTER TABLE sur des tables
  // core créées historiquement hors du contrôle de version) échouent car ces
  // tables n'existent pas encore : 0018_baseline_core_tables.sql les crée en fin
  // de liste avec leur structure finale, ce qui rend ces échecs intermédiaires
  // sans conséquence (voir docs/audit/02-audit-technique.md, C-01).

  // Certaines variantes MySQL renvoient juste un message
  if (msg.toLowerCase().includes("duplicate column name")) return true;
  if (msg.toLowerCase().includes("duplicate key name")) return true;
  if (msg.toLowerCase().includes("duplicate foreign key constraint name")) return true;
  if (msg.toLowerCase().includes("already exists")) return true;
  if (msg.toLowerCase().includes("doesn't exist")) return true;

  return false;
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

  // 1) Ensure tracking table exists
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`_drizzle_migrations\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hash VARCHAR(64) NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  // Optionnel mais utile: éviter les doublons de hash
  try {
    await conn.execute(`CREATE UNIQUE INDEX \`_drizzle_migrations_hash_uq\` ON \`_drizzle_migrations\` (hash);`);
  } catch {
    // ignore if already exists
  }

  // 2) Load already applied hashes
  const [appliedRows] = await conn.query<any[]>(
    `SELECT hash FROM \`_drizzle_migrations\``
  );
  const applied = new Set(appliedRows.map((r) => String(r.hash)));

  // 3) Find migration files
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
      console.log(`Already applied (by hash): ${file} (${hash.slice(0, 8)}...)`);
      continue;
    }

    console.log(`Applying: ${file} (${hash.slice(0, 8)}...)`);

    try {
      await conn.beginTransaction();
      await conn.query(sql);

      // record hash
      await conn.execute(
        `INSERT IGNORE INTO \`_drizzle_migrations\` (hash, created_at) VALUES (?, ?)`,
        [hash, Date.now()]
      );

      await conn.commit();
      console.log(`✅ Applied: ${file}`);
      applied.add(hash);
    } catch (e: any) {
      await conn.rollback();

      // ✅ Si c’est un "déjà fait" (colonne existante, etc.), on baseline le hash
      if (isIgnorableMigrationError(e)) {
        console.warn(`⚠️ Migration already applied in DB, baselining hash: ${file}`);
        await conn.execute(
          `INSERT IGNORE INTO \`_drizzle_migrations\` (hash, created_at) VALUES (?, ?)`,
          [hash, Date.now()]
        );
        applied.add(hash);
        continue;
      }

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
