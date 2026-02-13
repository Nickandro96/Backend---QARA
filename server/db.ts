import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import {
  users,
  audits,
  sites,
  organisations,
  evidenceFiles,
  referentials,
  processus,
} from "../drizzle/schema";

/**
 * ---------------------------------------------------------
 * ✅ DRIZZLE MYSQL2 CONNECTION (Railway-friendly + SSL)
 * ---------------------------------------------------------
 * Supports multiple env styles:
 *
 * 1) DATABASE_URL=mysql://user:pass@host:port/db
 *
 * 2) Railway / other providers URL variants:
 *    - MYSQL_URL
 *    - MYSQL_PRIVATE_URL
 *    - MYSQL_PUBLIC_URL
 *
 * 3) Railway-style split vars (uppercase no underscores):
 *    - MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLPORT
 *
 * 4) Split vars with underscores:
 *    - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT
 *
 * 5) Generic DB_* split vars:
 *    - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
 *
 * ✅ Important:
 * - Public managed endpoints often require TLS.
 * - We enable ssl={ rejectUnauthorized:false } for managed/public URLs (Railway).
 */

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function pickFirstEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return undefined;
}

type MysqlCfg = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: any;
  _source?: string;
};

function parseMysqlUrl(urlString: string, source: string): MysqlCfg | null {
  try {
    const url = new URL(urlString);

    // accept mysql:// or mysqls://
    if (!url.protocol.startsWith("mysql")) return null;

    const host = url.hostname;
    const port = url.port ? Number(url.port) : 3306;
    const user = decodeURIComponent(url.username ?? "");
    const password = decodeURIComponent(url.password ?? "");
    const database = (url.pathname ?? "").replace("/", "");

    if (!host || !user || !database) return null;

    const sslHint =
      url.searchParams.get("ssl") ||
      url.searchParams.get("sslmode") ||
      url.searchParams.get("ssl-mode") ||
      url.searchParams.get("tls");

    const looksManagedOrPublic =
      /railway\.app/i.test(host) ||
      /public/i.test(source) ||
      (sslHint && ["1", "true", "yes", "require", "required"].includes(sslHint.toLowerCase()));

    const ssl = looksManagedOrPublic ? { rejectUnauthorized: false } : undefined;

    return { host, port, user, password, database, ssl, _source: source };
  } catch {
    return null;
  }
}

function getMysqlConfigFromEnv(): MysqlCfg | null {
  // ✅ Prefer private URL inside Railway network (most reliable)
  const privateUrl = pickFirstEnv("MYSQL_PRIVATE_URL");
  if (privateUrl) {
    const parsed = parseMysqlUrl(privateUrl, "MYSQL_PRIVATE_URL");
    if (parsed) return parsed;
  }

  // ✅ Then DATABASE_URL
  const dbUrl = pickFirstEnv("DATABASE_URL");
  if (dbUrl) {
    const parsed = parseMysqlUrl(dbUrl, "DATABASE_URL");
    if (parsed) return parsed;
  }

  // ✅ Then public URL
  const publicUrl = pickFirstEnv("MYSQL_PUBLIC_URL", "MYSQL_URL");
  if (publicUrl) {
    const parsed = parseMysqlUrl(publicUrl, "MYSQL_PUBLIC_URL");
    if (parsed) return parsed;
  }

  // ✅ Railway split vars (no underscores)
  const rh = pickFirstEnv("MYSQLHOST");
  const ru = pickFirstEnv("MYSQLUSER");
  const rp = pickFirstEnv("MYSQLPASSWORD") ?? "";
  const rd = pickFirstEnv("MYSQLDATABASE");
  const rport = pickFirstEnv("MYSQLPORT");

  if (rh && ru && rd) {
    return {
      host: rh,
      port: rport ? Number(rport) : 3306,
      user: ru,
      password: rp,
      database: rd,
      _source: "MYSQLHOST/MYSQLUSER",
    };
  }

  // ✅ Split vars with underscores
  const uh = pickFirstEnv("MYSQL_HOST");
  const uu = pickFirstEnv("MYSQL_USER");
  const up = pickFirstEnv("MYSQL_PASSWORD") ?? "";
  const ud = pickFirstEnv("MYSQL_DATABASE");
  const uport = pickFirstEnv("MYSQL_PORT");

  if (uh && uu && ud) {
    return {
      host: uh,
      port: uport ? Number(uport) : 3306,
      user: uu,
      password: up,
      database: ud,
      _source: "MYSQL_HOST/MYSQL_USER",
    };
  }

  // ✅ Generic DB_* split vars (fallback)
  const dh = pickFirstEnv("DB_HOST");
  const du = pickFirstEnv("DB_USER");
  const dp = pickFirstEnv("DB_PASSWORD") ?? "";
  const dn = pickFirstEnv("DB_NAME");
  const dport = pickFirstEnv("DB_PORT");

  if (dh && du && dn) {
    return {
      host: dh,
      port: dport ? Number(dport) : 3306,
      user: du,
      password: dp,
      database: dn,
      _source: "DB_HOST/DB_USER",
    };
  }

  return null;
}

