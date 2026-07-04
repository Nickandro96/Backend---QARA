-- Baseline schema for core tables that were never captured in a versioned
-- migration (they were created directly against the database at some point,
-- outside of drizzle-kit/this migration history — see docs/audit/02-audit-
-- technique.md, C-01). This migration documents the schema as it actually
-- exists so a fresh environment can be reconstructed from the repo alone.
-- Idempotent: safe to run against a database that already has these tables.
--
-- Placed right after 0007 (not at the end) because 0008/0016/0017 add
-- foreign keys to `users`, which must exist by then on a fresh database.

-- `processus` (created by 0006 with only id/code/name) is also missing
-- columns that migrations 0010/0012/0014 assume exist — same underlying
-- cause (schema changes made directly against the database, never
-- captured as a migration). ER_DUP_FIELDNAME is already tolerated by
-- apply-sql-migrations.ts, so this is a no-op when the columns already
-- exist (e.g. on an existing/production database).
ALTER TABLE `processus` ADD COLUMN `description` text DEFAULT NULL;
ALTER TABLE `processus` ADD COLUMN `displayOrder` int(11) DEFAULT NULL;
ALTER TABLE `processus` ADD COLUMN `icon` varchar(255) DEFAULT NULL;

-- ------------------------------------------------------------------
-- Table: users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `passwordHash` varchar(255) DEFAULT NULL,
  `firstName` varchar(255) DEFAULT NULL,
  `lastName` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `openId` varchar(255) DEFAULT NULL,
  `loginMethod` varchar(50) DEFAULT NULL,
  `lastSignedIn` timestamp NULL DEFAULT NULL,
  `economicRole` varchar(100) DEFAULT NULL,
  `companyName` varchar(255) DEFAULT NULL,
  `subscriptionTier` varchar(50) DEFAULT NULL,
  `subscriptionStatus` varchar(50) DEFAULT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_uq` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: user_profiles
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `bio` text DEFAULT NULL,
  `avatarUrl` varchar(2048) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: organisations
CREATE TABLE IF NOT EXISTS `organisations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `legalEntityType` varchar(100) DEFAULT NULL,
  `siret` varchar(50) DEFAULT NULL,
  `addressLine1` varchar(255) DEFAULT NULL,
  `addressLine2` varchar(255) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `postalCode` varchar(30) DEFAULT NULL,
  `country` varchar(120) DEFAULT NULL,
  `userId` int(11) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: sites
CREATE TABLE IF NOT EXISTS `sites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `addressLine1` varchar(255) DEFAULT NULL,
  `addressLine2` varchar(255) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `postalCode` varchar(30) DEFAULT NULL,
  `country` varchar(120) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `isMainSite` tinyint(1) DEFAULT 0,
  `isActive` tinyint(1) DEFAULT 1,
  `organisationId` int(11) DEFAULT NULL,
  `userId` int(11) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: audits
CREATE TABLE IF NOT EXISTS `audits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'mdr',
  `userId` int(11) NOT NULL,
  `siteId` int(11) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `economicRole` varchar(50) DEFAULT NULL,
  `processIds` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`processIds`)),
  `referentialIds` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`referentialIds`)),
  `clientOrganization` varchar(255) DEFAULT NULL,
  `siteLocation` varchar(255) DEFAULT NULL,
  `auditorName` varchar(255) DEFAULT NULL,
  `auditorEmail` varchar(255) DEFAULT NULL,
  `startDate` timestamp NULL DEFAULT NULL,
  `endDate` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `audits_userId_users_id_fk` (`userId`),
  KEY `audits_siteId_sites_id_fk` (`siteId`),
  CONSTRAINT `audits_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `audits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: questions
CREATE TABLE IF NOT EXISTS `questions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `referentialId` int(11) DEFAULT NULL,
  `processId` int(11) DEFAULT NULL,
  `questionKey` varchar(255) DEFAULT NULL,
  `article` varchar(255) DEFAULT NULL,
  `annexe` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `economicRole` varchar(50) DEFAULT NULL,
  `applicableProcesses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`applicableProcesses`)),
  `questionType` varchar(50) DEFAULT NULL,
  `questionText` text DEFAULT NULL,
  `expectedEvidence` text DEFAULT NULL,
  `criticality` varchar(50) DEFAULT NULL,
  `risk` text DEFAULT NULL,
  `interviewFunctions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`interviewFunctions`)),
  `actionPlan` text DEFAULT NULL,
  `aiPrompt` text DEFAULT NULL,
  `displayOrder` int(11) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_questions_questionKey` (`questionKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: audit_responses
CREATE TABLE IF NOT EXISTS `audit_responses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `auditId` int(11) NOT NULL,
  `questionId` int(11) DEFAULT NULL,
  `questionKey` varchar(255) NOT NULL,
  `responseValue` varchar(50) DEFAULT NULL,
  `responseComment` text DEFAULT NULL,
  `note` text DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `processId` int(11) DEFAULT NULL,
  `evidenceFiles` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`evidenceFiles`)),
  `answeredBy` int(11) DEFAULT NULL,
  `answeredAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `audit_response_unq` (`userId`,`auditId`,`questionKey`),
  KEY `audit_responses_auditId_audits_id_fk` (`auditId`),
  KEY `audit_responses_answeredBy_users_id_fk` (`answeredBy`),
  CONSTRAINT `audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `audit_responses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: findings
CREATE TABLE IF NOT EXISTS `findings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL,
  `auditId` int(11) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `severity` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: actions
CREATE TABLE IF NOT EXISTS `actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `findingId` int(11) NOT NULL,
  `actionCode` varchar(50) DEFAULT NULL,
  `description` text NOT NULL,
  `responsible` varchar(255) DEFAULT NULL,
  `dueDate` timestamp NULL DEFAULT NULL,
  `status` enum('open','in_progress','closed') NOT NULL DEFAULT 'open',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `actions_findingId_findings_id_fk` (`findingId`),
  CONSTRAINT `actions_findingId_findings_id_fk` FOREIGN KEY (`findingId`) REFERENCES `findings` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: resultats
CREATE TABLE IF NOT EXISTS `resultats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL,
  `auditId` int(11) DEFAULT NULL,
  `score` int(11) DEFAULT NULL,
  `conformityRate` int(11) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: mdr_evidence_files
CREATE TABLE IF NOT EXISTS `mdr_evidence_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `auditId` int(11) NOT NULL,
  `questionKey` varchar(255) NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `fileKey` varchar(255) NOT NULL,
  `fileUrl` varchar(2048) NOT NULL,
  `fileSize` int(11) DEFAULT NULL,
  `mimeType` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `mdr_evidence_files_userId_users_id_fk` (`userId`),
  KEY `mdr_evidence_files_auditId_audits_id_fk` (`auditId`),
  CONSTRAINT `mdr_evidence_files_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `mdr_evidence_files_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: mdr_role_qualifications
CREATE TABLE IF NOT EXISTS `mdr_role_qualifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `siteId` int(11) DEFAULT NULL,
  `economicRole` varchar(50) NOT NULL,
  `hasAuthorizedRepresentative` tinyint(1) DEFAULT 0,
  `targetMarkets` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`targetMarkets`)),
  `deviceClasses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`deviceClasses`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------
-- Table: audit_reports
CREATE TABLE IF NOT EXISTS `audit_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `auditId` int(11) NOT NULL,
  `reportUrl` varchar(2048) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
