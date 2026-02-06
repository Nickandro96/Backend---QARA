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
 * Sites table
 */
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  isMainSite: boolean("isMainSite").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("site_user_id_idx").on(table.userId),
}));

export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;

/**
 * Audits table
 */
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id),
  name: varchar("name", { length: 255 }).notNull(),
  auditType: mysqlEnum("auditType", ["internal", "supplier", "mock"]).notNull(),
  status: mysqlEnum("status", ["planned", "in_progress", "completed", "cancelled"]).notNull().default("planned"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  score: decimal("score", { precision: 5, scale: 2 }),
  conformityRate: decimal("conformityRate", { precision: 5, scale: 2 }),
  referentials: text("referentials"), // JSON array of referential IDs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("audit_user_id_idx").on(table.userId),
  siteIdx: index("audit_site_id_idx").on(table.siteId),
  statusIdx: index("audit_status_idx").on(table.status),
}));

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;

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
 */
export const auditResponses = mysqlTable("audit_responses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  auditId: int("auditId").notNull(),
  questionKey: varchar("questionKey", { length: 255 }).notNull(),
  responseValue: mysqlEnum("responseValue", ["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]).notNull(),
  responseComment: text("responseComment"),
  note: text("note"),
  role: varchar("role", { length: 50 }),
  processId: varchar("processId", { length: 50 }),
  evidenceFiles: text("evidenceFiles"), // JSON array of file URLs
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
 * Findings table - Audit findings (NC, OBS, OFI)
 */
export const findings = mysqlTable("findings", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  processId: int("processId").references(() => processes.id),
  findingCode: varchar("findingCode", { length: 50 }), // e.g., "NC-2026-001"
  findingType: mysqlEnum("findingType", ["nc_major", "nc_minor", "observation", "ofi"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  clause: varchar("clause", { length: 100 }), // Related standard clause
  evidence: text("evidence"), // Detailed evidence description
  status: mysqlEnum("status", ["open", "closed", "in_progress"]).notNull().default("open"),
  criticality: mysqlEnum("criticality", ["high", "medium", "low"]).notNull().default("medium"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditIdx: index("finding_audit_idx").on(table.auditId),
  processIdx: index("finding_process_idx").on(table.processId),
  typeIdx: index("finding_type_idx").on(table.findingType),
  statusIdx: index("finding_status_idx").on(table.status),
}));

export type Finding = typeof findings.$inferSelect;
export type InsertFinding = typeof findings.$inferInsert;

/**
 * Actions table - CAPA (Corrective and Preventive Actions)
 */
export const actions = mysqlTable("actions", {
  id: int("id").autoincrement().primaryKey(),
  findingId: int("findingId").notNull().references(() => findings.id, { onDelete: "cascade" }),
  actionCode: varchar("actionCode", { length: 50 }),
  actionType: mysqlEnum("actionType", ["corrective", "preventive", "improvement"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  responsibleName: varchar("responsibleName", { length: 255 }),
  responsibleEmail: varchar("responsibleEmail", { length: 320 }),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).notNull().default("medium"),
  status: mysqlEnum("status", ["open", "in_progress", "completed", "verified", "cancelled"]).notNull().default("open"),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  verifiedAt: timestamp("verifiedAt"),
  effectivenessVerified: boolean("effectivenessVerified").default(false),
  effectivenessNotes: text("effectivenessNotes"),
  evidence: text("evidence"), // JSON array of evidence file URLs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  findingIdx: index("action_finding_idx").on(table.findingId),
  statusIdx: index("action_status_idx").on(table.status),
  dueDateIdx: index("action_due_date_idx").on(table.dueDate),
}));

export type Action = typeof actions.$inferSelect;
export type InsertAction = typeof actions.$inferInsert;

/**
 * Audit checklist answers - detailed answers per audit
 */
export const auditChecklistAnswers = mysqlTable("audit_checklist_answers", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => questions.id, { onDelete: "cascade" }),
  answer: mysqlEnum("answer", ["conforme", "nok", "na", "partial"]).notNull(),
  score: int("score"),
  maxScore: int("maxScore"),
  comment: text("comment"),
  evidenceCount: int("evidenceCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditQuestionIdx: index("checklist_audit_question_idx").on(table.auditId, table.questionId),
}));

/**
 * Dashboard aggregates
 */
export const aggMonthlySite = mysqlTable("agg_monthly_site", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
  auditCount: int("auditCount").default(0),
  avgScore: decimal("avgScore", { precision: 5, scale: 2 }),
  avgConformityRate: decimal("avgConformityRate", { precision: 5, scale: 2 }),
  ncMajorCount: int("ncMajorCount").default(0),
  ncMinorCount: int("ncMinorCount").default(0),
  observationCount: int("observationCount").default(0),
  ofiCount: int("ofiCount").default(0),
  totalActions: int("totalActions").default(0),
  closedActions: int("closedActions").default(0),
  overdueActions: int("overdueActions").default(0),
  avgClosureDays: decimal("avgClosureDays", { precision: 7, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userYearMonthIdx: index("agg_site_user_ym_idx").on(table.userId, table.yearMonth),
}));

/**
 * MDR Evidence files
 */
export const mdrEvidenceFiles = mysqlTable("mdr_evidence_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  auditId: int("auditId").notNull(),
  questionKey: varchar("questionKey", { length: 255 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, (table) => ({
  userAuditQuestionIdx: index("mdr_evidence_user_audit_question_idx").on(table.userId, table.auditId, table.questionKey),
}));

// MDR role qualifications
export const mdrRoleQualifications = mysqlTable("mdr_role_qualifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id),
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "mandataire"]).notNull(),
  hasAuthorizedRepresentative: boolean("hasAuthorizedRepresentative").default(false),
  targetMarkets: text("targetMarkets"),
  deviceClasses: text("deviceClasses"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Alias for backwards compatibility if needed
export const mdrAuditResponses = auditResponses;
