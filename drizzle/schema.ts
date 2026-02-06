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
 */export const questions = mysqlTable("questions", {
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
  auditId: int("auditId").notNull(), // Ajout du champ auditId
  questionKey: varchar("questionKey", { length: 255 }).notNull(), // Nouvelle colonne
  responseValue: mysqlEnum("responseValue", ["compliant", "non_compliant", "partial", "not_applicable", "in_progress"]).notNull(), // Renommé de 'status' à 'responseValue'
  responseComment: text("responseComment"), // Renommé de 'comment' à 'responseComment'
  evidenceFiles: text("evidenceFiles"), // Ajout du champ evidenceFiles
  note: text("note"), // Added for long responses/notes
  role: varchar("role", { length: 50 }), // Added for MDR role at time of response
  processId: varchar("processId", { length: 50 }), // Added for MDR process at time of response
  answeredBy: int("answeredBy").notNull().references(() => users.id, { onDelete: "cascade" }), // Ajout du champ answeredBy
  answeredAt: timestamp("answeredAt").defaultNow().notNull(), // Renommé de 'respondedAt' à 'answeredAt'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userAuditQuestionKeyIdx: uniqueIndex("user_audit_question_key_idx").on(table.userId, table.auditId, table.questionKey),
}));

/**
 * MDR Evidence files uploaded by users
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

export const mdrAuditResponses = auditResponses;

export type AuditResponse = typeof auditResponses.$inferSelect;
export type InsertAuditResponse = typeof auditResponses.$inferInsert;

/**
 * Evidence files uploaded by users
 */
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

export type EvidenceFile = typeof evidenceFiles.$inferSelect;
export type InsertEvidenceFile = typeof evidenceFiles.$inferInsert;

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

export type Badge = typeof badges.$inferSelect;
export type InsertBadge = typeof badges.$inferInsert;

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

export type RegulatoryUpdate = typeof regulatoryUpdates.$inferSelect;
export type InsertRegulatoryUpdate = typeof regulatoryUpdates.$inferInsert;

/**
 * Sprint compliance goals for gamification
 */
export const complianceSprints = mysqlTable("compliance_sprints", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  targetScore: decimal("targetScore", { precision: 5, scale: 2 }).notNull(), // Target compliance %
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  processId: int("processId").references(() => processes.id), // Optional: focus on specific process
  isCompleted: boolean("isCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userSprintIdx: index("user_sprint_idx").on(table.userId),
}));

export type ComplianceSprint = typeof complianceSprints.$inferSelect;
export type InsertComplianceSprint = typeof complianceSprints.$inferInsert;

/**
 * Mandatory documents table - stores all obligatory documents for ISO 9001, ISO 13485, and MDR
 */
export const mandatoryDocuments = mysqlTable("mandatory_documents", {
  id: int("id").autoincrement().primaryKey(),
  referentialId: int("referentialId").notNull().references(() => referentials.id),
  processId: int("processId").references(() => processes.id),
  role: mysqlEnum("role", ["tous", "fabricant", "importateur", "distributeur", "manufacturer_us", "specification_developer", "contract_manufacturer", "initial_importer"]).notNull(),
  documentName: varchar("documentName", { length: 500 }).notNull(),
  reference: varchar("reference", { length: 100 }).notNull(), // e.g., "4.3", "Art. 10", "Annexe II"
  status: mysqlEnum("status", ["obligatoire", "conditionnel", "attendu"]).notNull(),
  objective: text("objective").notNull(), // Purpose in simple language
  minimumContent: text("minimumContent").notNull(), // Bullet points of expected content
  auditorExpectations: text("auditorExpectations"), // What auditor will look for
  commonErrors: text("commonErrors"), // Frequent mistakes
  linkedDocuments: text("linkedDocuments"), // JSON array of related document IDs
  linkedQuestions: text("linkedQuestions"), // JSON array of related question IDs
  templateUrl: varchar("templateUrl", { length: 500 }), // URL to downloadable template
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  referentialIdx: index("referential_idx").on(table.referentialId),
  processIdx: index("process_idx").on(table.processId),
  roleIdx: index("role_idx").on(table.role),
}));

export type MandatoryDocument = typeof mandatoryDocuments.$inferSelect;
export type InsertMandatoryDocument = typeof mandatoryDocuments.$inferInsert;

/**
 * User document status table - tracks user's progress on mandatory documents
 */
