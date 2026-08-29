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
  date,
  mediumtext,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

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

    name: varchar("name", { length: 255 }),
    openId: varchar("openId", { length: 255 }),
    loginMethod: varchar("loginMethod", { length: 50 }),
    lastSignedIn: timestamp("lastSignedIn"),

    economicRole: varchar("economicRole", { length: 100 }),
    companyName: varchar("companyName", { length: 255 }),

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

export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    tokenHashUq: uniqueIndex("password_reset_tokens_hash_uq").on(t.tokenHash),
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
   ISO QUALIFICATIONS
========================= */
export const isoQualifications = mysqlTable(
  "iso_qualifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),

    // store as JSON arrays (no stringify in routers)
    targetStandards: json("targetStandards"),
    organizationType: varchar("organizationType", { length: 50 }),
    economicRole: varchar("economicRole", { length: 50 }),
    processes: json("processes"),
    certificationScope: text("certificationScope"),
    excludedClauses: json("excludedClauses"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    userUq: uniqueIndex("iso_qualifications_user_uq").on(t.userId),
  }),
);

/* =========================
   ORGANISATIONS
========================= */
export const organisations = mysqlTable("organisations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),

  legalEntityType: varchar("legalEntityType", { length: 100 }),
  siret: varchar("siret", { length: 50 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  postalCode: varchar("postalCode", { length: 30 }),
  country: varchar("country", { length: 120 }),

  // Profil réglementaire (Tâche D.7, migration 0027) — tous facultatifs,
  // "Non renseigné" dans le rapport si absents plutôt qu'une valeur inventée.
  srn: varchar("srn", { length: 50 }),
  logoUrl: varchar("logoUrl", { length: 2048 }),
  prrcName: varchar("prrcName", { length: 255 }),
  prrcQualification: varchar("prrcQualification", { length: 255 }),
  notifiedBodyName: varchar("notifiedBodyName", { length: 255 }),
  notifiedBodyNumber: varchar("notifiedBodyNumber", { length: 50 }),

  userId: int("userId")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   ORGANISATION CERTIFICATES (migration 0027, Tâche D.7)
========================= */
export const organisationCertificates = mysqlTable("organisation_certificates", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId")
    .notNull()
    .references(() => organisations.id),
  referentialCode: varchar("referentialCode", { length: 50 }),
  certificateNumber: varchar("certificateNumber", { length: 100 }),
  issueDate: timestamp("issueDate"),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   SITES
========================= */
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),

  code: varchar("code", { length: 50 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  postalCode: varchar("postalCode", { length: 30 }),
  country: varchar("country", { length: 120 }),

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

  // Migration 0029, additive. Contrôle la visibilité dans l'étape 0 du
  // wizard générique (sélection du référentiel) — un référentiel désactivé
  // reste en base (audits existants intacts), juste masqué du picker.
  // N'affecte aucun autre chemin (referentials.list garde son comportement
  // actuel par défaut — voir server/routers.ts).
  enabled: boolean("enabled").notNull().default(true),
});

/* =========================
   PROCESSUS
========================= */
/**
 * ⚠️ IMPORTANT:
 * La DB actuelle n'a PAS la colonne `updatedAt` sur la table `processus`.
 * Si on la laisse dans le schema Drizzle => "Unknown column 'updatedAt'".
 * On la retire donc ici pour que toutes les requêtes passent.
 *
 * (Option propre plus tard : ajouter la colonne via migration SQL.)
 */
export const processus = mysqlTable("processus", {
  id: int("id").autoincrement().primaryKey(),

  // Functional identifier used by MDR/ISO drilldowns (string slug, e.g. "production_sub")
  slug: varchar("slug", { length: 255 }),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  displayOrder: int("displayOrder"),
  icon: varchar("icon", { length: 255 }),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
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

  status: varchar("status", { length: 50 }).default("draft").notNull(),
  economicRole: varchar("economicRole", { length: 50 }),

  // ✅ JSON columns (store arrays directly in router; no stringify)
  processIds: json("processIds"),
  referentialIds: json("referentialIds"),

  // Onboarding (Lot onboarding) : multi-valeurs, en complément de
  // `economicRole` (singulier, legacy ISO/MDR wizards) — voir
  // docs/audit/12-onboarding.md.
  economicRoles: json("economicRoles"),
  markets: json("markets"),
  situationTags: json("situationTags"),

  clientOrganization: varchar("clientOrganization", { length: 255 }),
  siteLocation: varchar("siteLocation", { length: 255 }),
  auditorName: varchar("auditorName", { length: 255 }),
  auditorEmail: varchar("auditorEmail", { length: 255 }),

  // Champs manquants pour un rapport conforme ISO 19011/17021-1/MDR Annexe IX
  // (Tâche D.7, migration 0027) — facultatifs, section éditable post-création
  // sur AuditDetail. `auditorName`/`auditorEmail` restent le repli mono-
  // auditeur historique ; `auditTeam` porte l'équipe complète si renseignée.
  auditNature: varchar("auditNature", { length: 50 }), // interne / fournisseur / blanc / revue_conformite
  auditTeam: json("auditTeam"), // [{ name, role, email }]
  auditeesRepresentatives: json("auditeesRepresentatives"), // [{ name, function }]
  scopeExclusions: text("scopeExclusions"), // exclusions de périmètre + justification
  plannedAgenda: json("plannedAgenda"), // [{ date, activity }] prévu
  actualAgenda: json("actualAgenda"), // [{ date, activity }] réalisé

  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),

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
  // Intitulé fin du processus du corpus (228 valeurs), distinct de processId
  // qui référence l'une des 15 catégories canoniques — voir migration 0023.
  processDetail: varchar("processDetail", { length: 255 }),

  questionKey: varchar("questionKey", { length: 255 }),
  article: varchar("article", { length: 255 }),
  annexe: varchar("annexe", { length: 255 }),
  title: varchar("title", { length: 1024 }),

  economicRole: varchar("economicRole", { length: 50 }),

  applicableProcesses: json("applicableProcesses"),

  questionType: varchar("questionType", { length: 50 }),
  questionText: text("questionText"),
  // Valeur originale (pré-troncature) de questionText, préservée uniquement
  // pour les questions réécrites par la passe mécanique — voir migration
  // 0030 et VALIDATION-passe-mecanique.md. NULL pour toute question non
  // touchée par cette passe.
  questionTextSource: text("questionTextSource"),
  isActive: boolean("isActive").notNull().default(true),
  expectedEvidence: text("expectedEvidence"),

  criticality: varchar("criticality", { length: 50 }),

  risk: text("risk"),

  interviewFunctions: json("interviewFunctions"),
  actionPlan: text("actionPlan"),
  aiPrompt: text("aiPrompt"),

  displayOrder: int("displayOrder"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),

  // Champs riches du corpus vérifié (voir docs/audit/07-import-corpus.md) : préservent
  // la profondeur d'auditeur et la pédagogie que le mapping vers les colonnes ci-dessus
  // seul ne peut pas porter.
  auditVerifies: text("auditVerifies"),
  relances: json("relances"),
  explanationSimple: text("explanationSimple"),
  concreteExample: text("concreteExample"),
  conformityCriteria: json("conformityCriteria"),
  typicalNc: json("typicalNc"),
  mappings: json("mappings"),
  referenceStatus: varchar("referenceStatus", { length: 255 }),
  officialSource: text("officialSource"),

  // Onboarding (Lot onboarding) : normalisation de `economicRole` (libellés
  // bruts mêlant FR/EN, rôles et non-rôles) vers les 4 opérateurs
  // économiques réglementaires + situations particulières (Art. 16/22) —
  // voir server/onboarding/scopeEngine.ts et docs/audit/12-onboarding.md.
  roleReglementaire: json("roleReglementaire"),
  situationTags: json("situationTags"),

  // Préserve la valeur brute d'economicRole avant normalisation (migration
  // 0028) — audit/rollback ligne par ligne sans restaurer la sauvegarde
  // complète. Voir CORRECTIONS.md (table de correspondance des rôles).
  economicRoleSource: varchar("economicRoleSource", { length: 255 }),
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
    questionKey: varchar("questionKey", { length: 255 }).notNull(),

    responseValue: varchar("responseValue", { length: 50 }),
    responseComment: text("responseComment"),
    note: text("note"),

    role: varchar("role", { length: 50 }),
    processId: int("processId"),

    // ✅ JSON column (store arrays directly in router; no stringify)
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
  status: mysqlEnum("status", ["open", "in_progress", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   CAPA — Plan d'action (Lot 3, voir server/capa/ et docs/audit/09-plan-action-capa.md)
   Distinct de `actions`/`findings` ci-dessus (générique, lié à des `findings`
   FDA) : ici le plan d'action est généré directement depuis les écarts du
   moteur de scoring (server/scoring/), scopé par auditId+questionKey.
========================= */
export const capa_actions = mysqlTable(
  "capa_actions",
  {
    id: int("id").autoincrement().primaryKey(),

    userId: int("userId")
      .notNull()
      .references(() => users.id),
    auditId: int("auditId")
      .notNull()
      .references(() => audits.id),

    questionKey: varchar("questionKey", { length: 255 }).notNull(),
    referentialCode: varchar("referentialCode", { length: 50 }).notNull(),
    processName: varchar("processName", { length: 255 }),

    gravite: mysqlEnum("gravite", ["majeur", "mineur", "observation"]).notNull(),
    criticality: varchar("criticality", { length: 50 }).notNull(),

    ecartIdentifie: text("ecartIdentifie").notNull(),
    analyseCauseRacine: text("analyseCauseRacine"),
    actionRecommandee: text("actionRecommandee").notNull(),
    actionRetenue: text("actionRetenue"),

    responsible: varchar("responsible", { length: 255 }),
    dueDate: timestamp("dueDate"),

    statut: mysqlEnum("statut", [
      "ouverte",
      "en_cours",
      "a_verifier",
      "cloturee_efficace",
      "cloturee_inefficace",
      "cloturee_sans_suite",
    ])
      .default("ouverte")
      .notNull(),

    preuveRealisation: text("preuveRealisation"),
    dateVerificationEfficacite: timestamp("dateVerificationEfficacite"),
    preuveEfficacite: text("preuveEfficacite"),
    resultatEfficacite: mysqlEnum("resultatEfficacite", ["efficace", "inefficace"]),

    // Section 5/6 du rapport (migration 0027, Tâche D.7) — facultatifs.
    // `mdsapGrade`/`mdsapEscalation` uniquement pertinents quand le
    // référentiel de l'audit est MDSAP (matrice AU P0002, grade 1-5).
    rootCauseMethod: varchar("rootCauseMethod", { length: 50 }), // 5_pourquoi / ishikawa / autre
    mdsapGrade: int("mdsapGrade"),
    mdsapEscalation: text("mdsapEscalation"),

    referentielsImpactes: json("referentielsImpactes"),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    unq: uniqueIndex("capa_action_unq").on(t.userId, t.auditId, t.questionKey),
  })
);

/** Historique immuable des modifications d'une action CAPA (traçabilité, §8 SPEC-2). */
export const capa_action_history = mysqlTable("capa_action_history", {
  id: int("id").autoincrement().primaryKey(),
  actionId: int("actionId")
    .notNull()
    .references(() => capa_actions.id),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  changedAt: timestamp("changedAt").notNull().defaultNow(),
  champ: varchar("champ", { length: 100 }).notNull(),
  ancienneValeur: text("ancienneValeur"),
  nouvelleValeur: text("nouvelleValeur"),
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
   FDA QUALIFICATION
========================= */
export const fdaQualificationSessions = mysqlTable("fda_qualification_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  tenantId: int("tenantId"),
  sessionName: varchar("sessionName", { length: 255 }),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  rulesetVersion: varchar("rulesetVersion", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export const fdaQualificationAnswers = mysqlTable("fda_qualification_answers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().references(() => fdaQualificationSessions.id),
  questionKey: varchar("questionKey", { length: 120 }).notNull(),
  questionLabel: varchar("questionLabel", { length: 500 }).notNull(),
  answerValue: json("answerValue"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const fdaQualificationResults = mysqlTable("fda_qualification_results", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  tenantId: int("tenantId"),
  sessionId: int("sessionId").notNull().references(() => fdaQualificationSessions.id),
  rulesetVersion: varchar("rulesetVersion", { length: 50 }).notNull(),
  resultJson: json("resultJson").notNull(),
  exportSnapshot: json("exportSnapshot"),
  probableDeviceStatus: boolean("probableDeviceStatus").default(false),
  probableClass: varchar("probableClass", { length: 20 }),
  probablePathway: varchar("probablePathway", { length: 50 }),
  confidenceScore: int("confidenceScore"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
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
   USER AUDIT SCOPE (Onboarding — source de vérité unique du périmètre,
   remplace isoQualifications + mdrRoleQualifications fragmentés, voir
   docs/audit/12-onboarding.md)
========================= */
export const userAuditScope = mysqlTable("user_audit_scope", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  referentialCodes: json("referentialCodes"),
  economicRoles: json("economicRoles"),
  markets: json("markets"),
  situationTags: json("situationTags"),
  currentStep: varchar("currentStep", { length: 50 }).default("referentiels").notNull(),
  completedAt: timestamp("completedAt"),
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

  // Page de garde / exigences de forme D.2-D.3 (migration 0027, Tâche D.7).
  reference: varchar("reference", { length: 50 }),
  version: int("version").notNull().default(1),
  status: mysqlEnum("status", ["draft", "final"]).notNull().default("draft"),
  distributionList: text("distributionList"),
  language: varchar("language", { length: 5 }).notNull().default("fr"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

/* =========================
   REGULATORY WATCH (VEILLE)
========================= */

export const regulatoryUpdates = mysqlTable(
  "regulatory_updates",
  {
    id: varchar("id", { length: 36 }).primaryKey(), // uuid

    type: mysqlEnum("type", ["REGULATION", "GUIDANCE", "STANDARD", "QUALITY", "NOTICE", "CONSULTATION"]).notNull(),
    title: varchar("title", { length: 1024 }).notNull(),
    summaryShort: text("summaryShort").notNull(),
    summaryLong: text("summaryLong").notNull(),

    publishedAt: timestamp("publishedAt"),
    effectiveAt: timestamp("effectiveAt"),

    status: mysqlEnum("status", ["NEW", "UPDATED", "REPEALED", "CORRIGENDUM"]).notNull(),

    sourceName: varchar("sourceName", { length: 255 }).notNull(),
    sourceUrl: varchar("sourceUrl", { length: 2048 }).notNull(),
    sourceId: varchar("sourceId", { length: 255 }),
    officialId: varchar("official_id", { length: 255 }),
    rawContent: mediumtext("raw_content"),
    contentHash: varchar("content_hash", { length: 64 }),
    dueDate: date("due_date"),
    languageSource: varchar("language_source", { length: 16 }),
    referentialsImpacted: json("referentials_impacted"),
    marketsImpacted: json("markets_impacted"),
    rolesImpacted: json("roles_impacted"),
    aiAnalyzed: boolean("ai_analyzed").notNull().default(false),
    aiAnalysisDate: timestamp("ai_analysis_date"),
    aiModelVersion: varchar("ai_model_version", { length: 100 }),
    licenceVerified: boolean("licence_verified"),
    sourceRegistryId: varchar("source_id", { length: 64 }),

    jurisdiction: mysqlEnum("jurisdiction", ["EU", "UK", "CH", "US"]).notNull().default("EU"),

    tags: json("tags"),
    impactedMdr: json("impactedMdr"),
    impactedDomains: json("impactedDomains"),
    impactedRoles: json("impactedRoles"),
    impactLevel: mysqlEnum("impactLevel", ["Low", "Medium", "High", "Critical"]).notNull(),

    risks: json("risks"),
    recommendedActions: json("recommendedActions"),
    expectedEvidence: json("expectedEvidence"),

    hash: varchar("hash", { length: 64 }).notNull(),
    retrievedAt: timestamp("retrievedAt").notNull(),

    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    hashUq: uniqueIndex("regulatory_updates_hash_uq").on(t.hash),
    sourceOfficialUq: uniqueIndex("regulatory_updates_source_official_uq").on(t.sourceRegistryId, t.officialId),
  })
);

export const regulatorySources = mysqlTable("regulatory_sources", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  urlBase: varchar("url_base", { length: 2048 }).notNull(),
  type: mysqlEnum("type", ["rss", "rest", "odata", "sparql", "html", "pdf"]).notNull(),
  active: boolean("active").notNull().default(true),
  lastCollectedAt: timestamp("last_collected_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  frequency: varchar("frequency", { length: 100 }).notNull(),
  accessType: varchar("access_type", { length: 100 }).notNull(),
  commercialUseAllowed: boolean("commercial_use_allowed"),
  licenceNotes: text("licence_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const regulatoryUpdateVersions = mysqlTable("regulatory_update_versions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  updateId: varchar("updateId", { length: 36 }).notNull(),
  runId: varchar("runId", { length: 36 }).notNull(),
  snapshot: json("snapshot").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const watchRefreshRuns = mysqlTable("watch_refresh_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  startedAt: timestamp("startedAt").notNull(),
  finishedAt: timestamp("finishedAt"),
  success: boolean("success").notNull().default(false),
  trigger: mysqlEnum("trigger", ["page_open", "job", "manual"]).notNull(),
  newCount: int("newCount").notNull().default(0),
  updatedCount: int("updatedCount").notNull().default(0),
  errors: json("errors"),
  sourceHealth: json("sourceHealth"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const watchCompanyProfiles = mysqlTable(
  "watch_company_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    economicRole: mysqlEnum("economicRole", ["fabricant", "importateur", "distributeur", "sous_traitant", "ar"]).notNull(),
    deviceClass: mysqlEnum("deviceClass", ["I", "IIa", "IIb", "III"]).notNull(),
    deviceFamilies: json("deviceFamilies"),
    markets: json("markets"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    userUq: uniqueIndex("watch_company_profiles_user_uq").on(t.userId),
  })
);

/* =========================
   RELATIONS
========================= */

export const fdaQualificationSessionsRelations = relations(fdaQualificationSessions, ({ one, many }) => ({
  user: one(users, { fields: [fdaQualificationSessions.userId], references: [users.id] }),
  answers: many(fdaQualificationAnswers),
  results: many(fdaQualificationResults),
}));

export const fdaQualificationAnswersRelations = relations(fdaQualificationAnswers, ({ one }) => ({
  session: one(fdaQualificationSessions, { fields: [fdaQualificationAnswers.sessionId], references: [fdaQualificationSessions.id] }),
}));

export const fdaQualificationResultsRelations = relations(fdaQualificationResults, ({ one }) => ({
  user: one(users, { fields: [fdaQualificationResults.userId], references: [users.id] }),
  session: one(fdaQualificationSessions, { fields: [fdaQualificationResults.sessionId], references: [fdaQualificationSessions.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  fdaQualificationSessions: many(fdaQualificationSessions),
  fdaQualificationResults: many(fdaQualificationResults),
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
  user: one(users, { fields: [audit_responses.userId], references: [users.id] }),
  audit: one(audits, { fields: [audit_responses.auditId], references: [audits.id] }),
}));

export const organisationsRelations = relations(organisations, ({ one, many }) => ({
  user: one(users, { fields: [organisations.userId], references: [users.id] }),
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  user: one(users, { fields: [sites.userId], references: [users.id] }),
  organisation: one(organisations, { fields: [sites.organisationId], references: [organisations.id] }),
  audits: many(audits),
}));

export const findingsRelations = relations(findings, ({ one, many }) => ({
  user: one(users, { fields: [findings.userId], references: [users.id] }),
  audit: one(audits, { fields: [findings.auditId], references: [audits.id] }),
  actions: many(actions),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  finding: one(findings, { fields: [actions.findingId], references: [findings.id] }),
}));

export const resultatsRelations = relations(resultats, ({ one }) => ({
  user: one(users, { fields: [resultats.userId], references: [users.id] }),
  audit: one(audits, { fields: [resultats.auditId], references: [audits.id] }),
}));

export const mdrRoleQualificationsRelations = relations(mdrRoleQualifications, ({ one }) => ({
  user: one(users, { fields: [mdrRoleQualifications.userId], references: [users.id] }),
  site: one(sites, { fields: [mdrRoleQualifications.siteId], references: [sites.id] }),
}));

export const mdrEvidenceFilesRelations = relations(mdrEvidenceFiles, ({ one }) => ({
  user: one(users, { fields: [mdrEvidenceFiles.userId], references: [users.id] }),
  audit: one(audits, { fields: [mdrEvidenceFiles.auditId], references: [audits.id] }),
}));

/* =========================
   CONTACT MESSAGES
   Frontend expects trpc.contact.submit/list/updateStatus
   (client/src/pages/Contact.tsx, AdminContacts.tsx) — voir
   INVENTAIRE-BUGS.md #6/#8, table absente jusqu'ici (formulaire public,
   pas d'authentification requise pour soumettre).
========================= */
export const contact_messages = mysqlTable("contact_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),

  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  subject: varchar("subject", { length: 100 }).notNull(),
  message: text("message").notNull(),

  status: mysqlEnum("status", ["new", "read", "replied", "archived"]).default("new").notNull(),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

/* =========================
   Documents obligatoires (bibliothèque de conformité documentaire)

   trpc.documents.{getAll,getById,getStats,getUserStatus,updateStatus,
   checkCoherence,explainDocument} (client/src/pages/Documents.tsx) — voir
   INVENTAIRE-BUGS.md #7, namespace absent jusqu'ici. Tables créées vides :
   aucun contenu réglementaire (nom/objectif/contenu minimum attendu des
   documents obligatoires MDR/ISO) n'existe dans ce dépôt ni sur l'ancienne
   branche `main` sous une forme réutilisable (schéma incompatible, mêmes
   champs manquants) — à peupler via un import de contenu réel ultérieur,
   comme le corpus de 473 questions (scripts/import-corpus.mjs), plutôt que
   d'inventer du contenu de conformité.
========================= */
export const mandatoryDocuments = mysqlTable("mandatory_documents", {
  id: int("id").autoincrement().primaryKey(),
  referentialId: int("referentialId").notNull().references(() => referentiels.id),
  processId: int("processId").references(() => processus.id),

  documentName: varchar("documentName", { length: 255 }).notNull(),
  reference: varchar("reference", { length: 100 }),
  role: varchar("role", { length: 50 }),
  status: mysqlEnum("status", ["obligatoire", "conditionnel", "attendu"]).default("obligatoire").notNull(),

  objective: text("objective"),
  minimumContent: text("minimumContent"),
  auditorExpectations: text("auditorExpectations"),
  commonErrors: text("commonErrors"),

  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
});

export const userDocumentStatus = mysqlTable("user_document_status", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: int("documentId").notNull().references(() => mandatoryDocuments.id, { onDelete: "cascade" }),

  status: mysqlEnum("status", ["manquant", "a_mettre_a_jour", "conforme"]).default("manquant").notNull(),
  notes: text("notes"),
  fileUrl: varchar("fileUrl", { length: 1000 }),

  updatedAt: timestamp("updatedAt").notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  userDocIdx: uniqueIndex("user_doc_idx").on(table.userId, table.documentId),
}));

/* =========================
   Aliases / Backward compatibility
========================= */
export const referentials = referentiels;
export const auditResponses = audit_responses;
export const evidenceFiles = mdrEvidenceFiles;
export const auditChecklistAnswers = audit_responses;
export const referentielsTable = referentiels;

