CREATE TABLE `actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingId` int NOT NULL,
	`actionCode` varchar(50),
	`description` text NOT NULL,
	`responsible` varchar(255),
	`dueDate` timestamp,
	`status` enum('open','in_progress','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`userId` int NOT NULL,
	`templateVersion` varchar(50),
	`reportData` text NOT NULL,
	`generatedBy` int,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`auditId` int NOT NULL,
	`questionKey` varchar(255) NOT NULL,
	`responseValue` enum('compliant','non_compliant','partial','not_applicable','in_progress') NOT NULL,
	`responseComment` text,
	`note` text,
	`role` varchar(50),
	`processId` varchar(50),
	`evidenceFiles` text,
	`answeredBy` int NOT NULL,
	`answeredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_audit_question_key_idx` UNIQUE(`userId`,`auditId`,`questionKey`)
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int NOT NULL,
	`organizationId` int,
	`name` varchar(255) NOT NULL,
	`auditType` varchar(50) NOT NULL,
	`auditStandard` varchar(255) NOT NULL DEFAULT 'MDR 2017/745',
	`status` enum('draft','in_progress','closed') NOT NULL DEFAULT 'draft',
	`auditProgramRef` varchar(255),
	`auditObjective` text,
	`auditScope` text,
	`auditCriteria` text,
	`auditMethod` enum('on_site','remote','hybrid'),
	`auditLanguage` varchar(10),
	`startDate` timestamp,
	`endDate` timestamp,
	`openingMeetingAt` timestamp,
	`closingMeetingAt` timestamp,
	`auditeeContactName` varchar(255),
	`auditeeContactEmail` varchar(255),
	`auditeeContactPhone` varchar(50),
	`leadAuditorName` varchar(255),
	`leadAuditorEmail` varchar(255),
	`auditors` text,
	`observers` text,
	`economicRole` varchar(50) NOT NULL,
	`processesSelected` text NOT NULL,
	`referentialIds` text NOT NULL,
	`score` decimal(5,2),
	`conformityRate` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `demo_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hasUsedDemo` boolean NOT NULL DEFAULT false,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demo_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `demo_usage_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `device_classifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceName` text NOT NULL,
	`deviceDescription` text,
	`resultingClass` varchar(10) NOT NULL,
	`appliedRules` text NOT NULL,
	`answers` text NOT NULL,
	`justification` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_classifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`processId` int,
	`findingCode` varchar(50),
	`findingType` enum('nc_major','nc_minor','observation','ofi') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`clause` varchar(100),
	`evidence` text,
	`status` enum('open','closed','in_progress') NOT NULL DEFAULT 'open',
	`criticality` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`legalEntityType` varchar(255),
	`siret` varchar(14),
	`addressLine1` varchar(255),
	`addressLine2` varchar(255),
	`city` varchar(100),
	`postalCode` varchar(20),
	`country` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`icon` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referentialId` int NOT NULL,
	`processId` int NOT NULL,
	`article` varchar(100),
	`annexe` varchar(100),
	`title` varchar(500),
	`economicRole` enum('fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer','tous') NOT NULL,
	`applicableProcesses` text,
	`questionType` varchar(255),
	`questionText` text NOT NULL,
	`expectedEvidence` text,
	`criticality` enum('high','medium','low') NOT NULL,
	`risks` text,
	`interviewFunctions` text,
	`actionPlan` text,
	`aiPrompt` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`version` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `referentials_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`addressLine1` varchar(255),
	`addressLine2` varchar(255),
	`city` varchar(100),
	`postalCode` varchar(20),
	`country` varchar(100),
	`isMainSite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_user_site_name` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`economicRole` enum('fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer'),
	`companyName` varchar(255),
	`subscriptionTier` enum('free','pro','expert','entreprise') NOT NULL DEFAULT 'free',
	`subscriptionStatus` enum('active','canceled','past_due','trialing') DEFAULT 'active',
	`subscriptionStartDate` timestamp,
	`subscriptionEndDate` timestamp,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `actions` ADD CONSTRAINT `actions_findingId_findings_id_fk` FOREIGN KEY (`findingId`) REFERENCES `findings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_generatedBy_users_id_fk` FOREIGN KEY (`generatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `demo_usage` ADD CONSTRAINT `demo_usage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sites` ADD CONSTRAINT `sites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `action_finding_idx` ON `actions` (`findingId`);--> statement-breakpoint
CREATE INDEX `action_status_idx` ON `actions` (`status`);--> statement-breakpoint
CREATE INDEX `audit_report_audit_id_idx` ON `audit_reports` (`auditId`);--> statement-breakpoint
CREATE INDEX `audit_report_user_id_idx` ON `audit_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_user_id_idx` ON `audits` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_site_id_idx` ON `audits` (`siteId`);--> statement-breakpoint
CREATE INDEX `audit_status_idx` ON `audits` (`status`);--> statement-breakpoint
CREATE INDEX `demo_user_id_idx` ON `demo_usage` (`userId`);--> statement-breakpoint
CREATE INDEX `finding_audit_idx` ON `findings` (`auditId`);--> statement-breakpoint
CREATE INDEX `finding_process_idx` ON `findings` (`processId`);--> statement-breakpoint
CREATE INDEX `finding_type_idx` ON `findings` (`findingType`);--> statement-breakpoint
CREATE INDEX `finding_status_idx` ON `findings` (`status`);--> statement-breakpoint
CREATE INDEX `org_user_id_idx` ON `organizations` (`userId`);--> statement-breakpoint
CREATE INDEX `referential_idx` ON `questions` (`referentialId`);--> statement-breakpoint
CREATE INDEX `process_idx` ON `questions` (`processId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `questions` (`economicRole`);--> statement-breakpoint
CREATE INDEX `site_user_id_idx` ON `sites` (`userId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `user_profiles` (`userId`);