export async function getDb() {
  if (_db) return _db;

  const cfg = getMysqlConfigFromEnv();
  if (!cfg) {
    console.error("[Database] Missing DB env vars. Provide DATABASE_URL (recommended) or MYSQL_*.");
    return null;
  }

  try {
    if (!_pool) {
      console.log(
        `[Database] Connecting via ${cfg._source ?? "unknown"} host=${cfg.host} port=${cfg.port} db=${cfg.database} ssl=${cfg.ssl ? "on" : "off"}`
      );

      _pool = mysql.createPool({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        ...(cfg.ssl ? { ssl: cfg.ssl } : {}),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // ✅ Fail-fast
      const conn = await _pool.getConnection();
      await conn.ping();
      conn.release();
      console.log("[Database] MySQL ping OK");
    }

    _db = drizzle(_pool);
    return _db;
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    _db = null;
    return null;
  }
}

/**
 * ---------------------------------------------------------
 * ✅ Helpers
 * ---------------------------------------------------------
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  try {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return fallback;
      return JSON.parse(s) as T;
    }
    return value as T;
  } catch {
    return fallback;
  }
}

/**
 * ---------------------------------------------------------
 * User Profile queries
 * ---------------------------------------------------------
 */

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? { ...result[0], userId: result[0].id } : undefined;
}

export async function updateUserProfile(
  userId: number,
  input: { economicRole?: string; companyName?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const patch: Record<string, any> = { updatedAt: new Date() };

  if (input.economicRole !== undefined) patch.economicRole = input.economicRole;
  if (input.companyName !== undefined) patch.companyName = input.companyName;

  try {
    await (db as any).update(users).set(patch).where(eq(users.id, userId));
    return { success: true };
  } catch (error: any) {
    console.error("[Database] Failed to update user profile:", error?.message ?? error);
    throw error;
  }
}

/**
 * ---------------------------------------------------------
 * Sites queries
 * ---------------------------------------------------------
 */

export async function getSites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sites).where(eq(sites.userId, userId)).orderBy(desc(sites.createdAt));
}