export const userDocumentStatus = mysqlTable("user_document_status", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: int("documentId").notNull().references(() => mandatoryDocuments.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["manquant", "a_mettre_a_jour", "conforme"]).default("manquant").notNull(),
  lastReviewDate: timestamp("lastReviewDate"),
  notes: text("notes"),
  fileUrl: varchar("fileUrl", { length: 500 }), // Link to uploaded document
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userDocIdx: index("user_doc_idx").on(table.userId, table.documentId),
}));

export type UserDocumentStatus = typeof userDocumentStatus.$inferSelect;
export type InsertUserDocumentStatus = typeof userDocumentStatus.$inferInsert;

/**
 * FDA Classifications table - stores US device classifications (Class I/II/III)
 */
export const fdaClassifications = mysqlTable("fda_classifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceName: text("deviceName").notNull(),
  deviceDescription: text("deviceDescription"),
  intendedUse: text("intendedUse").notNull(),
  resultingClass: mysqlEnum("resultingClass", ["I", "II", "III"]).notNull(),
  controlLevel: mysqlEnum("controlLevel", ["general", "special"]).notNull(),
  pathway: mysqlEnum("pathway", ["exempt", "510k", "de_novo", "pma"]).notNull(),
  answers: text("answers").notNull(), // JSON object of all wizard answers
  justification: text("justification").notNull(),
  projectPlan: text("projectPlan"), // JSON object with phases, deliverables, responsibilities
  requiredDocuments: text("requiredDocuments"), // JSON array of required documents
  auditQuestions: text("auditQuestions"), // JSON array of related question IDs
  risks: text("risks"), // Common failure points
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("fda_user_idx").on(table.userId),
}));

export type FdaClassification = typeof fdaClassifications.$inferSelect;
export type InsertFdaClassification = typeof fdaClassifications.$inferInsert;

/**
 * FDA Regulatory Updates - specific to FDA regulations
 */
export const fdaRegulatoryUpdates = mysqlTable("fda_regulatory_updates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  category: mysqlEnum("category", ["qmsr", "part_820", "part_807", "510k", "de_novo", "pma", "postmarket", "labeling_udi", "guidance"]).notNull(),
  cfrPart: varchar("cfrPart", { length: 100 }), // e.g., "21 CFR 820", "21 CFR 807"
  impactLevel: mysqlEnum("impactLevel", ["high", "medium", "low"]).notNull(),
  affectedRoles: text("affectedRoles"), // JSON array of US roles
  affectedProcesses: text("affectedProcesses"), // JSON array of process IDs
  affectedDocuments: text("affectedDocuments"), // JSON array of document IDs
  status: mysqlEnum("status", ["acte", "a_venir", "en_consultation"]).notNull(),
  effectiveDate: timestamp("effectiveDate"), // e.g., QMSR effective date: 2026-02-02
  publishedAt: timestamp("publishedAt").notNull(),
  sourceUrl: varchar("sourceUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  publishedIdx: index("fda_published_idx").on(table.publishedAt),
  categoryIdx: index("fda_category_idx").on(table.category),
}));

export type FdaRegulatoryUpdate = typeof fdaRegulatoryUpdates.$inferSelect;
export type InsertFdaRegulatoryUpdate = typeof fdaRegulatoryUpdates.$inferInsert;

/**
 * FDA Submissions tracking table
 */
export const fdaSubmissions = mysqlTable("fda_submissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceName: text("deviceName").notNull(),
  submissionType: mysqlEnum("submissionType", ["510k", "de_novo", "pma", "pma_supplement", "ide"]).notNull(),
  submissionNumber: varchar("submissionNumber", { length: 100 }),
  fdaClassification: mysqlEnum("fdaClassification", ["class_i", "class_ii", "class_iii"]),
  status: mysqlEnum("status", ["planning", "preparation", "submitted", "under_review", "additional_info_requested", "approved", "denied"]).notNull().default("planning"),
  submissionDate: timestamp("submissionDate"),
  targetSubmissionDate: timestamp("targetSubmissionDate"),
  fdaReviewDeadline: timestamp("fdaReviewDeadline"),
  approvalDate: timestamp("approvalDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export type FdaSubmission = typeof fdaSubmissions.$inferSelect;
export type InsertFdaSubmission = typeof fdaSubmissions.$inferInsert;


/**
 * Contact messages from the contact form
 */
export const contactMessages = mysqlTable("contact_messages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }),
  subject: mysqlEnum("subject", ["demo", "support", "partnership", "pricing", "other"]).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read", "replied", "archived"]).default("new").notNull(),
  userId: int("userId").references(() => users.id), // Optional: if user is logged in
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("contact_status_idx").on(table.status),
  createdIdx: index("contact_created_idx").on(table.createdAt),
}));

