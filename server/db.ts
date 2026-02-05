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
    if (q.expectedEvidence) {
      try {
        parsedEvidence = JSON.parse(q.expectedEvidence);
      } catch (e) {
        console.warn(`Failed to parse expectedEvidence for question ${q.id}:`, q.expectedEvidence);
        parsedEvidence = [q.expectedEvidence]; // Fallback: wrap in array
      }
    }
    return {
      ...q,
      expectedEvidence: parsedEvidence
    };
  });
}

export async function getQuestionById(questionId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Audit Responses queries
export async function getUserResponse(userId: number, questionId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(auditResponses)
    .where(and(
      eq(auditResponses.userId, userId),
      eq(auditResponses.questionId, questionId)
    ))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function upsertAuditResponse(userId: number, questionId: number, data: {
  response?: string;
  status: "conforme" | "nok" | "na";
  comment?: string;
}) {
  const db = await getDb();
  if (!db) return;

  const existing = await getUserResponse(userId, questionId);
  
  if (existing) {
    await db.update(auditResponses)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(auditResponses.userId, userId),
        eq(auditResponses.questionId, questionId)
      ));
  } else {
    await db.insert(auditResponses).values({
      userId,
      questionId,
      ...data,
    });
  }
}

export async function getUserResponses(userId: number, questionIds?: number[]) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(auditResponses.userId, userId)];
  
  if (questionIds && questionIds.length > 0) {
    conditions.push(inArray(auditResponses.questionId, questionIds));
  }

  return await db.select().from(auditResponses)
    .where(and(...conditions));
}

// Evidence Files queries
export async function getEvidenceFiles(userId: number, questionId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(evidenceFiles)
    .where(and(
      eq(evidenceFiles.userId, userId),
      eq(evidenceFiles.questionId, questionId)
    ))
    .orderBy(desc(evidenceFiles.uploadedAt));
}

export async function addEvidenceFile(data: {
  userId: number;
  questionId: number;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(evidenceFiles).values(data);
}

export async function deleteEvidenceFile(fileId: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(evidenceFiles)
    .where(and(
      eq(evidenceFiles.id, fileId),
      eq(evidenceFiles.userId, userId)
    ));
}

// Badges queries
export async function getUserBadges(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(badges)
    .where(eq(badges.userId, userId))
    .orderBy(desc(badges.earnedAt));
}

export async function awardBadge(userId: number, badgeType: string) {
  const db = await getDb();
  if (!db) return;

  // Check if badge already exists
  const existing = await db.select().from(badges)
    .where(and(
      eq(badges.userId, userId),
      eq(badges.badgeType, badgeType as any)
    ))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(badges).values({
      userId,
      badgeType: badgeType as any,
    });
  }
}

