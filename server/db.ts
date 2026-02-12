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
  // auditReports,
} from "../drizzle/schema";

/**
 * ---------------------------------------------------------
 * ✅ DRIZZLE MYSQL2 CONNECTION (FIX)
 * ---------------------------------------------------------
 * drizzle-orm/mysql2 attend un client mysql2 (pool/connection)
 *
 * Supporte:
 * - DATABASE_URL=mysql://user:pass@host:port/db
 * - ou variables séparées (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT)
 */

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getMysqlConfigFromEnv() {
  // 1) DATABASE_URL (recommandé)
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace("/", ""),
      // ssl: { rejectUnauthorized: true }, // si besoin
    };
  }

  // 2) Variables séparées
  if (
    process.env.MYSQL_HOST &&
    process.env.MYSQL_USER &&
    process.env.MYSQL_DATABASE
  ) {
    return {
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE,
    };
  }

  return null;
}

export async function getDb() {
  if (_db) return _db;

  const cfg = getMysqlConfigFromEnv();
  if (!cfg) {
    console.error("[Database] Missing DATABASE_URL or MYSQL_* env vars");
    return null;
  }

  try {
    if (!_pool) {
      _pool = mysql.createPool({
        ...cfg,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
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

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? { ...result[0], userId: result[0].id } : undefined;
}

/**
 * ⚠️ Ton appRouter appelle db.updateUserProfile()
 */
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
    console.error(
      "[Database] Failed to update user profile:",
      error?.message ?? error
    );
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
  return await db
    .select()
    .from(sites)
    .where(eq(sites.userId, userId))
    .orderBy(desc(sites.createdAt));
}

export async function getFirstSiteByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(sites)
    .where(eq(sites.userId, userId))
    .orderBy(sites.createdAt)
    .limit(1);
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

export async function createSite(siteData: {
  userId: number;
  name: string;
  code?: string;
  address?: string;
  country?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const [result] = await db.insert(sites).values({
      ...siteData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id: result.insertId };
  } catch (error: any) {
    console.error(
      "[Database] Failed to create site. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

/**
 * ---------------------------------------------------------
 * Organizations queries
 * ---------------------------------------------------------
 */

export async function getOrganisations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(organisations)
      .where(eq(organisations.userId, userId))
      .orderBy(desc(organisations.createdAt));
  } catch (error: any) {
    // ✅ FIX: ne bloque plus l'UI si table/colonnes pas prêtes (migrations)
    console.error("[DB][getOrganizations] FULL ERROR:", error);
    return [];
  }
}

export async function getOrganisationByIdAndUserId(
  organisationId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(organisations)
    .where(
      and(eq(organisations.id, organisationId), eq(organisations.userId, userId))
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrganisation(orgData: {
  userId: number;
  name: string;
  legalEntityType?: string;
  siret?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const [result] = await db.insert(organisations).values({
      ...orgData,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    return { id: result.insertId };
  } catch (error: any) {
    console.error(
      "[Database] Failed to create organization. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

/**
 * ---------------------------------------------------------
 * Audit queries (CRUD complet)
 * ---------------------------------------------------------
 */

export async function getAuditById(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, auditId), eq(audits.userId, userId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAudits(filters: {
  userId: number;
  siteId?: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(audits.userId, filters.userId)];
  if (filters.siteId) conditions.push(eq(audits.siteId, filters.siteId));
  if (filters.status)
    conditions.push(eq(audits.status as any, filters.status as any));

  return await db
    .select()
    .from(audits)
    .where(and(...conditions))
    .orderBy(desc(audits.createdAt));
}

export async function createAudit(auditData: {
  userId: number;
  siteId: number;
  name: string;
  auditType: string;
  status:
    | "draft"
    | "in_progress"
    | "closed"
    | "planned"
    | "completed"
    | "cancelled";
  startDate?: Date;
  endDate?: Date;

  referentialIds: string;
  processIds?: string;

  clientOrganization?: string | null;
  siteLocation?: string | null;
  auditorName?: string | null;
  auditorEmail?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const payload: Record<string, any> = {
      ...auditData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (payload.processIds === undefined) payload.processIds = JSON.stringify([]);

    const [result] = await (db as any).insert(audits).values(payload);
    return result.insertId as number;
  } catch (error: any) {
    console.error(
      "[Database] Failed to create audit. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

export async function updateAudit(
  auditId: number,
  patch: Partial<{
    name: string;
    auditStandard: string;
    auditType: string;
    economicRole: string;

    siteId: number;
    organizationId: number;

    startDate: Date;
    endDate: Date;

    referentialIds: string;
    processIds: string;

    auditors: string;
    observers: string;

    auditorName: string;
    auditorEmail: string;

    status: string;

    updatedAt: Date;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const data: Record<string, any> = {
      ...patch,
      updatedAt: new Date(),
    };

    await (db as any).update(audits).set(data).where(eq(audits.id, auditId));
    return { success: true };
  } catch (error: any) {
    console.error(
      "[Database] Failed to update audit. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

export async function deleteAudit(auditId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.delete(audits).where(eq(audits.id, auditId));
    return { success: true };
  } catch (error: any) {
    console.error(
      "[Database] Failed to delete audit. FULL ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  }
}

export async function compareAudits(
  audit1Id: number,
  audit2Id: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return null;

  const [a1] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, audit1Id), eq(audits.userId, userId)))
    .limit(1);

  const [a2] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.id, audit2Id), eq(audits.userId, userId)))
    .limit(1);

  if (!a1 || !a2) return null;

  const a1Refs = safeJsonParse<number[]>((a1 as any).referentialIds, []);
  const a2Refs = safeJsonParse<number[]>((a2 as any).referentialIds, []);
  const a1Procs = safeJsonParse<(string | number)[]>((a1 as any).processIds, []);
  const a2Procs = safeJsonParse<(string | number)[]>((a2 as any).processIds, []);

  return {
    audit1: a1,
    audit2: a2,
    parsed: {
      audit1: { referentialIds: a1Refs, processIds: a1Procs },
      audit2: { referentialIds: a2Refs, processIds: a2Procs },
    },
  };
}

/**
 * ---------------------------------------------------------
 * Users auth helpers
 * ---------------------------------------------------------
 */

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUser(data: {
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const [result] = await db
      .insert(users)
      .values({
        openId: data.openId,
        name: data.name,
        email: data.email,
        loginMethod: data.loginMethod,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          name: data.name,
          email: data.email,
          loginMethod: data.loginMethod,
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
      });

    return result.insertId;
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
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function storePasswordHash(openId: string, hash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.openId, openId));
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
  const result = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0].passwordHash : undefined;
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(users)
      .set({ role: role, updatedAt: new Date() })
      .where(eq(users.id, userId));
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
  // Assuming user profiles are part of the users table for now, or a separate profiles table
  // If there's a separate profiles table, this would need to be adjusted.
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function upsertUserProfile(userId: number, data: Partial<{
  subscriptionTier: "free" | "pro" | "expert" | "entreprise";
  subscriptionStatus: "active" | "canceled" | "past_due" | "trialing";
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const patch: Record<string, any> = { updatedAt: new Date() };

  if (data.subscriptionTier !== undefined) patch.subscriptionTier = data.subscriptionTier;
  if (data.subscriptionStatus !== undefined) patch.subscriptionStatus = data.subscriptionStatus;

  try {
    await (db as any).update(users).set(patch).where(eq(users.id, userId));
    return { success: true };
  } catch (error: any) {
    console.error(
      "[Database] Failed to upsert user profile:",
      error?.message ?? error
    );
    throw error;
  }
}

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

export async function getAllProcesses() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(processes).orderBy(processes.id);
  } catch (error) {
    console.error("[Database] Failed to get processes:", error);
    return [];
  }
}