export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = typeof contactMessages.$inferInsert;


// ============================================
// DASHBOARD ANALYTICS TABLES (Power BI Like)
// ============================================

/**
 * Sites table for multi-site organizations
 */
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  address: text("address"),
  country: varchar("country", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("site_user_idx").on(table.userId),
}));

export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;

/**
 * Audits table - stores audit sessions
 */
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id),
  name: varchar("name", { length: 255 }).notNull(),
  auditType: mysqlEnum("auditType", ["internal", "external", "supplier", "certification", "surveillance", "blanc"]).notNull().default("internal"),
  status: mysqlEnum("status", ["draft", "in_progress", "completed", "closed"]).notNull().default("draft"),
  referentialIds: text("referentialIds"), // JSON array of referential IDs
  processIds: text("processIds"), // JSON array of process IDs
  siteLocation: varchar("siteLocation", { length: 255 }),
  clientOrganization: varchar("clientOrganization", { length: 255 }),
  auditorName: varchar("auditorName", { length: 255 }),
  auditorEmail: varchar("auditorEmail", { length: 320 }),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  closedAt: timestamp("closedAt"),
  score: decimal("score", { precision: 5, scale: 2 }), // Overall score 0-100
  conformityRate: decimal("conformityRate", { precision: 5, scale: 2 }), // Conformity percentage
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("audit_user_idx").on(table.userId),
  siteIdx: index("audit_site_idx").on(table.siteId),
  statusIdx: index("audit_status_idx").on(table.status),
  startDateIdx: index("audit_start_date_idx").on(table.startDate),
}));

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;

/**
 * Findings table - stores audit findings (constats)
 */
export const findings = mysqlTable("findings", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  questionId: int("questionId").references(() => questions.id),
  referentialId: int("referentialId").references(() => referentials.id),
  processId: int("processId").references(() => processes.id),
  findingCode: varchar("findingCode", { length: 50 }), // e.g., "F-2026-001"
  findingType: mysqlEnum("findingType", ["nc_major", "nc_minor", "observation", "ofi", "positive"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  evidence: text("evidence"), // Evidence of non-conformity
  clause: varchar("clause", { length: 100 }), // e.g., "7.3.4", "Art. 10"
  criticality: mysqlEnum("criticality", ["critical", "high", "medium", "low"]).notNull().default("medium"),
  riskScore: int("riskScore"), // 1-100 risk score
  status: mysqlEnum("status", ["open", "in_progress", "closed", "verified"]).notNull().default("open"),
  rootCause: text("rootCause"),
  closedAt: timestamp("closedAt"),
  verifiedAt: timestamp("verifiedAt"),
  verificationNotes: text("verificationNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditIdx: index("finding_audit_idx").on(table.auditId),
  typeIdx: index("finding_type_idx").on(table.findingType),
  statusIdx: index("finding_status_idx").on(table.status),
  criticalityIdx: index("finding_criticality_idx").on(table.criticality),
}));

export type Finding = typeof findings.$inferSelect;
export type InsertFinding = typeof findings.$inferInsert;

/**
 * Actions table - CAPA (Corrective and Preventive Actions)
 */
export const actions = mysqlTable("actions", {
  id: int("id").autoincrement().primaryKey(),
  findingId: int("findingId").notNull().references(() => findings.id, { onDelete: "cascade" }),
  actionCode: varchar("actionCode", { length: 50 }), // e.g., "CAPA-2026-001"
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
  priorityIdx: index("action_priority_idx").on(table.priority),
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
  score: int("score"), // Score for this answer (e.g., 0-10)
  maxScore: int("maxScore"), // Maximum possible score
  comment: text("comment"),
  evidenceCount: int("evidenceCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditQuestionIdx: index("checklist_audit_question_idx").on(table.auditId, table.questionId),
  answerIdx: index("checklist_answer_idx").on(table.answer),
}));

export type AuditChecklistAnswer = typeof auditChecklistAnswers.$inferSelect;
export type InsertAuditChecklistAnswer = typeof auditChecklistAnswers.$inferInsert;

/**
 * Dashboard aggregates - pre-computed monthly stats by site
 */
export const aggMonthlySite = mysqlTable("agg_monthly_site", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // "2026-01"
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
  siteIdx: index("agg_site_site_idx").on(table.siteId),
}));

