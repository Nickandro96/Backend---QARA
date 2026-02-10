import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

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
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  version: varchar("version", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referential = typeof referentials.$inferSelect;
export type InsertReferential = typeof referentials.$inferInsert;

/**
 * Processes
 */
export const processes = mysqlTable("processes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: int("displayOrder").notNull().default(0),
  icon: varchar("icon", { length: 100 }),
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
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),
  notes: text("notes"),
  isMainSite: boolean("isMainSite").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("site_user_id_idx").on(table.userId),
  uniqueUserSiteName: uniqueIndex("unique_user_site_name").on(table.userId, table.name),
}));

export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;

/**
 * Organizations table
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  legalEntityType: varchar("legalEntityType", { length: 255 }),
  siret: varchar("siret", { length: 14 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("org_user_id_idx").on(table.userId),
}));

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Audits table
 */
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").notNull().references(() => sites.id, { onDelete: "cascade" }),
  organizationId: int("organizationId").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  auditType: varchar("auditType", { length: 50 }).notNull(), // "internal", "supplier", "mock"
  auditStandard: varchar("auditStandard", { length: 255 }).notNull().default("MDR 2017/745"),
  standard: varchar("standard", { length: 50 }).notNull().default("MDR"), // "MDR", "ISO13485", etc.
  status: mysqlEnum("status", ["draft", "in_progress", "closed"]).notNull().default("draft"),
  auditProgramRef: varchar("auditProgramRef", { length: 255 }),
  auditObjective: text("auditObjective"),
  auditScope: text("auditScope"),
  auditCriteria: text("auditCriteria"),
  auditMethod: mysqlEnum("auditMethod", ["on_site", "remote", "hybrid"]), // on-site/remote/hybrid
  auditLanguage: varchar("auditLanguage", { length: 10 }),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  openingMeetingAt: timestamp("openingMeetingAt"),
  closingMeetingAt: timestamp("closingMeetingAt"),
  auditeeContactName: varchar("auditeeContactName", { length: 255 }),
  auditeeContactEmail: varchar("auditeeContactEmail", { length: 255 }),
  auditeeContactPhone: varchar("auditeeContactPhone", { length: 50 }),
  leadAuditorName: varchar("leadAuditorName", { length: 255 }),
  leadAuditorEmail: varchar("leadAuditorEmail", { length: 255 }),
  auditors: text("auditors"), // [{name, role, email}]
  observers: text("observers"), // optionnel
  auditedEntityName: varchar("auditedEntityName", { length: 255 }),
  auditedEntityAddress: text("auditedEntityAddress"),
  exclusions: text("exclusions"),
  productFamilies: text("productFamilies"),
  classDevices: text("classDevices"),
  markets: text("markets"),
  plannedStartDate: timestamp("plannedStartDate"),
  plannedEndDate: timestamp("plannedEndDate"),
  actualStartDate: timestamp("actualStartDate"),
  actualEndDate: timestamp("actualEndDate"),
  auditLeader: varchar("auditLeader", { length: 255 }),
  auditTeamMembers: text("auditTeamMembers"),
  auditeeMainContact: text("auditeeMainContact"),
  summary: text("summary"),
  conclusion: text("conclusion"),
  recommendation: text("recommendation"),
  nbNC_major: int("nbNC_major"),
  nbNC_minor: int("nbNC_minor"),
  nbObs: int("nbObs"),
  economicRole: varchar("economicRole", { length: 50 }).notNull(), // fabricant/importateur/distributeur/rep autorisé etc.
  processesSelected: text("processesSelected").notNull(), // [processId,...] ou ["ALL"]
  referentialIds: text("referentialIds").notNull(), // ex: [1] MDR
  score: decimal("score", { precision: 5, scale: 2 }),
  conformityRate: decimal("conformityRate", { precision: 5, scale: 2 }),
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
 * Audit questions
 */
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  referentialId: int("referentialId").notNull().references(() => referentials.id),
  processId: int("processId").notNull().references(() => processes.id),
  article: varchar("article", { length: 100 }),
  annexe: varchar("annexe", { length: 100 }),
  title: varchar("title", { length: 500 }),
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "manufacturer_us", "specification_developer", "contract_manufacturer", "initial_importer", "tous"]).notNull(),
  applicableProcesses: text("applicableProcesses"),
  questionType: varchar("questionType", { length: 255 }),
  questionText: text("questionText").notNull(),
  expectedEvidence: text("expectedEvidence"),
  criticality: mysqlEnum("criticality", ["high", "medium", "low"]).notNull(),
  risks: text("risks"),
  interviewFunctions: text("interviewFunctions"),
  actionPlan: text("actionPlan"),
  aiPrompt: text("aiPrompt"),
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
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  questionKey: varchar("questionKey", { length: 255 }).notNull(),
  responseValue: mysqlEnum("responseValue", ["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]).notNull(),
  responseComment: text("responseComment"),
  note: text("note"),
  role: varchar("role", { length: 50 }),
  processId: varchar("processId", { length: 50 }),
  evidenceFiles: text("evidenceFiles"),
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
 * Findings table
 */
export const findings = mysqlTable("findings", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  processId: int("processId").references(() => processes.id),
  findingCode: varchar("findingCode", { length: 50 }),
  findingType: mysqlEnum("findingType", ["nc_major", "nc_minor", "observation", "ofi"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  clause: varchar("clause", { length: 100 }),
  evidence: text("evidence"),
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
 * Actions table
 */
export const actions = mysqlTable("actions", {
  id: int("id").autoincrement().primaryKey(),
  findingId: int("findingId").notNull().references(() => findings.id, { onDelete: "cascade" }),
  actionCode: varchar("actionCode", { length: 50 }),
  description: text("description").notNull(),
  responsible: varchar("responsible", { length: 255 }),
  dueDate: timestamp("dueDate"),
  status: mysqlEnum("status", ["open", "in_progress", "closed"]).notNull().default("open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  findingIdx: index("action_finding_idx").on(table.findingId),
  statusIdx: index("action_status_idx").on(table.status),
}));

export type Action = typeof actions.$inferSelect;
export type InsertAction = typeof actions.$inferInsert;

/**
 * Audit Reports table
 */
export const auditReports = mysqlTable("audit_reports", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateVersion: varchar("templateVersion", { length: 50 }),
  reportData: text("reportData").notNull(), // JSON snapshot
  generatedBy: int("generatedBy").references(() => users.id),
  generatedAt: timestamp("generatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditIdx: index("audit_report_audit_id_idx").on(table.auditId),
  userIdIdx: index("audit_report_user_id_idx").on(table.userId),
}));

export type AuditReport = typeof auditReports.$inferSelect;
export type InsertAuditReport = typeof auditReports.$inferInsert;
