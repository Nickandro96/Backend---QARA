CREATE TABLE `audit_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`userId` int NOT NULL,
	`reportType` enum('complete','executive','comparative','action_plan','evidence_index') NOT NULL,
	`reportTitle` varchar(500) NOT NULL,
	`reportVersion` varchar(50) NOT NULL DEFAULT '1.0',
	`referentialIds` text,
	`processIds` text,
	`economicRole` varchar(100),
	`market` varchar(50),
	`fileKey` varchar(500),
	`fileUrl` varchar(1000),
	`fileSize` int,
	`fileFormat` varchar(20) NOT NULL DEFAULT 'pdf',
	`metadata` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`generatedBy` int NOT NULL,
	`comparedAuditIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`reportType` enum('complete','executive','comparative','action_plan','evidence_index') NOT NULL,
	`structure` text NOT NULL,
	`styling` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_generatedBy_users_id_fk` FOREIGN KEY (`generatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_templates` ADD CONSTRAINT `report_templates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_reports_audit_idx` ON `audit_reports` (`auditId`);--> statement-breakpoint
CREATE INDEX `audit_reports_user_idx` ON `audit_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_reports_generated_at_idx` ON `audit_reports` (`generatedAt`);--> statement-breakpoint
CREATE INDEX `report_templates_user_idx` ON `report_templates` (`userId`);--> statement-breakpoint
CREATE INDEX `report_templates_type_idx` ON `report_templates` (`reportType`);