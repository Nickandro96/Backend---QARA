CREATE TABLE `fda_classifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceName` text NOT NULL,
	`deviceDescription` text,
	`intendedUse` text NOT NULL,
	`resultingClass` enum('I','II','III') NOT NULL,
	`controlLevel` enum('general','special') NOT NULL,
	`pathway` enum('exempt','510k','de_novo','pma') NOT NULL,
	`answers` text NOT NULL,
	`justification` text NOT NULL,
	`projectPlan` text,
	`requiredDocuments` text,
	`auditQuestions` text,
	`risks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_classifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fda_regulatory_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`category` enum('qmsr','part_820','part_807','510k','de_novo','pma','postmarket','labeling_udi','guidance') NOT NULL,
	`cfrPart` varchar(100),
	`impactLevel` enum('high','medium','low') NOT NULL,
	`affectedRoles` text,
	`affectedProcesses` text,
	`affectedDocuments` text,
	`status` enum('acte','a_venir','en_consultation') NOT NULL,
	`effectiveDate` timestamp,
	`publishedAt` timestamp NOT NULL,
	`sourceUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fda_regulatory_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mandatory_documents` MODIFY COLUMN `role` enum('tous','fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer') NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` MODIFY COLUMN `economicRole` enum('fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer','tous') NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` MODIFY COLUMN `economicRole` enum('fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer');--> statement-breakpoint
ALTER TABLE `fda_classifications` ADD CONSTRAINT `fda_classifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fda_user_idx` ON `fda_classifications` (`userId`);--> statement-breakpoint
CREATE INDEX `fda_published_idx` ON `fda_regulatory_updates` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `fda_category_idx` ON `fda_regulatory_updates` (`category`);