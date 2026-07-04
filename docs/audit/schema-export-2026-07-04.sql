-- Export brut du schéma (structure seule, aucune donnée) tel qu'obtenu en
-- appliquant l'intégralité des migrations versionnées (drizzle/migrations/,
-- y compris 0007b_baseline_core_tables.sql ajouté en Lot 0) sur une base
-- MySQL vierge, le 04/07/2026. Sert de référence figée pour repérer toute
-- dérive future entre le schéma réel et les migrations versionnées (voir
-- 02-audit-technique.md, C-01). Ne pas exécuter tel quel sur une base
-- existante : c'est un instantané de lecture, pas une migration.

CREATE TABLE `_drizzle_migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `hash` varchar(64) NOT NULL,
  `created_at` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `_drizzle_migrations_hash_uq` (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `actions` (
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
CREATE TABLE `audit_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `auditId` int(11) NOT NULL,
  `reportUrl` varchar(2048) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `audit_responses` (
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
CREATE TABLE `audits` (
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
CREATE TABLE `fda_qualification_answers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sessionId` int(11) NOT NULL,
  `questionKey` varchar(120) NOT NULL,
  `questionLabel` varchar(500) NOT NULL,
  `answerValue` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`answerValue`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fda_qualification_answers_session_idx` (`sessionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `fda_qualification_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `tenantId` int(11) DEFAULT NULL,
  `sessionId` int(11) NOT NULL,
  `rulesetVersion` varchar(50) NOT NULL,
  `resultJson` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`resultJson`)),
  `exportSnapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`exportSnapshot`)),
  `probableDeviceStatus` tinyint(1) DEFAULT 0,
  `probableClass` varchar(20) DEFAULT NULL,
  `probablePathway` varchar(50) DEFAULT NULL,
  `confidenceScore` int(11) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fda_qualification_results_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `fda_qualification_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `tenantId` int(11) DEFAULT NULL,
  `sessionName` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `rulesetVersion` varchar(50) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `findings` (
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
CREATE TABLE `iso_qualifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `targetStandards` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`targetStandards`)),
  `organizationType` varchar(50) DEFAULT NULL,
  `economicRole` varchar(50) DEFAULT NULL,
  `processes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`processes`)),
  `certificationScope` text DEFAULT NULL,
  `excludedClauses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`excludedClauses`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `iso_qualifications_user_uq` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `mdr_evidence_files` (
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
CREATE TABLE `mdr_role_qualifications` (
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
CREATE TABLE `organisations` (
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
CREATE TABLE `processus` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `displayOrder` int(11) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `processus_backup_20260220` (
  `id` int(11) NOT NULL DEFAULT 0,
  `slug` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `displayOrder` int(11) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `questions` (
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
CREATE TABLE `referentiels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `regulatory_update_versions` (
  `id` varchar(36) NOT NULL,
  `updateId` varchar(36) NOT NULL,
  `runId` varchar(36) NOT NULL,
  `snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`snapshot`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `regulatory_updates` (
  `id` varchar(36) NOT NULL,
  `type` enum('REGULATION','GUIDANCE','STANDARD','QUALITY') NOT NULL,
  `title` varchar(1024) NOT NULL,
  `summaryShort` text NOT NULL,
  `summaryLong` text NOT NULL,
  `publishedAt` timestamp NOT NULL,
  `effectiveAt` timestamp NULL DEFAULT NULL,
  `status` enum('NEW','UPDATED','REPEALED','CORRIGENDUM') NOT NULL,
  `sourceName` varchar(255) NOT NULL,
  `sourceUrl` varchar(2048) NOT NULL,
  `sourceId` varchar(255) DEFAULT NULL,
  `jurisdiction` enum('EU','UK','CH','US') NOT NULL DEFAULT 'EU',
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `impactedMdr` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`impactedMdr`)),
  `impactedDomains` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`impactedDomains`)),
  `impactedRoles` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`impactedRoles`)),
  `impactLevel` enum('Low','Medium','High','Critical') NOT NULL,
  `risks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`risks`)),
  `recommendedActions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`recommendedActions`)),
  `expectedEvidence` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`expectedEvidence`)),
  `hash` varchar(64) NOT NULL,
  `retrievedAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `regulatory_updates_hash_uq` (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `resultats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL,
  `auditId` int(11) DEFAULT NULL,
  `score` int(11) DEFAULT NULL,
  `conformityRate` int(11) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `sites` (
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
CREATE TABLE `user_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `bio` text DEFAULT NULL,
  `avatarUrl` varchar(2048) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `users` (
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
CREATE TABLE `watch_company_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `economicRole` enum('fabricant','importateur','distributeur','sous_traitant','ar') NOT NULL,
  `deviceClass` enum('I','IIa','IIb','III') NOT NULL,
  `deviceFamilies` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`deviceFamilies`)),
  `markets` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`markets`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `watch_company_profiles_user_uq` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE `watch_refresh_runs` (
  `id` varchar(36) NOT NULL,
  `startedAt` timestamp NOT NULL,
  `finishedAt` timestamp NULL DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `trigger` enum('page_open','job','manual') NOT NULL,
  `newCount` int(11) NOT NULL DEFAULT 0,
  `updatedCount` int(11) NOT NULL DEFAULT 0,
  `errors` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`errors`)),
  `sourceHealth` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`sourceHealth`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
