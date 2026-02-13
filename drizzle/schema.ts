import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  json,
  uniqueIndex,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * IMPORTANT:
 * - All tables are declared first.
 * - Relations are declared at the end (prevents circular/TDZ issues with bundlers).
 * - Export names must match what your server imports.
 */

/* =========================
   USERS
========================= */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),

    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }),

    firstName: varchar("firstName", { length: 255 }),
    lastName: varchar("lastName", { length: 255 }),

    // ✅ Utilisé dans db.ts (upsertUser) / auth helpers
    name: varchar("name", { length: 255 }),
    openId: varchar("openId", { length: 255 }),
    loginMethod: varchar("loginMethod", { length: 50 }),
    lastSignedIn: timestamp("lastSignedIn"),

    // ✅ Utilisé dans updateUserProfile / UI
    economicRole: varchar("economicRole", { length: 100 }),
    companyName: varchar("companyName", { length: 255 }),

    // ✅ Utilisé dans upsertUserProfile
    subscriptionTier: varchar("subscriptionTier", { length: 50 }),
    subscriptionStatus: varchar("subscriptionStatus", { length: 50 }),

    role: varchar("role", { length: 50 }).default("user").notNull(),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    emailUq: uniqueIndex("users_email_uq").on(t.email),
  })
);

/* =========================
   USER PROFILES
========================= */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  bio: text("bio"),
  avatarUrl: varchar("avatarUrl", { length: 2048 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   ORGANISATIONS
========================= */
export const organisations = mysqlTable("organisations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),

  // Optional legal/address metadata (used by the frontend wizard)
  legalEntityType: varchar("legalEntityType", { length: 100 }),
  siret: varchar("siret", { length: 50 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  postalCode: varchar("postalCode", { length: 30 }),
  country: varchar("country", { length: 120 }),

  userId: int("userId")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   SITES
========================= */
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),

  // Optional site metadata (used by the frontend wizard)
  code: varchar("code", { length: 50 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  postalCode: varchar("postalCode", { length: 30 }),
  country: varchar("country", { length: 120 }),

  // ✅ NEW (Option 2: add columns instead of removing fields)
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),

  isMainSite: boolean("isMainSite").default(false),
  isActive: boolean("isActive").default(true),

  organisationId: int("organisationId").references(() => organisations.id),
  userId: int("userId")
    .notNull()
    .references(() => users.id),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   REFERENTIELS
========================= */
export const referentiels = mysqlTable("referentiels", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   PROCESSUS
========================= */
export const processus = mysqlTable("processus", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   AUDITS
========================= */
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),

  userId: int("userId")
    .notNull()
    .references(() => users.id),
  siteId: int("siteId").references(() => sites.id),

  status: varchar("status", { length: 50 }).default("in_progress").notNull(),
  economicRole: varchar("economicRole", { length: 50 }),

  processIds: json("processIds"),
  referentialIds: json("referentialIds"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   QUESTIONS
========================= */
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  referentialId: int("referentialId"),
  processId: int("processId"),

  questionKey: varchar("questionKey", { length: 255 }),
  article: varchar("article", { length: 255 }),
  annexe: varchar("annexe", { length: 255 }),
  title: varchar("title", { length: 255 }),

  economicRole: json("economicRole"),
  applicableProcesses: json("applicableProcesses"),

  questionType: varchar("questionType", { length: 50 }),
  questionText: text("questionText"),
  expectedEvidence: text("expectedEvidence"),

  criticality: varchar("criticality", { length: 50 }),
  risk: text("risk"),
  interviewFunctions: json("interviewFunctions"),
  actionPlan: text("actionPlan"),
  aiPrompt: text("aiPrompt"),

  displayOrder: int("displayOrder"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/* =========================
   AUDIT RESPONSES
========================= */
export const audit_responses = mysqlTable(
  "audit_responses",
  {
    id: int("id").autoincrement().primaryKey(),

    userId: int("userId")
      .notNull()
      .references(() => users.id),

    auditId: int("auditId")
      .notNull()
      .references(() => audits.id),

    questionId: int("questionId"),
    questionKey: varchar("questionKey", { length: 255 }),

    responseValue: varchar("responseValue", { length: 50 }),
    responseComment: text("responseComment"),
    note: text("note"),

    role: varchar("role", { length: 50 }),
    processId: int("processId"),

    evidenceFiles: json("evidenceFiles"),
    answeredBy: int("answeredBy").references(() => users.id),
    answeredAt: timestamp("answeredAt"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    unq: uniqueIndex("audit_response_unq").on(t.userId, t.auditId, t.questionKey),
  })
);

/* =========================
   FINDINGS
========================= */
export const findings = mysqlTable("findings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  auditId: int("auditId").references(() => audits.id),

  title: varchar("title", { length: 255 }),
  description: text("description"),
  severity: varchar("severity", { length: 50 }),
  status: varchar("status", { length: 50 }).default("open"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   ACTIONS
========================= */
export const actions = mysqlTable("actions", {
  id: int("id").autoincrement().primaryKey(),
  findingId: int("findingId")
    .notNull()
    .references(() => findings.id),
  actionCode: varchar("actionCode", { length: 50 }),
  description: text("description").notNull(),
  responsible: varchar("responsible", { length: 255 }),
  dueDate: timestamp("dueDate"),
  status: mysqlEnum("status", ["open", "in_progress", "closed"])
    .default("open")
    .notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   RESULTATS
========================= */
export const resultats = mysqlTable("resultats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  auditId: int("auditId").references(() => audits.id),
  score: int("score"),
  conformityRate: int("conformityRate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   MDR ROLE QUALIFICATIONS
========================= */
export const mdrRoleQualifications = mysqlTable("mdr_role_qualifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  siteId: int("siteId").references(() => sites.id),
  economicRole: varchar("economicRole", { length: 50 }).notNull(),
  hasAuthorizedRepresentative: boolean("hasAuthorizedRepresentative").default(false),
  targetMarkets: json("targetMarkets"),
  deviceClasses: json("deviceClasses"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   MDR EVIDENCE FILES
========================= */
export const mdrEvidenceFiles = mysqlTable("mdr_evidence_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  auditId: int("auditId")
    .notNull()
    .references(() => audits.id),
  questionKey: varchar("questionKey", { length: 255 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 2048 }).notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 255 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/* =========================
   AUDIT REPORTS (KEEP)
========================= */
export const auditReports = mysqlTable("audit_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  auditId: int("auditId").notNull(),
  reportUrl: varchar("reportUrl", { length: 2048 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/* =========================
   RELATIONS
========================= */
export const usersRelations = relations(users, ({ many }) => ({
  audits: many(audits),
  sites: many(sites),
  organisations: many(organisations),
  mdrRoleQualifications: many(mdrRoleQualifications),
  auditResponses: many(audit_responses),
  mdrEvidenceFiles: many(mdrEvidenceFiles),
}));

export const auditsRelations = relations(audits, ({ one, many }) => ({
  user: one(users, { fields: [audits.userId], references: [users.id] }),
  site: one(sites, { fields: [audits.siteId], references: [sites.id] }),
  responses: many(audit_responses),
}));

export const auditResponsesRelations = relations(audit_responses, ({ one }) => ({
  user: one(users, {
    fields: [audit_responses.userId],
    references: [users.id],
  }),
  audit: one(audits, {
    fields: [audit_responses.auditId],
    references: [audits.id],
  }),
}));

export const organisationsRelations = relations(organisations, ({ one, many }) => ({
  user: one(users, {
    fields: [organisations.userId],
    references: [users.id],
  }),
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  user: one(users, { fields: [sites.userId], references: [users.id] }),
  organisation: one(organisations, {
    fields: [sites.organisationId],
    references: [organisations.id],
  }),
  audits: many(audits),
}));

export const findingsRelations = relations(findings, ({ one, many }) => ({
  user: one(users, { fields: [findings.userId], references: [users.id] }),
  audit: one(audits, { fields: [findings.auditId], references: [audits.id] }),
  actions: many(actions),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  finding: one(findings, {
    fields: [actions.findingId],
    references: [findings.id],
  }),
}));

export const resultatsRelations = relations(resultats, ({ one }) => ({
  user: one(users, { fields: [resultats.userId], references: [users.id] }),
  audit: one(audits, { fields: [resultats.auditId], references: [audits.id] }),
}));

export const mdrRoleQualificationsRelations = relations(mdrRoleQualifications, ({ one }) => ({
  user: one(users, {
    fields: [mdrRoleQualifications.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [mdrRoleQualifications.siteId],
    references: [sites.id],
  }),
}));

export const mdrEvidenceFilesRelations = relations(mdrEvidenceFiles, ({ one }) => ({
  user: one(users, {
    fields: [mdrEvidenceFiles.userId],
    references: [users.id],
  }),
  audit: one(audits, {
    fields: [mdrEvidenceFiles.auditId],
    references: [audits.id],
  }),
}));

/* =========================
   Aliases / Backward compatibility
========================= */
export const referentials = referentiels;
export const auditResponses = audit_responses;
export const evidenceFiles = mdrEvidenceFiles;
export const auditChecklistAnswers = audit_responses;
export const referentielsTable = referentiels;
