CREATE TABLE `fda_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceName` text NOT NULL,
	`submissionType` enum('510k','de_novo','pma','pma_supplement','ide') NOT NULL,
	`submissionNumber` varchar(100),
	`fdaClassification` enum('class_i','class_ii','class_iii'),
	`status` enum('planning','preparation','submitted','under_review','additional_info_requested','approved','denied') NOT NULL DEFAULT 'planning',
	`submissionDate` timestamp,
	`targetSubmissionDate` timestamp,
	`fdaReviewDeadline` timestamp,
	`approvalDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fda_submissions` ADD CONSTRAINT `fda_submissions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `fda_submissions` (`userId`);