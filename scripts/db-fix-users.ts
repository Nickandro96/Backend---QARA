import mysql from "mysql2/promise";

function pickFirstEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim() !== "") return String(v);
  }
  return undefined;
}

async function columnExists(conn: mysql.Connection, table: string, column: string) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  const cnt = (rows as any[])[0]?.cnt ?? 0;
  return Number(cnt) > 0;
}

async function addColumnIfMissing(conn: mysql.Connection, table: string, column: string, ddl: string) {
  const exists = await columnExists(conn, table, column);
  if (exists) {
    console.log(`[DB FIX] OK: ${table}.${column} already exists`);
    return;
  }
  console.log(`[DB FIX] ADD: ${table}.${column}`);
  await conn.query(ddl);
  console.log(`[DB FIX] DONE: ${table}.${column} added`);
}

async function main() {
  const url =
    pickFirstEnv("DATABASE_URL", "MYSQL_PRIVATE_URL", "MYSQL_PUBLIC_URL", "MYSQL_URL") ?? "";

  if (!url) {
    console.error("[DB FIX] Missing DATABASE_URL (or MYSQL_*_URL) env var");
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);

  try {
    // ✅ minimum pour débloquer ton login
    await addColumnIfMissing(
      conn,
      "users",
      "passwordHash",
      "ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255) NULL"
    );

    // Bonus (souvent attendues par ton backend)
    await addColumnIfMissing(conn, "users", "firstName", "ALTER TABLE `users` ADD COLUMN `firstName` varchar(255) NULL");
    await addColumnIfMissing(conn, "users", "lastName", "ALTER TABLE `users` ADD COLUMN `lastName` varchar(255) NULL");
    await addColumnIfMissing(conn, "users", "name", "ALTER TABLE `users` ADD COLUMN `name` varchar(255) NULL");
    await addColumnIfMissing(conn, "users", "openId", "ALTER TABLE `users` ADD COLUMN `openId` varchar(255) NULL");
    await addColumnIfMissing(conn, "users", "loginMethod", "ALTER TABLE `users` ADD COLUMN `loginMethod` varchar(255) NULL");
    await addColumnIfMissing(conn, "users", "lastSignedIn", "ALTER TABLE `users` ADD COLUMN `lastSignedIn` datetime NULL");
    await addColumnIfMissing(conn, "users", "economicRole", "ALTER TABLE `users` ADD COLUMN `economicRole` varchar(255) NULL");
    await addColumnIfMissing(conn, "users", "companyName", "ALTER TABLE `users` ADD COLUMN `companyName` varchar(255) NULL");
    await addColumnIfMissing(conn, "users", "subscriptionTier", "ALTER TABLE `users` ADD COLUMN `subscriptionTier` varchar(50) NULL");
    await addColumnIfMissing(conn, "users", "subscriptionStatus", "ALTER TABLE `users` ADD COLUMN `subscriptionStatus` varchar(50) NULL");
    await addColumnIfMissing(conn, "users", "role", "ALTER TABLE `users` ADD COLUMN `role` varchar(50) NOT NULL DEFAULT 'user'");
    await addColumnIfMissing(conn, "users", "createdAt", "ALTER TABLE `users` ADD COLUMN `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await addColumnIfMissing(
      conn,
      "users",
      "updatedAt",
      "ALTER TABLE `users` ADD COLUMN `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );

    console.log("[DB FIX] ✅ Completed");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("[DB FIX] ❌ Failed:", e);
  process.exit(1);
});