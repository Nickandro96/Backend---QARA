import { eq, and, inArray, sql, desc, or, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, userProfiles, demoUsage, referentials, processes, questions, auditResponses, evidenceFiles, badges, regulatoryUpdates, complianceSprints, watchAlertPreferences, audits, sites, findings, actions } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// User Profile queries
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  // Get profile with user data (for role check in permissions)
  const result = await db
    .select({
      id: userProfiles.id,
      userId: userProfiles.userId,
      economicRole: userProfiles.economicRole,
      companyName: userProfiles.companyName,
      subscriptionTier: userProfiles.subscriptionTier,
      subscriptionStatus: userProfiles.subscriptionStatus,
      subscriptionStartDate: userProfiles.subscriptionStartDate,
      subscriptionEndDate: userProfiles.subscriptionEndDate,
      stripeCustomerId: userProfiles.stripeCustomerId,
      stripeSubscriptionId: userProfiles.stripeSubscriptionId,
      createdAt: userProfiles.createdAt,
      updatedAt: userProfiles.updatedAt,
      user: {
        id: users.id,
        role: users.role,
        email: users.email,
        name: users.name,
      },
    })
    .from(userProfiles)
    .leftJoin(users, eq(userProfiles.userId, users.id))
    .where(eq(userProfiles.userId, userId))
    .limit(1);
    
  return result.length > 0 ? result[0] : undefined;
}

