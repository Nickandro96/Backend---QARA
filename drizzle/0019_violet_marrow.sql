CREATE TABLE IF NOT EXISTS `iso_audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int NOT NULL,
	`responseValue` varchar(32),
	`responseComment` text,
	`evidenceFiles` text,
	`answeredBy` int,
	`answeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iso_audit_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `iso_audit_responses_audit_question_idx` UNIQUE(`auditId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `iso_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`standard` enum('9001','13485') NOT NULL,
	`clause` varchar(100) NOT NULL,
	`clauseTitle` varchar(255),
	`chapter` varchar(255),
	`applicability` enum('all','manufacturers_only','service_providers') NOT NULL DEFAULT 'all',
	`questionText` text NOT NULL,
	`questionShort` text,
	`expectedEvidence` text,
	`criticality` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`riskIfNonCompliant` text,
	`guidanceNotes` text,
	`actionPlan` text,
	`processCategory` varchar(255),
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iso_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `iso_questions_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `iso_role_qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`targetStandards` text NOT NULL,
	`organizationType` enum('manufacturer','service_provider','both') NOT NULL DEFAULT 'manufacturer',
	`certificationScope` text,
	`excludedClauses` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iso_role_qualifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `iso_role_qualifications_user_site_idx` UNIQUE(`userId`,`siteId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `mdr_audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int NOT NULL,
	`responseValue` varchar(32),
	`responseComment` text,
	`evidenceFiles` text,
	`answeredBy` int,
	`answeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mdr_audit_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `mdr_audit_responses_audit_question_idx` UNIQUE(`auditId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `mdr_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`article` varchar(100),
	`annexe` varchar(100),
	`chapter` varchar(255),
	`economicRole` enum('fabricant','importateur','distributeur','mandataire','tous') NOT NULL DEFAULT 'tous',
	`questionText` text NOT NULL,
	`questionShort` text,
	`expectedEvidence` text,
	`criticality` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`riskIfNonCompliant` text,
	`guidanceNotes` text,
	`actionPlan` text,
	`processCategory` varchar(255),
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mdr_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `mdr_questions_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `mdr_role_qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`economicRole` enum('fabricant','importateur','distributeur','mandataire') NOT NULL,
	`hasAuthorizedRepresentative` boolean NOT NULL DEFAULT false,
	`targetMarkets` text,
	`deviceClasses` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mdr_role_qualifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `mdr_role_qualifications_user_site_idx` UNIQUE(`userId`,`siteId`)
);
--> statement-breakpoint
ALTER TABLE `iso_audit_responses` ADD CONSTRAINT `iso_audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_audit_responses` ADD CONSTRAINT `iso_audit_responses_questionId_iso_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `iso_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_audit_responses` ADD CONSTRAINT `iso_audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_role_qualifications` ADD CONSTRAINT `iso_role_qualifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_role_qualifications` ADD CONSTRAINT `iso_role_qualifications_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_audit_responses` ADD CONSTRAINT `mdr_audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_audit_responses` ADD CONSTRAINT `mdr_audit_responses_questionId_mdr_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `mdr_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_audit_responses` ADD CONSTRAINT `mdr_audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_role_qualifications` ADD CONSTRAINT `mdr_role_qualifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_role_qualifications` ADD CONSTRAINT `mdr_role_qualifications_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `iso_audit_responses_audit_idx` ON `iso_audit_responses` (`auditId`);--> statement-breakpoint
CREATE INDEX `iso_audit_responses_question_idx` ON `iso_audit_responses` (`questionId`);--> statement-breakpoint
CREATE INDEX `iso_questions_external_id_idx` ON `iso_questions` (`externalId`);--> statement-breakpoint
CREATE INDEX `iso_questions_standard_idx` ON `iso_questions` (`standard`);--> statement-breakpoint
CREATE INDEX `iso_questions_clause_idx` ON `iso_questions` (`clause`);--> statement-breakpoint
CREATE INDEX `iso_questions_criticality_idx` ON `iso_questions` (`criticality`);--> statement-breakpoint
CREATE INDEX `mdr_audit_responses_audit_idx` ON `mdr_audit_responses` (`auditId`);--> statement-breakpoint
CREATE INDEX `mdr_audit_responses_question_idx` ON `mdr_audit_responses` (`questionId`);--> statement-breakpoint
CREATE INDEX `mdr_questions_external_id_idx` ON `mdr_questions` (`externalId`);--> statement-breakpoint
CREATE INDEX `mdr_questions_role_idx` ON `mdr_questions` (`economicRole`);--> statement-breakpoint
CREATE INDEX `mdr_questions_article_idx` ON `mdr_questions` (`article`);--> statement-breakpoint
CREATE INDEX `mdr_questions_criticality_idx` ON `mdr_questions` (`criticality`);--> statement-breakpoint
CREATE INDEX `mdr_role_qualifications_role_idx` ON `mdr_role_qualifications` (`economicRole`);