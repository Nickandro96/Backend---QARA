import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, tinyint, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Classification tables
export const deviceClassifications = mysqlTable("device_classifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceName: text("deviceName").notNull(),
  deviceDescription: text("deviceDescription"),
  resultingClass: varchar("resultingClass", { length: 10 }).notNull(),
  appliedRules: text("appliedRules").notNull(), // JSON array of rule IDs
  answers: text("answers").notNull(), // JSON object of all answers
  justification: text("justification").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceClassification = typeof deviceClassifications.$inferSelect;
export type InsertDeviceClassification = typeof deviceClassifications.$inferInsert;

/**
 * User profile table for economic role and subscription information
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "manufacturer_us", "specification_developer", "contract_manufacturer", "initial_importer"]),
  companyName: varchar("companyName", { length: 255 }),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "pro", "expert", "entreprise"]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "canceled", "past_due", "trialing"]).default("active"),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Demo usage tracking for FREE users
 * Tracks if a user has used their one-time demo
 */
export const demoUsage = mysqlTable("demo_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  hasUsedDemo: boolean("hasUsedDemo").default(false).notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("demo_user_id_idx").on(table.userId),
}));

export type DemoUsage = typeof demoUsage.$inferSelect;
export type InsertDemoUsage = typeof demoUsage.$inferInsert;

/**
 * Referentials (MDR, ISO 13485, ISO 9001)
 */
export const referentials = mysqlTable("referentials", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // "MDR", "ISO_13485", "ISO_9001"
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  version: varchar("version", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referential = typeof referentials.$inferSelect;
export type InsertReferential = typeof referentials.$inferInsert;

/**
 * Processes (Gouvernance, QMS, RA, PMS, etc.)
 */
export const processes = mysqlTable("processes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: int("displayOrder").notNull().default(0),
  icon: varchar("icon", { length: 100 }), // lucide icon name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Process = typeof processes.$inferSelect;
export type InsertProcess = typeof processes.$inferInsert;

/**
 * Audit questions with full metadata
 */
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  referentialId: int("referentialId").notNull().references(() => referentials.id),
  processId: int("processId").notNull().references(() => processes.id),
  article: varchar("article", { length: 100 }), // "Art. 10", "Clause 7.3.4"
  annexe: varchar("annexe", { length: 100 }), // "Annexe I", "Annexe II"
  title: varchar("title", { length: 500 }), // Title from Excel, e.g., "[Fabricant] Objet et champ d’application"
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "manufacturer_us", "specification_developer", "contract_manufacturer", "initial_importer", "tous"]).notNull(),
  applicableProcesses: text("applicableProcesses"), // JSON array of applicable processes
  questionType: varchar("questionType", { length: 255 }), // Type from Excel, e.g., "Données / IT / cybersécurité"
  questionText: text("questionText").notNull(),
  expectedEvidence: text("expectedEvidence"), // JSON array of expected documents
  criticality: mysqlEnum("criticality", ["high", "medium", "low"]).notNull(),
  risks: text("risks"), // Risks if non-compliant
  interviewFunctions: text("interviewFunctions"), // JSON array of interview functions
  actionPlan: text("actionPlan"), // Guided action plan if NOK
  aiPrompt: text("aiPrompt"), // Contextual AI prompt for this question
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  referentialIdx: index("referential_idx").on(table.referentialId),
  processIdx: index("process_idx").on(table.processId),
  roleIdx: index("role_idx").on(table.economicRole),
}));

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * User responses to audit questions
 * Updated to support questionKey (string) and full MDR audit data
 */