// Demo usage queries
export async function getDemoUsage(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(demoUsage).where(eq(demoUsage.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function markDemoAsUsed(userId: number) {
  const db = await getDb();
  if (!db) return;

  const existing = await getDemoUsage(userId);
  
  if (existing) {
    await db.update(demoUsage)
      .set({ hasUsedDemo: true, usedAt: new Date() })
      .where(eq(demoUsage.userId, userId));
  } else {
    await db.insert(demoUsage).values({
      userId,
      hasUsedDemo: true,
      usedAt: new Date(),
    });
  }
}

export async function upsertUserProfile(userId: number, data: {
  economicRole?: "fabricant" | "importateur" | "distributeur";
  companyName?: string;
  subscriptionTier?: "free" | "pro" | "expert" | "entreprise";
}) {
  const db = await getDb();
  if (!db) return;

  const existing = await getUserProfile(userId);
  
  if (existing) {
    await db.update(userProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({
      userId,
      ...data,
    });
  }
}

// Referentials queries
export async function getAllReferentials() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(referentials);
}

export async function getReferentialByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(referentials).where(eq(referentials.code, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Processes queries
export async function getAllProcesses() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(processes).orderBy(processes.displayOrder);
}

// Questions queries
export async function getQuestions(filters: {
  referentialId?: number;
  processId?: number;
  economicRole?: "fabricant" | "importateur" | "distributeur" | "manufacturer_us" | "specification_developer" | "contract_manufacturer" | "initial_importer" | "tous";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  
  if (filters.referentialId) {
    conditions.push(eq(questions.referentialId, filters.referentialId));
  }
  
  if (filters.processId) {
    conditions.push(eq(questions.processId, filters.processId));
  }
  
  if (filters.economicRole) {
    conditions.push(
      sql`(${questions.economicRole} = ${filters.economicRole} OR ${questions.economicRole} = 'tous')`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db.select().from(questions)
    .where(whereClause)
    .orderBy(questions.displayOrder);
  
  // Parse JSON fields
  return results.map(q => {
    let parsedEvidence = null;
    try {
      parsedEvidence = q.evidence ? JSON.parse(q.evidence as string) : null;
    } catch (e) {
      console.error("Error parsing evidence JSON for question", q.id, e);
    }
    return { ...q, evidence: parsedEvidence };
  });
}

// Audit queries
export async function getAuditById(auditId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(audits).where(eq(audits.id, auditId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAuditsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(audits).where(eq(audits.userId, userId)).orderBy(desc(audits.createdAt));
}

export async function createAudit(auditData: {
  userId: number;
  siteId?: number;
  name: string;
  auditType: string;
  status?: "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  startDate?: Date;
  endDate?: Date | null;
  score?: number | null;
  conformityRate?: number | null;
  referentials: string; // JSON string
  siteLocation?: string;
  clientOrganization?: string;
  auditorName?: string;
  auditorEmail?: string;
  closedAt?: Date;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create audit: database not available");
    throw new Error("Database not available");
  }

  console.log("CREATE AUDIT PAYLOAD:", auditData); // Log payload
  console.log("USER:", auditData.userId); // Log user ID

  const newAudit = {
    ...auditData,
    status: auditData.status || "IN_PROGRESS",
    startDate: auditData.startDate || new Date(),
    endDate: auditData.endDate === undefined ? null : auditData.endDate,
    score: auditData.score === undefined ? 0 : auditData.score,
    conformityRate: auditData.conformityRate === undefined ? 0 : auditData.conformityRate,
    // referentials is already a JSON string from input
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result = await db.insert(audits).values(newAudit);
    console.log("[AUDIT CREATE] Audit created successfully", result);
    // The insert result for MySQL with drizzle-orm typically contains insertId
    // which is the auto-generated ID for the new row.
    // result[0].insertId is common for mysql2 driver
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create audit:", error);
    throw error;
  }
}

export async function updateAudit(auditId: number, auditData: {
  siteId?: number;
  name?: string;
  auditType?: string;
  status?: "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  startDate?: Date;
  endDate?: Date | null;
  score?: number | null;
  conformityRate?: number | null;
  referentials?: string; // JSON string
  siteLocation?: string;
  clientOrganization?: string;
  auditorName?: string;
  auditorEmail?: string;
  closedAt?: Date;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update audit: database not available");
    throw new Error("Database not available");
  }

  const updatedAudit = {
    ...auditData,
    updatedAt: new Date(),
  };

  try {
    await db.update(audits).set(updatedAudit).where(eq(audits.id, auditId));
  } catch (error) {
    console.error("[Database] Failed to update audit:", error);
    throw error;
  }
}

// Audit Responses queries
export async function saveAuditResponse(response: {
  userId: number;
  auditId: number;
  questionKey: string;
  responseValue: "compliant" | "non_compliant" | "partial" | "not_applicable" | "in_progress";
  responseComment?: string;
  evidenceFiles?: any; // JSON
  answeredBy?: number;
  answeredAt?: Date;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save audit response: database not available");
    throw new Error("Database not available");
  }

  const newResponse = {
    ...response,
    answeredAt: response.answeredAt || new Date(),
  };

  try {
    await db.insert(auditResponses).values(newResponse).onDuplicateKeyUpdate({
      set: newResponse,
    });
  } catch (error) {
    console.error("[Database] Failed to save audit response:", error);
    throw error;
  }
}

export async function getAuditResponses(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(auditResponses).where(and(eq(auditResponses.auditId, auditId), eq(auditResponses.userId, userId)));
}

// Evidence Files queries
export async function saveEvidenceFile(fileData: {
  auditResponseId: number;
  fileName: string;
  fileType: string;
  filePath: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save evidence file: database not available");
    throw new Error("Database not available");
  }

  try {
    await db.insert(evidenceFiles).values(fileData);
  } catch (error) {
    console.error("[Database] Failed to save evidence file:", error);
    throw error;
  }
}

export async function getEvidenceFilesByAuditResponseId(auditResponseId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(evidenceFiles).where(eq(evidenceFiles.auditResponseId, auditResponseId));
}

// Badges queries
export async function getBadgesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(badges).where(eq(badges.userId, userId));
}

export async function upsertBadge(badgeData: {
  userId: number;
  badgeType: string;
  earnedAt: Date;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert badge: database not available");
    throw new Error("Database not available");
  }

  try {
    await db.insert(badges).values(badgeData).onDuplicateKeyUpdate({
      set: badgeData,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert badge:", error);
    throw error;
  }
}

// Regulatory Updates queries
export async function getAllRegulatoryUpdates() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(regulatoryUpdates).orderBy(desc(regulatoryUpdates.publishedDate));
}

// Compliance Sprints queries
export async function getComplianceSprintsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(complianceSprints).where(eq(complianceSprints.userId, userId)).orderBy(desc(complianceSprints.createdAt));
}

export async function createComplianceSprint(sprintData: {
  userId: number;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create compliance sprint: database not available");
    throw new Error("Database not available");
  }

  try {
    await db.insert(complianceSprints).values(sprintData);
  } catch (error) {
    console.error("[Database] Failed to create compliance sprint:", error);
    throw error;
  }
}

// Watch Alert Preferences queries
export async function getWatchAlertPreferencesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(watchAlertPreferences).where(eq(watchAlertPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertWatchAlertPreferences(preferencesData: {
  userId: number;
  alertOnNewRegulatoryUpdates?: boolean;
  alertOnNewFindings?: boolean;
  alertOnNewActions?: boolean;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert watch alert preferences: database not available");
    throw new Error("Database not available");
  }

  const existing = await getWatchAlertPreferencesByUserId(preferencesData.userId);

  if (existing) {
    await db.update(watchAlertPreferences)
      .set({ ...preferencesData, updatedAt: new Date() })
      .where(eq(watchAlertPreferences.userId, preferencesData.userId));
  } else {
    await db.insert(watchAlertPreferences).values({
      ...preferencesData,
      userId: preferencesData.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// Sites queries
export async function getSitesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(sites).where(eq(sites.userId, userId)).orderBy(desc(sites.createdAt));
}

export async function createSite(siteData: {
  userId: number;
  name: string;
  location: string;
  description?: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create site: database not available");
    throw new Error("Database not available");
  }

  try {
    await db.insert(sites).values(siteData);
    const [result] = await db.select({ id: sites.id }).from(sites).where(eq(sites.userId, siteData.userId)).orderBy(desc(sites.createdAt)).limit(1);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create site:", error);
    throw error;
  }
}

// Findings queries
export async function getFindingsByAuditId(auditId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(findings).where(eq(findings.auditId, auditId)).orderBy(desc(findings.createdAt));
}

export async function createFinding(findingData: {
  auditId: number;
  questionKey: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  status: "OPEN" | "CLOSED";
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create finding: database not available");
    throw new Error("Database not available");
  }

  try {
    await db.insert(findings).values(findingData);
  } catch (error) {
    console.error("[Database] Failed to create finding:", error);
    throw error;
  }
}

// Actions queries
export async function getActionsByFindingId(findingId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(actions).where(eq(actions.findingId, findingId)).orderBy(desc(actions.createdAt));
}

export async function createAction(actionData: {
  findingId: number;
  description: string;
  assignedTo?: string;
  dueDate?: Date;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create action: database not available");
    throw new Error("Database not available");
  }

  try {
    await db.insert(actions).values(actionData);
  } catch (error) {
    console.error("[Database] Failed to create action:", error);
    throw error;
  }
}
