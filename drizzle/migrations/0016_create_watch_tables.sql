-- Regulatory Watch / Veille tables

CREATE TABLE IF NOT EXISTS `regulatory_updates` (
  `id` varchar(36) NOT NULL,
  `type` enum('REGULATION','GUIDANCE','STANDARD','QUALITY') NOT NULL,
  `title` varchar(1024) NOT NULL,
  `summaryShort` text NOT NULL,
  `summaryLong` text NOT NULL,
  `publishedAt` timestamp NOT NULL,
  `effectiveAt` timestamp NULL,
  `status` enum('NEW','UPDATED','REPEALED','CORRIGENDUM') NOT NULL,
  `sourceName` varchar(255) NOT NULL,
  `sourceUrl` varchar(2048) NOT NULL,
  `sourceId` varchar(255) NULL,
  `jurisdiction` enum('EU','UK','CH','US') NOT NULL DEFAULT 'EU',
  `tags` json NULL,
  `impactedMdr` json NULL,
  `impactedDomains` json NULL,
  `impactedRoles` json NULL,
  `impactLevel` enum('Low','Medium','High','Critical') NOT NULL,
  `risks` json NULL,
  `recommendedActions` json NULL,
  `expectedEvidence` json NULL,
  `hash` varchar(64) NOT NULL,
  `retrievedAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `regulatory_updates_hash_uq` (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `regulatory_update_versions` (
  `id` varchar(36) NOT NULL,
  `updateId` varchar(36) NOT NULL,
  `runId` varchar(36) NOT NULL,
  `snapshot` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reg_update_versions_updateId_idx` (`updateId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `watch_refresh_runs` (
  `id` varchar(36) NOT NULL,
  `startedAt` timestamp NOT NULL,
  `finishedAt` timestamp NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `trigger` enum('page_open','job','manual') NOT NULL,
  `newCount` int NOT NULL DEFAULT 0,
  `updatedCount` int NOT NULL DEFAULT 0,
  `errors` json NULL,
  `sourceHealth` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `watch_company_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `economicRole` enum('fabricant','importateur','distributeur','sous_traitant','ar') NOT NULL,
  `deviceClass` enum('I','IIa','IIb','III') NOT NULL,
  `deviceFamilies` json NULL,
  `markets` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `watch_company_profiles_user_uq` (`userId`),
  CONSTRAINT `watch_company_profiles_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