export const auditResponses = mysqlTable("audit_responses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  auditId: int("auditId").notNull(),
  questionKey: varchar("questionKey", { length: 255 }).notNull(),
  responseValue: mysqlEnum("responseValue", ["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]).notNull(),
  responseComment: text("responseComment"),
  note: text("note"), // Added for long responses/notes
  role: varchar("role", { length: 50 }), // Added for MDR role at time of response
  processId: varchar("processId", { length: 50 }), // Added for MDR process at time of response
  evidenceFiles: text("evidenceFiles"), // JSON array of file metadata
  answeredBy: int("answeredBy").notNull().references(() => users.id, { onDelete: "cascade" }),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userAuditQuestionKeyIdx: uniqueIndex("user_audit_question_key_idx").on(table.userId, table.auditId, table.questionKey),
}));

export type AuditResponse = typeof auditResponses.$inferSelect;
export type InsertAuditResponse = typeof auditResponses.$inferInsert;

/**
 * MDR Evidence files uploaded by users
 * Specific table for MDR evidence tracking
 */
export const mdrEvidenceFiles = mysqlTable("mdr_evidence_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  auditId: int("auditId").notNull(),
  questionKey: varchar("questionKey", { length: 255 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(), // S3 key
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(), // S3 URL
  fileSize: int("fileSize"), // in bytes
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, (table) => ({
  userAuditQuestionIdx: index("mdr_evidence_user_audit_question_idx").on(table.userId, table.auditId, table.questionKey),
}));

export type MdrEvidenceFile = typeof mdrEvidenceFiles.$inferSelect;
export type InsertMdrEvidenceFile = typeof mdrEvidenceFiles.$inferInsert;

// Keeping old tables for compatibility if needed, but the main focus is audit_responses
export const mdrAuditResponses = auditResponses;
export const evidenceFiles = mysqlTable("evidence_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => questions.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(), // S3 key
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(), // S3 URL
  fileSize: int("fileSize"), // in bytes
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, (table) => ({
  userQuestionIdx: index("evidence_user_question_idx").on(table.userId, table.questionId),
}));

/**
 * User badges for gamification
 */
export const badges = mysqlTable("badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeType: mysqlEnum("badgeType", [
    "audit_ready",
    "pms_maitrisee",
    "gspr_completes",
    "first_audit",
    "conformity_champion",
    "evidence_master",
    "sprint_achiever"
  ]).notNull(),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
}, (table) => ({
  userBadgeIdx: index("user_badge_idx").on(table.userId, table.badgeType),
}));

/**
 * Regulatory updates and watch
 */
export const regulatoryUpdates = mysqlTable("regulatory_updates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  referentialId: int("referentialId").references(() => referentials.id),
  processId: int("processId").references(() => processes.id),
  impactLevel: mysqlEnum("impactLevel", ["high", "medium", "low"]).notNull(),
  affectedRoles: text("affectedRoles"), // JSON array of economic roles
  status: mysqlEnum("status", ["acte", "a_venir", "en_consultation"]).notNull(),
  publishedAt: timestamp("publishedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  publishedIdx: index("published_idx").on(table.publishedAt),
}));

/**
 * Sprint compliance goals for gamification
 */
export const complianceSprints = mysqlTable("compliance_sprints", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  referentialId: int("referentialId").references(() => referentials.id),
  processId: int("processId").references(() => processes.id),
  targetDate: timestamp("targetDate"),
  status: mysqlEnum("status", ["active", "completed", "abandoned"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Audits tracking table
 */
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  auditType: mysqlEnum("auditType", ["internal", "mock", "supplier"]).default("internal").notNull(),
  status: mysqlEnum("status", ["planned", "in_progress", "completed"]).default("planned").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  referentials: text("referentials"), // JSON array of referential IDs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Role qualifications for MDR
 */
export const mdrRoleQualifications = mysqlTable("mdr_role_qualifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId"), // Optional link to a specific site
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "mandataire"]).notNull(),
  hasAuthorizedRepresentative: boolean("hasAuthorizedRepresentative").default(false),
  targetMarkets: text("targetMarkets"), // JSON array of strings
  deviceClasses: text("deviceClasses"), // JSON array of strings
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