export type AggMonthlySite = typeof aggMonthlySite.$inferSelect;
export type InsertAggMonthlySite = typeof aggMonthlySite.$inferInsert;

/**
 * Dashboard aggregates - pre-computed monthly stats by process
 */
export const aggMonthlyProcess = mysqlTable("agg_monthly_process", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  processId: int("processId").references(() => processes.id),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(), // "2026-01"
  auditCount: int("auditCount").default(0),
  avgScore: decimal("avgScore", { precision: 5, scale: 2 }),
  avgConformityRate: decimal("avgConformityRate", { precision: 5, scale: 2 }),
  ncMajorCount: int("ncMajorCount").default(0),
  ncMinorCount: int("ncMinorCount").default(0),
  observationCount: int("observationCount").default(0),
  ofiCount: int("ofiCount").default(0),
  totalFindings: int("totalFindings").default(0),
  riskScore: decimal("riskScore", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userYearMonthIdx: index("agg_process_user_ym_idx").on(table.userId, table.yearMonth),
  processIdx: index("agg_process_process_idx").on(table.processId),
}));

export type AggMonthlyProcess = typeof aggMonthlyProcess.$inferSelect;
export type InsertAggMonthlyProcess = typeof aggMonthlyProcess.$inferInsert;

/**
 * Dashboard aggregates - pre-computed stats by standard/clause
 */
export const aggStandardClause = mysqlTable("agg_standard_clause", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  referentialId: int("referentialId").references(() => referentials.id),
  clause: varchar("clause", { length: 100 }),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
  totalQuestions: int("totalQuestions").default(0),
  conformeCount: int("conformeCount").default(0),
  nokCount: int("nokCount").default(0),
  naCount: int("naCount").default(0),
  conformityRate: decimal("conformityRate", { precision: 5, scale: 2 }),
  ncMajorCount: int("ncMajorCount").default(0),
  ncMinorCount: int("ncMinorCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userYearMonthIdx: index("agg_clause_user_ym_idx").on(table.userId, table.yearMonth),
  referentialIdx: index("agg_clause_ref_idx").on(table.referentialId),
}));

export type AggStandardClause = typeof aggStandardClause.$inferSelect;
export type InsertAggStandardClause = typeof aggStandardClause.$inferInsert;

/**
 * Dashboard aggregates - requirement pareto (top non-conforming requirements)
 */
export const aggRequirementPareto = mysqlTable("agg_requirement_pareto", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: int("questionId").references(() => questions.id),
  referentialId: int("referentialId").references(() => referentials.id),
  processId: int("processId").references(() => processes.id),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
  ncCount: int("ncCount").default(0),
  totalAudits: int("totalAudits").default(0),
  ncRate: decimal("ncRate", { precision: 5, scale: 2 }),
  avgRiskScore: decimal("avgRiskScore", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userYearMonthIdx: index("agg_pareto_user_ym_idx").on(table.userId, table.yearMonth),
  ncCountIdx: index("agg_pareto_nc_idx").on(table.ncCount),
}));

export type AggRequirementPareto = typeof aggRequirementPareto.$inferSelect;
export type InsertAggRequirementPareto = typeof aggRequirementPareto.$inferInsert;

/**
 * Watch alert preferences - user preferences for regulatory update notifications
 */
export const watchAlertPreferences = mysqlTable("watch_alert_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("emailEnabled").default(true).notNull(),
  minImpactLevel: mysqlEnum("minImpactLevel", ["high", "medium", "low"]).default("medium").notNull(),
  regions: text("regions").notNull(), // JSON array: ["EU", "US"]
  referentialIds: text("referentialIds"), // JSON array of referential IDs to watch
  processIds: text("processIds"), // JSON array of process IDs to watch
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("watch_alert_user_idx").on(table.userId),
}));

export type WatchAlertPreference = typeof watchAlertPreferences.$inferSelect;
export type InsertWatchAlertPreference = typeof watchAlertPreferences.$inferInsert;

// ============================================================================
// FDA AUDIT SYSTEM TABLES
// ============================================================================