// Regulatory Updates queries
export async function getRegulatoryUpdates(filters?: {
  referentialId?: number;
  processId?: number;
  impactLevel?: 'high' | 'medium' | 'low';
  status?: 'acte' | 'a_venir' | 'en_consultation';
  region?: 'EU' | 'US';
  search?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  
  if (filters?.referentialId) {
    conditions.push(eq(regulatoryUpdates.referentialId, filters.referentialId));
  }
  
  if (filters?.processId) {
    conditions.push(eq(regulatoryUpdates.processId, filters.processId));
  }

  if (filters?.impactLevel) {
    conditions.push(eq(regulatoryUpdates.impactLevel, filters.impactLevel));
  }

  if (filters?.status) {
    conditions.push(eq(regulatoryUpdates.status, filters.status));
  }

  // Filter by region (EU or US) based on referential codes
  if (filters?.region) {
    const { referentials } = await import('../drizzle/schema');
    if (filters.region === 'EU') {
      // EU: MDR, IVDR, ISO
      const euRefs = await db.select().from(referentials)
        .where(or(
          like(referentials.code, 'MDR%'),
          like(referentials.code, 'IVDR%'),
          like(referentials.code, 'ISO%')
        ));
      const euRefIds = euRefs.map(r => r.id);
      if (euRefIds.length > 0) {
        conditions.push(inArray(regulatoryUpdates.referentialId, euRefIds));
      }
    } else if (filters.region === 'US') {
      // US: FDA
      const usRefs = await db.select().from(referentials)
        .where(or(
          like(referentials.code, 'FDA%'),
          like(referentials.code, '21_CFR%'),
          like(referentials.code, '510K%')
        ));
      const usRefIds = usRefs.map(r => r.id);
      if (usRefIds.length > 0) {
        conditions.push(inArray(regulatoryUpdates.referentialId, usRefIds));
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let query = db.select().from(regulatoryUpdates)
    .where(whereClause)
    .orderBy(desc(regulatoryUpdates.publishedAt));

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }

  const results = await query;

  // Apply search filter in memory (since SQL LIKE is not easily supported in Drizzle for text columns)
  if (filters?.search && results.length > 0) {
    const searchLower = filters.search.toLowerCase();
    return results.filter(update => 
      update.title.toLowerCase().includes(searchLower) ||
      update.content.toLowerCase().includes(searchLower)
    );
  }

  return results;
}

// Compliance Sprints queries
export async function getUserSprints(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(complianceSprints)
    .where(eq(complianceSprints.userId, userId))
    .orderBy(desc(complianceSprints.createdAt));
}

export async function createSprint(data: {
  userId: number;
  name: string;
  targetScore: string;
  startDate: Date;
  endDate: Date;
  processId?: number;
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(complianceSprints).values(data);
}

// Mandatory Documents queries
export async function getMandatoryDocuments(filters?: {
  referentialId?: number;
  processId?: number;
  role?: string;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const { mandatoryDocuments } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  const conditions = [];
  if (filters?.referentialId) {
    conditions.push(eq(mandatoryDocuments.referentialId, filters.referentialId));
  }
  if (filters?.processId) {
    conditions.push(eq(mandatoryDocuments.processId, filters.processId));
  }
  if (filters?.role) {
    // Include documents for the specific role AND documents marked as "tous"
    const { or } = await import("drizzle-orm");
    conditions.push(
      or(
        eq(mandatoryDocuments.role, filters.role as any),
        eq(mandatoryDocuments.role, "tous" as any)
      )!
    );
  }
  if (filters?.status) {
    conditions.push(eq(mandatoryDocuments.status, filters.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db.select().from(mandatoryDocuments)
    .where(whereClause)
    .orderBy(mandatoryDocuments.referentialId, mandatoryDocuments.processId);
}

export async function getDocumentById(documentId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const { mandatoryDocuments } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const result = await db.select().from(mandatoryDocuments)
    .where(eq(mandatoryDocuments.id, documentId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserDocumentStatus(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const { userDocumentStatus } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  const result = await db.select().from(userDocumentStatus)
    .where(and(
      eq(userDocumentStatus.userId, userId),
      eq(userDocumentStatus.documentId, documentId)
    ))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateDocumentStatus(data: {
  userId: number;
  documentId: number;
  status: "manquant" | "a_mettre_a_jour" | "conforme";
  notes?: string;
  fileUrl?: string;
}) {
  const db = await getDb();
  if (!db) return;

  const { userDocumentStatus } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  // Check if record exists
  const existing = await getUserDocumentStatus(data.userId, data.documentId);

  if (existing) {
    // Update existing record
    await db.update(userDocumentStatus)
      .set({
        status: data.status,
        notes: data.notes,
        fileUrl: data.fileUrl,
        lastReviewDate: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(userDocumentStatus.userId, data.userId),
        eq(userDocumentStatus.documentId, data.documentId)
      ));
  } else {
    // Insert new record
    await db.insert(userDocumentStatus).values({
      userId: data.userId,
      documentId: data.documentId,
      status: data.status,
      notes: data.notes,
      fileUrl: data.fileUrl,
      lastReviewDate: new Date(),
    });
  }
}

export async function getDocumentStats(userId: number, role?: string) {
  const db = await getDb();
  if (!db) return { total: 0, conforme: 0, a_mettre_a_jour: 0, manquant: 0, percentage: 0 };

  const { mandatoryDocuments, userDocumentStatus } = await import("../drizzle/schema");
  const { eq, and, or, sql } = await import("drizzle-orm");

  // Get all documents for the role
  const allDocs = await getMandatoryDocuments({ role });
  const total = allDocs.length;

  if (total === 0) return { total: 0, conforme: 0, a_mettre_a_jour: 0, manquant: 0, percentage: 0 };

  // Get user statuses
  const { userDocumentStatus: userDocStatus } = await import("../drizzle/schema");
  const statuses = await db.select().from(userDocStatus)
    .where(eq(userDocStatus.userId, userId));

  const conforme = statuses.filter(s => s.status === "conforme").length;
  const a_mettre_a_jour = statuses.filter(s => s.status === "a_mettre_a_jour").length;
  const manquant = total - conforme - a_mettre_a_jour;

  const percentage = Math.round((conforme / total) * 100);

  return { total, conforme, a_mettre_a_jour, manquant, percentage };
}


// FDA Classification functions
export async function saveFdaClassification(data: {
  userId: number;
  deviceName: string;
  deviceDescription: string;
  intendedUse: string;
  deviceClass: string;
  pathway: string;
  predicateDevice: string | null;
  predicate510k: string | null;
  justification: string;
  answers: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { fdaClassifications } = await import("../drizzle/schema");

  // Map pathway values to enum
  const pathwayMap: Record<string, "exempt" | "510k" | "de_novo" | "pma"> = {
    "Exempt": "exempt",
    "510(k)": "510k",
    "De Novo": "de_novo",
    "PMA": "pma",
  };

  await db.insert(fdaClassifications).values({
    userId: data.userId,
    deviceName: data.deviceName,
    deviceDescription: data.deviceDescription,
    intendedUse: data.intendedUse,
    resultingClass: data.deviceClass as "I" | "II" | "III",
    controlLevel: "general" as const,
    pathway: pathwayMap[data.pathway] || "exempt",
    justification: data.justification,
    answers: data.answers,
  });
}

export async function getFdaClassifications(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const { fdaClassifications } = await import("../drizzle/schema");
  const { eq, desc } = await import("drizzle-orm");

  return await db
    .select()
    .from(fdaClassifications)
    .where(eq(fdaClassifications.userId, userId))
    .orderBy(desc(fdaClassifications.createdAt));
}


export async function getFdaRegulatoryUpdates(filters: {
  category?: string;
  impactLevel?: string;
}) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const { fdaRegulatoryUpdates } = await import("../drizzle/schema");
  const { eq, desc, and } = await import("drizzle-orm");

  const conditions = [];
  
  if (filters.category && filters.category !== "all") {
    conditions.push(eq(fdaRegulatoryUpdates.category, filters.category as any));
  }
  
  if (filters.impactLevel && filters.impactLevel !== "all") {
    conditions.push(eq(fdaRegulatoryUpdates.impactLevel, filters.impactLevel as any));
  }

  const query = db
    .select()
    .from(fdaRegulatoryUpdates)
    .orderBy(desc(fdaRegulatoryUpdates.publishedAt));

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }

  return await query;
}


// Contact Messages functions
export async function createContactMessage(data: {
  name: string;
  email: string;
  company?: string;
  subject: "demo" | "support" | "partnership" | "pricing" | "other";
  message: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { contactMessages } = await import("../drizzle/schema");

  const result = await db.insert(contactMessages).values({
    name: data.name,
    email: data.email,
    company: data.company || null,
    subject: data.subject,
    message: data.message,
    userId: data.userId || null,
  });

  return result;
}

export async function getContactMessages(filters?: {
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const { contactMessages } = await import("../drizzle/schema");
  const { eq, desc } = await import("drizzle-orm");

  let query = db.select().from(contactMessages)
    .orderBy(desc(contactMessages.createdAt));

  if (filters?.status) {
    query = query.where(eq(contactMessages.status, filters.status as any)) as any;
  }

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }

  return await query;
}

export async function updateContactMessageStatus(id: number, status: "new" | "read" | "replied" | "archived") {
  const db = await getDb();
  if (!db) return;

  const { contactMessages } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  await db.update(contactMessages)
    .set({ status })
    .where(eq(contactMessages.id, id));
}


// Watch Alert Preferences queries
export async function getWatchAlertPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db.select().from(watchAlertPreferences)
    .where(eq(watchAlertPreferences.userId, userId))
    .limit(1);

  return results[0] || null;
}

export async function upsertWatchAlertPreferences(data: {
  userId: number;
  emailEnabled: boolean;
  minImpactLevel: 'high' | 'medium' | 'low';
  regions: string[]; // Will be JSON stringified
  referentialIds?: number[];
  processIds?: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getWatchAlertPreferences(data.userId);

  const payload = {
    userId: data.userId,
    emailEnabled: data.emailEnabled,
    minImpactLevel: data.minImpactLevel,
    regions: JSON.stringify(data.regions),
    referentialIds: data.referentialIds ? JSON.stringify(data.referentialIds) : null,
    processIds: data.processIds ? JSON.stringify(data.processIds) : null,
  };

  if (existing) {
    await db.update(watchAlertPreferences)
      .set(payload)
      .where(eq(watchAlertPreferences.userId, data.userId));
  } else {
    await db.insert(watchAlertPreferences).values(payload);
  }

  return await getWatchAlertPreferences(data.userId);
}


export async function getRegulatoryStats() {
  const db = await getDb();
  if (!db) return null;

  const updates = await db.select().from(regulatoryUpdates);

  // Count by impact level
  const byImpact = {
    high: updates.filter(u => u.impactLevel === 'high').length,
    medium: updates.filter(u => u.impactLevel === 'medium').length,
    low: updates.filter(u => u.impactLevel === 'low').length,
  };

  // Count by status
  const byStatus = {
    acte: updates.filter(u => u.status === 'acte').length,
    en_consultation: updates.filter(u => u.status === 'en_consultation').length,
    a_venir: updates.filter(u => u.status === 'a_venir').length,
  };

  // Count by month (last 12 months)
  const byMonth: Record<string, number> = {};
  updates.forEach(update => {
    const month = new Date(update.publishedAt).toISOString().slice(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] || 0) + 1;
  });

  // Get referentials to determine region
  const allRefs = await db.select().from(referentials);
  const euRefIds = allRefs.filter(r => 
    r.code.startsWith('MDR') || r.code.startsWith('IVDR') || r.code.startsWith('ISO')
  ).map(r => r.id);
  const usRefIds = allRefs.filter(r => 
    r.code.startsWith('FDA') || r.code.startsWith('21_CFR') || r.code.startsWith('510K')
  ).map(r => r.id);

  const byRegion = {
    EU: updates.filter(u => euRefIds.includes(u.referentialId)).length,
    US: updates.filter(u => usRefIds.includes(u.referentialId)).length,
  };

  return {
    total: updates.length,
    byImpact,
    byStatus,
    byMonth,
    byRegion,
  };
}

// ============================================================================
// AUDIT DETAIL FUNCTIONS
// ============================================================================

/**
 * Get audit by ID with all details
 */
export async function getAuditById(auditId: number, userId: number, userRole?: string) {
  const db = await getDb();
  if (!db) return null;

  // Build where conditions
  const conditions = [eq(audits.id, auditId)];
  
  // Only filter by userId if not admin
  if (userRole !== 'admin') {
    conditions.push(eq(audits.userId, userId));
  }

  const [audit] = await db
    .select({
      id: audits.id,
      name: audits.name,
      auditType: audits.auditType,
      status: audits.status,
      startDate: audits.startDate,
      endDate: audits.endDate,
      auditorName: audits.auditorName,
      auditorEmail: audits.auditorEmail,
      siteId: audits.siteId,
      siteName: sites.name,
      conformityRate: audits.conformityRate,
      score: audits.score,
      notes: audits.notes,
      createdAt: audits.createdAt,
    })
    .from(audits)
    .leftJoin(sites, eq(audits.siteId, sites.id))
    .where(and(...conditions));

  return audit || null;
}

/**
 * Get findings by audit ID
 */
export async function getFindingsByAudit(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  const findingsList = await db
    .select({
      id: findings.id,
      title: findings.title,
      description: findings.description,
      criticality: findings.criticality,
      status: findings.status,
      processId: findings.processId,
      processName: processes.name,
      createdAt: findings.createdAt,
    })
    .from(findings)
    .leftJoin(processes, eq(findings.processId, processes.id))
    .leftJoin(audits, eq(findings.auditId, audits.id))
    .where(and(
      eq(findings.auditId, auditId),
      eq(audits.userId, userId)
    ))
    .orderBy(findings.createdAt);

  return findingsList;
}

/**
 * Get actions by audit ID
 */
export async function getActionsByAudit(auditId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  const actionsList = await db
    .select({
      id: actions.id,
      title: actions.title,
      description: actions.description,
      status: actions.status,
      responsible: actions.responsible,
      dueDate: actions.dueDate,
      completedAt: actions.completedAt,
      createdAt: actions.createdAt,
    })
    .from(actions)
    .leftJoin(findings, eq(actions.findingId, findings.id))
    .leftJoin(audits, eq(findings.auditId, audits.id))
    .where(and(
      eq(findings.auditId, auditId),
      eq(audits.userId, userId)
    ))
    .orderBy(actions.createdAt);

  return actionsList;
}

/**
 * Get recent audits for a user
 */
export async function getRecentAudits(userId: number, limit: number = 5, userRole?: string) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      id: audits.id,
      name: audits.name,
      auditType: audits.auditType,
      status: audits.status,
      startDate: audits.startDate,
      endDate: audits.endDate,
      siteName: sites.name,
      conformityRate: audits.conformityRate,
      createdAt: audits.createdAt,
    })
    .from(audits)
    .leftJoin(sites, eq(audits.siteId, sites.id));
  
  // Only filter by userId if not admin
  if (userRole !== 'admin') {
    query = query.where(eq(audits.userId, userId));
  }
  
  const auditsList = await query
    .orderBy(desc(audits.createdAt))
    .limit(limit);

  return auditsList;
}

/**
 * Get all audits for a user with optional filters
 */
export async function getAuditsList(userId: number, userRole?: string, filters?: {
  status?: string;
  siteId?: number;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  // Build base query
  let query = db
    .select({
      id: audits.id,
      name: audits.name,
      auditType: audits.auditType,
      status: audits.status,
      startDate: audits.startDate,
      endDate: audits.endDate,
      siteName: sites.name,
      conformityRate: audits.conformityRate,
      createdAt: audits.createdAt,
    })
    .from(audits)
    .leftJoin(sites, eq(audits.siteId, sites.id));
  
  // Only filter by userId if not admin
  if (userRole !== 'admin') {
    query = query.where(eq(audits.userId, userId));
  }

  // Apply filters
  if (filters?.status) {
    query = query.where(eq(audits.status, filters.status as any));
  }
  if (filters?.siteId) {
    query = query.where(eq(audits.siteId, filters.siteId));
  }
  if (filters?.startDate) {
    query = query.where(gte(audits.startDate, filters.startDate));
  }
  if (filters?.endDate) {
    query = query.where(lte(audits.endDate, filters.endDate));
  }
  if (filters?.search) {
    query = query.where(like(audits.name, `%${filters.search}%`));
  }

  const auditsList = await query.orderBy(desc(audits.createdAt));

  return auditsList;
}

/**
 * Compare two audits and return delta metrics
 */
export async function compareAudits(audit1Id: number, audit2Id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get both audits
  const audit1 = await getAuditById(audit1Id, userId);
  const audit2 = await getAuditById(audit2Id, userId);

  if (!audit1 || !audit2) {
    return null;
  }

  // Get findings for both audits
  const findings1 = await getFindingsByAudit(audit1Id, userId);
  const findings2 = await getFindingsByAudit(audit2Id, userId);

  // Get actions for both audits
  const actions1 = await getActionsByAudit(audit1Id, userId);
  const actions2 = await getActionsByAudit(audit2Id, userId);

  // Calculate metrics
  const audit1ConformityRate = parseFloat(audit1.conformityRate || "0");
  const audit2ConformityRate = parseFloat(audit2.conformityRate || "0");
  const conformityRateDelta = audit2ConformityRate - audit1ConformityRate;

  const audit1TotalFindings = findings1.length;
  const audit2TotalFindings = findings2.length;
  const totalFindingsDelta = audit2TotalFindings - audit1TotalFindings;

  const audit1CompletedActions = actions1.filter(a => a.status === "completed").length;
  const audit2CompletedActions = actions2.filter(a => a.status === "completed").length;
  const completedActionsDelta = audit2CompletedActions - audit1CompletedActions;

  // Findings by criticality
  const audit1FindingsByCriticality: Record<string, number> = {
    critical: findings1.filter(f => f.criticality === "critical").length,
    high: findings1.filter(f => f.criticality === "high").length,
    medium: findings1.filter(f => f.criticality === "medium").length,
    low: findings1.filter(f => f.criticality === "low").length,
  };

  const audit2FindingsByCriticality: Record<string, number> = {
    critical: findings2.filter(f => f.criticality === "critical").length,
    high: findings2.filter(f => f.criticality === "high").length,
    medium: findings2.filter(f => f.criticality === "medium").length,
    low: findings2.filter(f => f.criticality === "low").length,
  };

  // Identify closed findings (in audit1 but not in audit2 - by title similarity)
  const closedFindings = findings1.filter(f1 => 
    !findings2.some(f2 => f2.title === f1.title)
  );

  // Identify new findings (in audit2 but not in audit1)
  const newFindings = findings2.filter(f2 => 
    !findings1.some(f1 => f1.title === f2.title)
  );

  return {
    audit1: {
      id: audit1.id,
      name: audit1.name,
      startDate: audit1.startDate,
    },
    audit2: {
      id: audit2.id,
      name: audit2.name,
      startDate: audit2.startDate,
    },
    conformityRateDelta,
    audit1ConformityRate,
    audit2ConformityRate,
    totalFindingsDelta,
    audit1TotalFindings,
    audit2TotalFindings,
    completedActionsDelta,
    audit1CompletedActions,
    audit2CompletedActions,
    audit1FindingsByCriticality,
    audit2FindingsByCriticality,
    closedFindings,
    newFindings,
  };
}


// Password management (stored in memory for now, should be in a separate table)
const passwordHashStore = new Map<string, string>();

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function storePasswordHash(openId: string, hash: string): Promise<void> {
  passwordHashStore.set(openId, hash);
}

export async function getPasswordHash(openId: string): Promise<string | undefined> {
  return passwordHashStore.get(openId);
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function listAllUserProfiles() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userProfiles);
}
