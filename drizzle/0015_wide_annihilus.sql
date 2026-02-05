CREATE TABLE `actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingId` int NOT NULL,
	`actionCode` varchar(50),
	`actionType` enum('corrective','preventive','improvement') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`responsibleName` varchar(255),
	`responsibleEmail` varchar(320),
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','completed','verified','cancelled') NOT NULL DEFAULT 'open',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`verifiedAt` timestamp,
	`effectivenessVerified` boolean DEFAULT false,
	`effectivenessNotes` text,
	`evidence` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_monthly_process` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`processId` int,
	`yearMonth` varchar(7) NOT NULL,
	`auditCount` int DEFAULT 0,
	`avgScore` decimal(5,2),
	`avgConformityRate` decimal(5,2),
	`ncMajorCount` int DEFAULT 0,
	`ncMinorCount` int DEFAULT 0,
	`observationCount` int DEFAULT 0,
	`ofiCount` int DEFAULT 0,
	`totalFindings` int DEFAULT 0,
	`riskScore` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_monthly_process_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_monthly_site` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`yearMonth` varchar(7) NOT NULL,
	`auditCount` int DEFAULT 0,
	`avgScore` decimal(5,2),
	`avgConformityRate` decimal(5,2),
	`ncMajorCount` int DEFAULT 0,
	`ncMinorCount` int DEFAULT 0,
	`observationCount` int DEFAULT 0,
	`ofiCount` int DEFAULT 0,
	`totalActions` int DEFAULT 0,
	`closedActions` int DEFAULT 0,
	`overdueActions` int DEFAULT 0,
	`avgClosureDays` decimal(7,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_monthly_site_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_requirement_pareto` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int,
	`referentialId` int,
	`processId` int,
	`yearMonth` varchar(7) NOT NULL,
	`ncCount` int DEFAULT 0,
	`totalAudits` int DEFAULT 0,
	`ncRate` decimal(5,2),
	`avgRiskScore` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_requirement_pareto_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_standard_clause` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`referentialId` int,
	`clause` varchar(100),
	`yearMonth` varchar(7) NOT NULL,
	`totalQuestions` int DEFAULT 0,
	`conformeCount` int DEFAULT 0,
	`nokCount` int DEFAULT 0,
	`naCount` int DEFAULT 0,
	`conformityRate` decimal(5,2),
	`ncMajorCount` int DEFAULT 0,
	`ncMinorCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_standard_clause_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_checklist_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int NOT NULL,
	`answer` enum('conforme','nok','na','partial') NOT NULL,
	`score` int,
	`maxScore` int,
	`comment` text,
	`evidenceCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_checklist_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`name` varchar(255) NOT NULL,
	`auditType` enum('internal','external','supplier','certification','surveillance','blanc') NOT NULL DEFAULT 'internal',
	`status` enum('draft','in_progress','completed','closed') NOT NULL DEFAULT 'draft',
	`referentialIds` text,
	`processIds` text,
	`auditorName` varchar(255),
	`auditorEmail` varchar(320),
	`startDate` timestamp,
	`endDate` timestamp,
	`closedAt` timestamp,
	`score` decimal(5,2),
	`conformityRate` decimal(5,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int,
	`referentialId` int,
	`processId` int,
	`findingCode` varchar(50),
	`findingType` enum('nc_major','nc_minor','observation','ofi','positive') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`evidence` text,
	`clause` varchar(100),
	`criticality` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`riskScore` int,
	`status` enum('open','in_progress','closed','verified') NOT NULL DEFAULT 'open',
	`rootCause` text,
	`closedAt` timestamp,
	`verifiedAt` timestamp,
	`verificationNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50),
	`address` text,
	`country` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `actions` ADD CONSTRAINT `actions_findingId_findings_id_fk` FOREIGN KEY (`findingId`) REFERENCES `findings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_process` ADD CONSTRAINT `agg_monthly_process_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_process` ADD CONSTRAINT `agg_monthly_process_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_site` ADD CONSTRAINT `agg_monthly_site_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_site` ADD CONSTRAINT `agg_monthly_site_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_standard_clause` ADD CONSTRAINT `agg_standard_clause_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_standard_clause` ADD CONSTRAINT `agg_standard_clause_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_checklist_answers` ADD CONSTRAINT `audit_checklist_answers_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_checklist_answers` ADD CONSTRAINT `audit_checklist_answers_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sites` ADD CONSTRAINT `sites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `action_finding_idx` ON `actions` (`findingId`);--> statement-breakpoint
CREATE INDEX `action_status_idx` ON `actions` (`status`);--> statement-breakpoint
CREATE INDEX `action_due_date_idx` ON `actions` (`dueDate`);--> statement-breakpoint
CREATE INDEX `action_priority_idx` ON `actions` (`priority`);--> statement-breakpoint
CREATE INDEX `agg_process_user_ym_idx` ON `agg_monthly_process` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_process_process_idx` ON `agg_monthly_process` (`processId`);--> statement-breakpoint
CREATE INDEX `agg_site_user_ym_idx` ON `agg_monthly_site` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_site_site_idx` ON `agg_monthly_site` (`siteId`);--> statement-breakpoint
CREATE INDEX `agg_pareto_user_ym_idx` ON `agg_requirement_pareto` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_pareto_nc_idx` ON `agg_requirement_pareto` (`ncCount`);--> statement-breakpoint
CREATE INDEX `agg_clause_user_ym_idx` ON `agg_standard_clause` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_clause_ref_idx` ON `agg_standard_clause` (`referentialId`);--> statement-breakpoint
CREATE INDEX `checklist_audit_question_idx` ON `audit_checklist_answers` (`auditId`,`questionId`);--> statement-breakpoint
CREATE INDEX `checklist_answer_idx` ON `audit_checklist_answers` (`answer`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audits` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_site_idx` ON `audits` (`siteId`);--> statement-breakpoint
CREATE INDEX `audit_status_idx` ON `audits` (`status`);--> statement-breakpoint
CREATE INDEX `audit_start_date_idx` ON `audits` (`startDate`);--> statement-breakpoint
CREATE INDEX `finding_audit_idx` ON `findings` (`auditId`);--> statement-breakpoint
CREATE INDEX `finding_type_idx` ON `findings` (`findingType`);--> statement-breakpoint
CREATE INDEX `finding_status_idx` ON `findings` (`status`);--> statement-breakpoint
CREATE INDEX `finding_criticality_idx` ON `findings` (`criticality`);--> statement-breakpoint
CREATE INDEX `site_user_idx` ON `sites` (`userId`);