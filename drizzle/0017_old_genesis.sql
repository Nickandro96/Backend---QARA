CREATE TABLE `fda_audit_responses` (
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
	CONSTRAINT `fda_audit_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_audit_responses_audit_question_idx` UNIQUE(`auditId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `fda_question_applicability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`roleCode` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fda_question_applicability_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_question_applicability_question_role_idx` UNIQUE(`questionId`,`roleCode`)
);
--> statement-breakpoint
CREATE TABLE `fda_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`frameworkCode` varchar(32) NOT NULL,
	`process` varchar(255),
	`subprocess` varchar(255),
	`referenceStandard` varchar(255),
	`referenceExact` varchar(255),
	`questionShort` text,
	`questionDetailed` text,
	`expectedEvidence` text,
	`interviews` text,
	`fieldTest` text,
	`riskIfNc` text,
	`criticality` varchar(32),
	`applicabilityType` enum('ALL','ROLE_BASED') NOT NULL DEFAULT 'ROLE_BASED',
	`sourceFile` varchar(255),
	`sourceRow` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_questions_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `fda_role_qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`brandOnLabel` boolean NOT NULL DEFAULT false,
	`designsOrSpecifiesDevice` boolean NOT NULL DEFAULT false,
	`manufacturesOrReworks` boolean NOT NULL DEFAULT false,
	`manufacturesForThirdParty` boolean NOT NULL DEFAULT false,
	`firstImportIntoUS` boolean NOT NULL DEFAULT false,
	`distributesWithoutModification` boolean NOT NULL DEFAULT false,
	`relabelingOrRepackaging` boolean NOT NULL DEFAULT false,
	`servicing` boolean NOT NULL DEFAULT false,
	`softwareAsMedicalDevice` boolean NOT NULL DEFAULT false,
	`computedRoles` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_role_qualifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_role_qualifications_user_site_idx` UNIQUE(`userId`,`siteId`)
);
--> statement-breakpoint
CREATE TABLE `fda_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleCode` varchar(32) NOT NULL,
	`roleName` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fda_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_roles_roleCode_unique` UNIQUE(`roleCode`)
);
--> statement-breakpoint
ALTER TABLE `fda_audit_responses` ADD CONSTRAINT `fda_audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_audit_responses` ADD CONSTRAINT `fda_audit_responses_questionId_fda_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `fda_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_audit_responses` ADD CONSTRAINT `fda_audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_question_applicability` ADD CONSTRAINT `fda_question_applicability_questionId_fda_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `fda_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_role_qualifications` ADD CONSTRAINT `fda_role_qualifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_role_qualifications` ADD CONSTRAINT `fda_role_qualifications_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fda_audit_responses_audit_idx` ON `fda_audit_responses` (`auditId`);--> statement-breakpoint
CREATE INDEX `fda_audit_responses_question_idx` ON `fda_audit_responses` (`questionId`);--> statement-breakpoint
CREATE INDEX `fda_question_applicability_role_idx` ON `fda_question_applicability` (`roleCode`);--> statement-breakpoint
CREATE INDEX `fda_questions_framework_idx` ON `fda_questions` (`frameworkCode`);--> statement-breakpoint
CREATE INDEX `fda_questions_external_id_idx` ON `fda_questions` (`externalId`);--> statement-breakpoint
CREATE INDEX `fda_questions_applicability_idx` ON `fda_questions` (`applicabilityType`);