/**
 * FDA Questions - Stores all audit questions from 8 FDA frameworks
 * Total: 229 questions (820:31, 807:28, 510K:29, DeNovo:27, PMA:28, Postmarket:31, Labeling:26, UDI:29)
 */
export const fdaQuestions = mysqlTable("fda_questions", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(), // HASH for upsert
  frameworkCode: varchar("frameworkCode", { length: 32 }).notNull(), // FDA_820, FDA_807, FDA_510K, etc.
  
  // Excel columns (11 fields)
  process: varchar("process", { length: 255 }),
  subprocess: varchar("subprocess", { length: 255 }),
  referenceStandard: varchar("referenceStandard", { length: 255 }),
  referenceExact: varchar("referenceExact", { length: 255 }),
  questionShort: text("questionShort"),
  questionDetailed: text("questionDetailed"),
  expectedEvidence: text("expectedEvidence"),
  interviews: text("interviews"),
  fieldTest: text("fieldTest"),
  riskIfNc: text("riskIfNc"),
  criticality: varchar("criticality", { length: 32 }),
  
  // Metadata
  applicabilityType: mysqlEnum("applicabilityType", ["ALL", "ROLE_BASED"]).default("ROLE_BASED").notNull(),
  sourceFile: varchar("sourceFile", { length: 255 }),
  sourceRow: int("sourceRow"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  frameworkIdx: index("fda_questions_framework_idx").on(table.frameworkCode),
  externalIdIdx: index("fda_questions_external_id_idx").on(table.externalId),
  applicabilityIdx: index("fda_questions_applicability_idx").on(table.applicabilityType),
}));

export type FdaQuestion = typeof fdaQuestions.$inferSelect;
export type InsertFdaQuestion = typeof fdaQuestions.$inferInsert;

/**
 * FDA Roles - Defines 5 FDA regulatory roles
 */
export const fdaRoles = mysqlTable("fda_roles", {
  id: int("id").autoincrement().primaryKey(),
  roleCode: varchar("roleCode", { length: 32 }).notNull().unique(), // FDA_LM, FDA_CMO, FDA_IMP, FDA_DIST, FDA_CONSULTANT
  roleName: varchar("roleName", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FdaRole = typeof fdaRoles.$inferSelect;
export type InsertFdaRole = typeof fdaRoles.$inferInsert;

/**
 * FDA Role Qualifications - Stores user/site FDA regulatory profile
 * 9 boolean questions determine applicable FDA roles
 */
export const fdaRoleQualifications = mysqlTable("fda_role_qualifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id, { onDelete: "cascade" }),
  
  // 9 qualification boolean questions
  brandOnLabel: boolean("brandOnLabel").default(false).notNull(),
  designsOrSpecifiesDevice: boolean("designsOrSpecifiesDevice").default(false).notNull(),
  manufacturesOrReworks: boolean("manufacturesOrReworks").default(false).notNull(),
  manufacturesForThirdParty: boolean("manufacturesForThirdParty").default(false).notNull(),
  firstImportIntoUS: boolean("firstImportIntoUS").default(false).notNull(),
  distributesWithoutModification: boolean("distributesWithoutModification").default(false).notNull(),
  relabelingOrRepackaging: boolean("relabelingOrRepackaging").default(false).notNull(),
  servicing: boolean("servicing").default(false).notNull(),
  softwareAsMedicalDevice: boolean("softwareAsMedicalDevice").default(false).notNull(),
  
  // Computed roles (calculated automatically from boolean answers)
  computedRoles: text("computedRoles").notNull(), // JSON array: ["FDA_LM", "FDA_CMO"]
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userSiteIdx: uniqueIndex("fda_role_qualifications_user_site_idx").on(table.userId, table.siteId),
}));

export type FdaRoleQualification = typeof fdaRoleQualifications.$inferSelect;
export type InsertFdaRoleQualification = typeof fdaRoleQualifications.$inferInsert;

/**
 * FDA Question Applicability - Maps questions to applicable FDA roles
 * Only for ROLE_BASED questions (ALL questions are visible to everyone)
 */
export const fdaQuestionApplicability = mysqlTable("fda_question_applicability", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull().references(() => fdaQuestions.id, { onDelete: "cascade" }),
  roleCode: varchar("roleCode", { length: 32 }).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  questionRoleIdx: uniqueIndex("fda_question_applicability_question_role_idx").on(table.questionId, table.roleCode),
  roleIdx: index("fda_question_applicability_role_idx").on(table.roleCode),
}));

