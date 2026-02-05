CREATE TABLE `mandatory_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referentialId` int NOT NULL,
	`processId` int,
	`role` enum('tous','fabricant','importateur','distributeur') NOT NULL,
	`documentName` varchar(500) NOT NULL,
	`reference` varchar(100) NOT NULL,
	`status` enum('obligatoire','conditionnel','attendu') NOT NULL,
	`objective` text NOT NULL,
	`minimumContent` text NOT NULL,
	`auditorExpectations` text,
	`commonErrors` text,
	`linkedDocuments` text,
	`linkedQuestions` text,
	`templateUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mandatory_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_document_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int NOT NULL,
	`status` enum('manquant','a_mettre_a_jour','conforme') NOT NULL DEFAULT 'manquant',
	`lastReviewDate` timestamp,
	`notes` text,
	`fileUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_document_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mandatory_documents` ADD CONSTRAINT `mandatory_documents_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mandatory_documents` ADD CONSTRAINT `mandatory_documents_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_document_status` ADD CONSTRAINT `user_document_status_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_document_status` ADD CONSTRAINT `user_document_status_documentId_mandatory_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mandatory_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `referential_idx` ON `mandatory_documents` (`referentialId`);--> statement-breakpoint
CREATE INDEX `process_idx` ON `mandatory_documents` (`processId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `mandatory_documents` (`role`);--> statement-breakpoint
CREATE INDEX `user_doc_idx` ON `user_document_status` (`userId`,`documentId`);