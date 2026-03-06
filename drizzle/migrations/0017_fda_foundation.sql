CREATE TABLE IF NOT EXISTS `fda_qualification_sessions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `tenantId` int NULL,
  `sessionName` varchar(255) NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `rulesetVersion` varchar(50) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fda_qualification_sessions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS `fda_qualification_answers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `sessionId` int NOT NULL,
  `questionKey` varchar(120) NOT NULL,
  `questionLabel` varchar(500) NOT NULL,
  `answerValue` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fda_qualification_answers_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `fda_qualification_sessions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS `fda_qualification_results` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `tenantId` int NULL,
  `sessionId` int NOT NULL,
  `rulesetVersion` varchar(50) NOT NULL,
  `resultJson` json NOT NULL,
  `exportSnapshot` json NULL,
  `probableDeviceStatus` boolean NOT NULL DEFAULT false,
  `probableClass` varchar(20) NULL,
  `probablePathway` varchar(50) NULL,
  `confidenceScore` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fda_qualification_results_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fda_qualification_results_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `fda_qualification_sessions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
);

INSERT INTO `referentiels` (`code`, `name`, `type`, `createdAt`, `updatedAt`)
SELECT 'FDA_QSR_21CFR820', 'FDA QMSR / 21 CFR Part 820', 'FDA', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `referentiels` WHERE `code` = 'FDA_QSR_21CFR820');

INSERT INTO `referentiels` (`code`, `name`, `type`, `createdAt`, `updatedAt`)
SELECT 'FDA_US_MARKET_ACCESS', 'FDA US Market Access', 'FDA', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `referentiels` WHERE `code` = 'FDA_US_MARKET_ACCESS');

CREATE INDEX `fda_qualification_results_user_idx` ON `fda_qualification_results` (`userId`);
CREATE INDEX `fda_qualification_answers_session_idx` ON `fda_qualification_answers` (`sessionId`);