export type FdaQuestionApplicability = typeof fdaQuestionApplicability.$inferSelect;
export type InsertFdaQuestionApplicability = typeof fdaQuestionApplicability.$inferInsert;

/**
 * FDA Audit Responses - Stores user responses to FDA audit questions
 */
export const fdaAuditResponses = mysqlTable("fda_audit_responses", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => fdaQuestions.id, { onDelete: "cascade" }),
  
  // Response
  responseValue: varchar("responseValue", { length: 32 }), // 'compliant', 'non_compliant', 'not_applicable', 'in_progress'
  responseComment: text("responseComment"),
  evidenceFiles: text("evidenceFiles"), // JSON array of file URLs
  
  // Metadata
  answeredBy: int("answeredBy").references(() => users.id),
  answeredAt: timestamp("answeredAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditQuestionIdx: uniqueIndex("fda_audit_responses_audit_question_idx").on(table.auditId, table.questionId),
  auditIdx: index("fda_audit_responses_audit_idx").on(table.auditId),
  questionIdx: index("fda_audit_responses_question_idx").on(table.questionId),
}));

export type FdaAuditResponse = typeof fdaAuditResponses.$inferSelect;
export type InsertFdaAuditResponse = typeof fdaAuditResponses.$inferInsert;

/**
 * Audit Reports - Stores generated audit reports metadata
 */
export const auditReports = mysqlTable("audit_reports", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Report metadata
  reportType: mysqlEnum("reportType", ["complete", "executive", "comparative", "action_plan", "evidence_index"]).notNull(),
  reportTitle: varchar("reportTitle", { length: 500 }).notNull(),
  reportVersion: varchar("reportVersion", { length: 50 }).default("1.0").notNull(),
  
  // Scope
  referentialIds: text("referentialIds"), // JSON array of referential IDs included
  processIds: text("processIds"), // JSON array of process IDs included
  economicRole: varchar("economicRole", { length: 100 }), // Role audited
  market: varchar("market", { length: 50 }), // "EU", "US", "APAC", etc.
  
  // File storage
  fileKey: varchar("fileKey", { length: 500 }), // S3 key
  fileUrl: varchar("fileUrl", { length: 1000 }), // S3 URL
  fileSize: int("fileSize"), // in bytes
  fileFormat: varchar("fileFormat", { length: 20 }).default("pdf").notNull(), // "pdf", "docx", "xlsx"
  
  // Report content metadata (JSON)
  metadata: text("metadata"), // JSON: { totalQuestions, conformityRate, ncCount, etc. }
  
  // Generation info
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  generatedBy: int("generatedBy").notNull().references(() => users.id),
  
  // Audit comparison (if comparative report)
  comparedAuditIds: text("comparedAuditIds"), // JSON array of audit IDs compared
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditIdx: index("audit_reports_audit_idx").on(table.auditId),
  userIdx: index("audit_reports_user_idx").on(table.userId),
  generatedAtIdx: index("audit_reports_generated_at_idx").on(table.generatedAt),
}));

export type AuditReport = typeof auditReports.$inferSelect;
export type InsertAuditReport = typeof auditReports.$inferInsert;

/**
 * Report Templates - Customizable report templates
 */
export const reportTemplates = mysqlTable("report_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }), // null = system template
  
  // Template info
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  reportType: mysqlEnum("reportType", ["complete", "executive", "comparative", "action_plan", "evidence_index"]).notNull(),
  
  // Template structure (JSON)
  structure: text("structure").notNull(), // JSON: { sections: [...], options: {...} }
  
  // Styling (JSON)
  styling: text("styling"), // JSON: { colors, fonts, logo, header, footer }
  
  // Template metadata
  isDefault: boolean("isDefault").default(false).notNull(),
  isPublic: boolean("isPublic").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("report_templates_user_idx").on(table.userId),
  typeIdx: index("report_templates_type_idx").on(table.reportType),
}));

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = typeof reportTemplates.$inferInsert;

/**
 * ============================================
 * MDR AUDIT SYSTEM
 * ============================================
 * Structured audit system for MDR 2017/745 compliance
 * Similar architecture to FDA system for consistency
 */

/**
 * MDR Questions - Stores all audit questions for MDR 2017/745
 */
