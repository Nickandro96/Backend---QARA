import { eq, and, inArray, sql, desc, or, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, userProfiles, demoUsage, referentials, processes, questions, auditResponses, evidenceFiles, badges, regulatoryUpdates, complianceSprints, watchAlertPreferences, audits, sites, findings, actions, organizations } from "../drizzle/schema";
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

    const result = await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });

    const userId = result.insertId;
    const existingSite = await getFirstSiteByUserId(userId);
    if (!existingSite) {
      await createSite({
        userId: userId,
        name: "Default Site",
        addressLine1: "N/A",
        city: "N/A",
        postalCode: "N/A",
        country: "N/A",
        isMainSite: true,
      });
    }
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
export async function getAuditById(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(audits).where(and(eq(audits.id, auditId), eq(audits.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAudits(filters: {
  userId: number;
  status?: "draft" | "in_progress" | "closed";
  siteId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(audits.userId, filters.userId)];

  if (filters.status) {
    conditions.push(eq(audits.status, filters.status));
  }
  if (filters.siteId) {
    conditions.push(eq(audits.siteId, filters.siteId));
  }

  return await db.select().from(audits).where(and(...conditions)).orderBy(desc(audits.createdAt));
}

export async function createAudit(auditData: {
  userId: number;
  siteId: number;
  organizationId?: number;
  name: string;
  auditType: string;
  standard: string;
  auditStandard: string;
  status: "draft" | "in_progress" | "closed";
  auditProgramRef?: string;
  auditObjective?: string;
  auditScope?: string;
  auditCriteria?: string;
  auditMethod?: "on_site" | "remote" | "hybrid";
  auditLanguage?: string;
  startDate?: Date;
  endDate?: Date;
  openingMeetingAt?: Date;
  auditeeContactName?: string;
  auditeeContactEmail?: string;
  auditeeContactPhone?: string;
  leadAuditorName?: string;
  leadAuditorEmail?: string;
  auditors?: string; // JSON string
  observers?: string; // JSON string
  economicRole: string;
  processesSelected: string; // JSON string
  referentialIds: string; // JSON string
  score?: number;
  conformityRate?: number;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create audit: database not available");
    throw new Error("Database not available");
  }

  console.log("CREATE AUDIT PAYLOAD:", auditData); // Log payload
  console.log("USER:", auditData.userId); // Log user ID

  try {
    const [result] = await db.insert(audits).values({
      ...auditData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("[AUDIT CREATE] Audit created successfully", result);
    return result.insertId;
  } catch (error) {
    console.error("[Database] Failed to create audit:", error);
    throw error;
  }
}

export async function deleteAudit(auditId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete audit: database not available");
    throw new Error("Database not available");
  }
  await db.delete(audits).where(eq(audits.id, auditId));
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
  questionId: number;
  answer: "conforme" | "nok" | "na" | "partial";
  comment?: string;
}) {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(auditResponses)
    .where(and(
      eq(auditResponses.userId, response.userId),
      eq(auditResponses.auditId, response.auditId),
      eq(auditResponses.questionId, response.questionId)
    )).limit(1);

  if (existing.length > 0) {
    await db.update(auditResponses)
      .set({ answer: response.answer, comment: response.comment, updatedAt: new Date() })
      .where(eq(auditResponses.id, existing[0].id));
  } else {
    await db.insert(auditResponses).values({
      ...response,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function getAuditResponses(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(auditResponses).where(and(eq(auditResponses.auditId, auditId), eq(auditResponses.userId, userId)));
}

// Evidence Files queries
export async function addEvidenceFile(fileData: {
  auditId: number;
  questionId: number;
  fileName: string;
  fileUrl: string;
  userId: number;
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(evidenceFiles).values({
    ...fileData,
    createdAt: new Date(),
  });
}

export async function getEvidenceFiles(auditId: number, questionId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(evidenceFiles)
    .where(and(
      eq(evidenceFiles.auditId, auditId),
      eq(evidenceFiles.questionId, questionId),
      eq(evidenceFiles.userId, userId)
    ));
}

// Badges queries
export async function getBadgesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(badges).where(eq(badges.userId, userId));
}

// Regulatory Updates queries
export async function getRegulatoryUpdates(filters: {
  query?: string;
  startDate?: Date;
  endDate?: Date;
  region?: string;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.query) {
    conditions.push(or(
      like(regulatoryUpdates.title, `%${filters.query}%`),
      like(regulatoryUpdates.summary, `%${filters.query}%`)
    ));
  }
  if (filters.startDate) {
    conditions.push(gte(regulatoryUpdates.publicationDate, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(regulatoryUpdates.publicationDate, filters.endDate));
  }
  if (filters.region) {
    conditions.push(eq(regulatoryUpdates.region, filters.region));
  }
  if (filters.status) {
    conditions.push(eq(regulatoryUpdates.status, filters.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db.select().from(regulatoryUpdates).where(whereClause).orderBy(desc(regulatoryUpdates.publicationDate));
}

// Compliance Sprints queries
export async function getComplianceSprints(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(complianceSprints).where(eq(complianceSprints.userId, userId));
}

// Watch Alert Preferences queries
export async function getWatchAlertPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(watchAlertPreferences).where(eq(watchAlertPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWatchAlertPreferences(userId: number, preferences: {
  emailNotifications?: boolean;
  frequency?: "daily" | "weekly" | "monthly";
  regions?: string; // JSON string
  topics?: string; // JSON string
}) {
  const db = await getDb();
  if (!db) return;

  const existing = await getWatchAlertPreferences(userId);

  if (existing) {
    await db.update(watchAlertPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(watchAlertPreferences.userId, userId));
  } else {
    await db.insert(watchAlertPreferences).values({
      userId,
      ...preferences,
    });
  }
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
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  isMainSite?: boolean;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create site: database not available");
    throw new Error("Database not available");
  }

  try {
    const [result] = await db.insert(sites).values({
      ...siteData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id: result.insertId };
  } catch (error) {
    console.error("[Database] Failed to create site:", error);
    throw error;
  }
}

// Organizations queries
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

export async function createOrganization(organizationData: {
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
  if (!db) {
    console.warn("[Database] Cannot create organization: database not available");
    throw new Error("Database not available");
  }

  try {
    const [result] = await db.insert(organizations).values({
      ...organizationData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return result.insertId;
  } catch (error) {
    console.error("[Database] Failed to create organization:", error);
    throw error;
  }
}
