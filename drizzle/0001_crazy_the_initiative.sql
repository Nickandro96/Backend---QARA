CREATE TABLE `audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`status` enum('conforme','nok','na') NOT NULL,
	`comment` text,
	`respondedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`badgeType` enum('audit_ready','pms_maitrisee','gspr_completes','first_audit','conformity_champion','evidence_master','sprint_achiever') NOT NULL,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_sprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`targetScore` decimal(5,2) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`processId` int,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_sprints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_files_id` PRIMARY KEY(`id`)
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
	`economicRole` enum('fabricant','importateur','distributeur','tous') NOT NULL,
	`questionText` text NOT NULL,
	`expectedEvidence` text,
	`criticality` enum('high','medium','low') NOT NULL,
	`risks` text,
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
CREATE TABLE `regulatory_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`referentialId` int,
	`processId` int,
	`impactLevel` enum('high','medium','low') NOT NULL,
	`affectedRoles` text,
	`status` enum('acte','a_venir','en_consultation') NOT NULL,
	`publishedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatory_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`economicRole` enum('fabricant','importateur','distributeur'),
	`companyName` varchar(255),
	`subscriptionTier` enum('free','pro','expert','entreprise') NOT NULL DEFAULT 'free',
	`subscriptionStartDate` timestamp,
	`subscriptionEndDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `badges` ADD CONSTRAINT `badges_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compliance_sprints` ADD CONSTRAINT `compliance_sprints_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compliance_sprints` ADD CONSTRAINT `compliance_sprints_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_files` ADD CONSTRAINT `evidence_files_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_files` ADD CONSTRAINT `evidence_files_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_question_idx` ON `audit_responses` (`userId`,`questionId`);--> statement-breakpoint
CREATE INDEX `user_badge_idx` ON `badges` (`userId`,`badgeType`);--> statement-breakpoint
CREATE INDEX `user_sprint_idx` ON `compliance_sprints` (`userId`);--> statement-breakpoint
CREATE INDEX `evidence_user_question_idx` ON `evidence_files` (`userId`,`questionId`);--> statement-breakpoint
CREATE INDEX `referential_idx` ON `questions` (`referentialId`);--> statement-breakpoint
CREATE INDEX `process_idx` ON `questions` (`processId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `questions` (`economicRole`);--> statement-breakpoint
CREATE INDEX `published_idx` ON `regulatory_updates` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `user_profiles` (`userId`);