export const mdrQuestions = mysqlTable("mdr_questions", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(), // HASH for upsert
  
  // MDR-specific fields
  article: varchar("article", { length: 100 }), // "Art. 10", "Art. 15"
  annexe: varchar("annexe", { length: 100 }), // "Annexe I", "Annexe II", "Annexe III"
  chapter: varchar("chapter", { length: 255 }), // "Chapter II - Registration", etc.
  
  // Economic role applicability
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "mandataire", "tous"]).notNull().default("tous"),
  
  // Question content
  questionText: text("questionText").notNull(),
  questionShort: text("questionShort"), // Short version for lists
  expectedEvidence: text("expectedEvidence"), // JSON array of expected documents
  
  // Risk and criticality
  criticality: mysqlEnum("criticality", ["critical", "high", "medium", "low"]).notNull().default("medium"),
  riskIfNonCompliant: text("riskIfNonCompliant"), // Consequences of non-compliance
  
  // Guidance
  guidanceNotes: text("guidanceNotes"), // Additional guidance for auditor
  actionPlan: text("actionPlan"), // Recommended actions if non-compliant
  
  // Process mapping
  processCategory: varchar("processCategory", { length: 255 }), // "QMS", "Design", "Production", etc.
  
  // Metadata
  displayOrder: int("displayOrder").notNull().default(0),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  externalIdIdx: index("mdr_questions_external_id_idx").on(table.externalId),
  roleIdx: index("mdr_questions_role_idx").on(table.economicRole),
  articleIdx: index("mdr_questions_article_idx").on(table.article),
  criticalityIdx: index("mdr_questions_criticality_idx").on(table.criticality),
}));

export type MdrQuestion = typeof mdrQuestions.$inferSelect;
export type InsertMdrQuestion = typeof mdrQuestions.$inferInsert;

/**
 * MDR Role Qualifications - Stores user/site MDR regulatory profile
 */
export const mdrRoleQualifications = mysqlTable("mdr_role_qualifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id, { onDelete: "cascade" }),
  
  // Economic role (single selection for MDR)
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "mandataire"]).notNull(),
  
  // Additional qualifications
  hasAuthorizedRepresentative: boolean("hasAuthorizedRepresentative").default(false).notNull(),
  targetMarkets: text("targetMarkets"), // JSON array of target EU markets
  deviceClasses: text("deviceClasses"), // JSON array: ["I", "IIa", "IIb", "III"]
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userSiteIdx: uniqueIndex("mdr_role_qualifications_user_site_idx").on(table.userId, table.siteId),
  roleIdx: index("mdr_role_qualifications_role_idx").on(table.economicRole),
}));

export type MdrRoleQualification = typeof mdrRoleQualifications.$inferSelect;
export type InsertMdrRoleQualification = typeof mdrRoleQualifications.$inferInsert;

/**
 * MDR Audit Responses - Stores user responses to MDR audit questions
 */
export const mdrAuditResponses = mysqlTable("mdr_audit_responses", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => mdrQuestions.id, { onDelete: "cascade" }),
  
  // Response
  responseValue: varchar("responseValue", { length: 32 }), // 'compliant', 'non_compliant', 'partial', 'not_applicable', 'in_progress'
  responseComment: text("responseComment"),
  evidenceFiles: text("evidenceFiles"), // JSON array of file URLs
  
  // Metadata
  answeredBy: int("answeredBy").references(() => users.id),
  answeredAt: timestamp("answeredAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditQuestionIdx: uniqueIndex("mdr_audit_responses_audit_question_idx").on(table.auditId, table.questionId),
  auditIdx: index("mdr_audit_responses_audit_idx").on(table.auditId),
  questionIdx: index("mdr_audit_responses_question_idx").on(table.questionId),
}));

export type MdrAuditResponse = typeof mdrAuditResponses.$inferSelect;
export type InsertMdrAuditResponse = typeof mdrAuditResponses.$inferInsert;

/**
 * ============================================
 * ISO AUDIT SYSTEM (ISO 9001 + ISO 13485)
 * ============================================
 * Structured audit system for ISO 9001:2015 and ISO 13485:2016
 * Similar architecture to FDA/MDR systems for consistency
 */

/**
 * ISO Questions - Stores all audit questions for ISO 9001 and ISO 13485
 */