export async function getFirstSiteByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sites).where(eq(sites.userId, userId)).orderBy(sites.createdAt).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSiteByIdAndUserId(siteId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSite(input: {
  userId: number;
  name: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  isMainSite?: boolean;
  organisationId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payload: any = {
    userId: input.userId,
    name: input.name,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? null,
    isMainSite: input.isMainSite ?? false,
    organisationId: input.organisationId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.insert(sites).values(payload as any);
  return { id: (result as any).insertId, ...payload };
}

/**
 * ---------------------------------------------------------
 * Organisations queries
 * ---------------------------------------------------------
 */

export async function upsertOrganisation(input: {
  id?: number;
  userId: number;
  name: string;
  siret?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payload: any = {
    userId: input.userId,
    name: input.name,
    siret: input.siret ?? null,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? null,
    updatedAt: new Date(),
  };

  try {
    if (input.id) {
      await db
        .update(organisations)
        .set(payload)
        .where(and(eq(organisations.id, input.id), eq(organisations.userId, input.userId)));
      return { id: input.id, ...payload };
    } else {
      const result = await db.insert(organisations).values({
        ...payload,
        createdAt: new Date(),
      } as any);
      return { id: (result as any).insertId, ...payload };
    }
  } catch (error: any) {
    console.error("[Database] Failed to upsert organisation:", error?.message ?? error);
    throw error;
  }
}

export async function getOrganisations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(organisations).where(eq(organisations.userId, userId)).orderBy(desc(organisations.createdAt));
}

export async function getOrganisationByIdAndUserId(orgId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(organisations)
    .where(and(eq(organisations.id, orgId), eq(organisations.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * ---------------------------------------------------------
 * Audits
 * ---------------------------------------------------------
 */

export async function createAudit(input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const payload: any = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.insert(audits).values(payload as any);
  return { id: (result as any).insertId, ...payload };
}

export async function listAuditsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(audits).where(eq(audits.userId, userId)).orderBy(desc(audits.createdAt));
}

export async function getAuditByIdAndUserId(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * ---------------------------------------------------------
 * Evidence Files
 * ---------------------------------------------------------
 */
export async function createEvidenceFile(input: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const payload: any = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.insert(evidenceFiles).values(payload as any);
  return { id: (result as any).insertId, ...payload };
}

export async function listEvidenceFilesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(evidenceFiles).where(eq(evidenceFiles.userId, userId)).orderBy(desc(evidenceFiles.createdAt));
}

/**
 * ---------------------------------------------------------
 * Referential / Process master data
 * ---------------------------------------------------------
 */

export async function getAllReferentials() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(referentials).orderBy(referentials.id);
  } catch (error) {
    console.error("[Database] Failed to get referentials:", error);
    return [];
  }
}

/**
 * ✅ FIX: processes -> processus (sinon crash)
 */
export async function getAllProcesses() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(processus).orderBy(processus.id);
  } catch (error) {
    console.error("[Database] Failed to get processes:", error);
    return [];
  }
}

/**
 * ---------------------------------------------------------
 * Users
 * ---------------------------------------------------------
 */

export async function upsertUser(data: {
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
  lastSignedIn?: Date;
  role?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();

  const payload: any = {
    openId: data.openId,
    name: data.name ?? null,
    email: data.email ?? null,
    loginMethod: data.loginMethod ?? null,
    role: data.role ?? "user",
    lastSignedIn: data.lastSignedIn ?? now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await db
      .insert(users)
      .values(payload as any)
      .onDuplicateKeyUpdate({
        set: {
          name: data.name,
          email: data.email,
          loginMethod: data.loginMethod,
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
      });

    return (result as any).insertId;
  } catch (error: any) {
    console.error(
      "[Database] Failed to upsert user. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function storePasswordHash(openId: string, hash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.openId, openId));
  } catch (error: any) {
    console.error(
      "[Database] Failed to store password hash. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

export async function getPasswordHash(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0].passwordHash : undefined;
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.update(users).set({ role: role, updatedAt: new Date() }).where(eq(users.id, userId));
    return { success: true };
  } catch (error: any) {
    console.error(
      "[Database] Failed to update user role. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function listAllUserProfiles() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function upsertUserProfile(
  userId: number,
  data: Partial<{
    subscriptionTier: "free" | "pro" | "expert" | "entreprise";
    subscriptionStatus: "active" | "canceled" | "past_due" | "trialing";
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const patch: Record<string, any> = { updatedAt: new Date() };

  if (data.subscriptionTier !== undefined) patch.subscriptionTier = data.subscriptionTier;
  if (data.subscriptionStatus !== undefined) patch.subscriptionStatus = data.subscriptionStatus;

  try {
    await (db as any).update(users).set(patch).where(eq(users.id, userId));
    return { success: true };
  } catch (error: any) {
    console.error("[Database] Failed to upsert user profile:", error?.message ?? error);
    throw error;
  }
}
