import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, audits, sites, organizations, evidenceFiles } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// User Profile queries
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Note: userProfiles removed from schema for stabilization, 
  // returning basic user data for now or check if table exists
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? { ...result[0], userId: result[0].id } : undefined;
}

// Sites queries
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
  const result = await db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.userId, userId))).limit(1);
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
    console.error("[Database] Failed to create site. FULL ERROR:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}

// Audit queries
export async function getAuditById(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(audits).where(and(eq(audits.id, auditId), eq(audits.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAudits(filters: {
  userId: number;
  siteId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(audits.userId, filters.userId)];
  if (filters.siteId) {
    conditions.push(eq(audits.siteId, filters.siteId));
  }
  return await db.select().from(audits).where(and(...conditions)).orderBy(desc(audits.createdAt));
}

export async function createAudit(auditData: {
  userId: number;
  siteId: number;
  name: string;
  auditType: string;
  status: "draft" | "in_progress" | "closed";
  startDate?: Date;
  endDate?: Date;
  referentialIds: string; // JSON string
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const [result] = await db.insert(audits).values({
      ...auditData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return result.insertId;
  } catch (error: any) {
    console.error("[Database] Failed to create audit. FULL ERROR:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}

export async function getOrganizations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(organizations).where(eq(organizations.userId, userId)).orderBy(desc(organizations.createdAt));
}

export async function getOrganizationByIdAndUserId(organizationId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(and(eq(organizations.id, organizationId), eq(organizations.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
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
    const [result] = await db.insert(users)
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
    console.error("[Database] Failed to upsert user. FULL ERROR:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function storePasswordHash(openId: string, hash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.openId, openId));
  } catch (error: any) {
    console.error("[Database] Failed to store password hash. FULL ERROR:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw error;
  }
}