export const isoQuestions = mysqlTable("iso_questions", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(), // HASH for upsert
  
  // ISO standard selection
  standard: mysqlEnum("standard", ["9001", "13485"]).notNull(), // ISO 9001:2015 or ISO 13485:2016
  
  // ISO-specific fields
  clause: varchar("clause", { length: 100 }).notNull(), // "4.1", "7.3.4", "8.2.1"
  clauseTitle: varchar("clauseTitle", { length: 255 }), // "Context of the organization"
  chapter: varchar("chapter", { length: 255 }), // "Quality Management System", "Design and Development"
  
  // Applicability (ISO is generally role-agnostic, but some clauses may be specific)
  applicability: mysqlEnum("applicability", ["all", "manufacturers_only", "service_providers"]).notNull().default("all"),
  
  // Question content
  questionText: text("questionText").notNull(),
  questionShort: text("questionShort"), // Short version for lists
  expectedEvidence: text("expectedEvidence"), // JSON array of expected documents/records
  
  // Risk and criticality
  criticality: mysqlEnum("criticality", ["critical", "high", "medium", "low"]).notNull().default("medium"),
  riskIfNonCompliant: text("riskIfNonCompliant"), // Consequences of non-compliance
  
  // Guidance
  guidanceNotes: text("guidanceNotes"), // Additional guidance for auditor
  actionPlan: text("actionPlan"), // Recommended actions if non-compliant
  
  // Process mapping
  processCategory: varchar("processCategory", { length: 255 }), // "QMS", "Management", "Resource", "Production", "Measurement"
  
  // Metadata
  displayOrder: int("displayOrder").notNull().default(0),
  isActive: boolean("isActive").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  externalIdIdx: index("iso_questions_external_id_idx").on(table.externalId),
  standardIdx: index("iso_questions_standard_idx").on(table.standard),
  clauseIdx: index("iso_questions_clause_idx").on(table.clause),
  criticalityIdx: index("iso_questions_criticality_idx").on(table.criticality),
}));

export type IsoQuestion = typeof isoQuestions.$inferSelect;
export type InsertIsoQuestion = typeof isoQuestions.$inferInsert;

/**
 * ISO Role Qualifications - Stores user/site ISO certification profile
 */
export const isoRoleQualifications = mysqlTable("iso_role_qualifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  siteId: int("siteId").references(() => sites.id, { onDelete: "cascade" }),
  
  // Certification targets
  targetStandards: text("targetStandards").notNull(), // JSON array: ["9001", "13485"]
  
  // Organization type
  organizationType: mysqlEnum("organizationType", ["manufacturer", "service_provider", "both"]).notNull().default("manufacturer"),
  
  // Economic role (MDR-like)
  economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "mandataire"]),
  
  // Processes (JSON array of selected processes)
  processes: text("processes"), // JSON array: ["conception", "fabrication", "distribution", etc.]
  
  // Scope
  certificationScope: text("certificationScope"), // Description of certification scope
  excludedClauses: text("excludedClauses"), // JSON array of excluded clauses (e.g., ["7.3"] for no design)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userSiteIdx: uniqueIndex("iso_role_qualifications_user_site_idx").on(table.userId, table.siteId),
}));

export type IsoRoleQualification = typeof isoRoleQualifications.$inferSelect;
export type InsertIsoRoleQualification = typeof isoRoleQualifications.$inferInsert;

/**
 * ISO Audit Responses - Stores user responses to ISO audit questions
 */
export const isoAuditResponses = mysqlTable("iso_audit_responses", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull().references(() => audits.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => isoQuestions.id, { onDelete: "cascade" }),
  
  // Response
  responseValue: varchar("responseValue", { length: 32 }), // 'compliant', 'non_compliant', 'partial', 'not_applicable', 'in_progress'
  responseComment: text("responseComment"),
  evidenceFiles: text("evidenceFiles"), // JSON array of file URLs
  
  // Metadata
  answeredBy: int("answeredBy").references(() => users.id),
  answeredAt: timestamp("answeredAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  auditQuestionIdx: uniqueIndex("iso_audit_responses_audit_question_idx").on(table.auditId, table.questionId),
  auditIdx: index("iso_audit_responses_audit_idx").on(table.auditId),
  questionIdx: index("iso_audit_responses_question_idx").on(table.questionId),
}));

export type IsoAuditResponse = typeof isoAuditResponses.$inferSelect;
export type InsertIsoAuditResponse = typeof isoAuditResponses.$inferInsert;

