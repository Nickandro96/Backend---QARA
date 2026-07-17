CREATE TABLE IF NOT EXISTS `mandatory_documents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `referentialId` int NOT NULL,
  `processId` int,
  `documentName` varchar(255) NOT NULL,
  `reference` varchar(100),
  `role` varchar(50),
  `status` enum('obligatoire','conditionnel','attendu') NOT NULL DEFAULT 'obligatoire',
  `objective` text,
  `minimumContent` text,
  `auditorExpectations` text,
  `commonErrors` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `user_document_status` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `documentId` int NOT NULL,
  `status` enum('manquant','a_mettre_a_jour','conforme') NOT NULL DEFAULT 'manquant',
  `notes` text,
  `fileUrl` varchar(1000),
  `updatedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_doc_idx` (`userId`, `documentId`)
);

ALTER TABLE `mandatory_documents`
  ADD CONSTRAINT `mandatory_documents_referentialId_referentiels_id_fk`
  FOREIGN KEY (`referentialId`) REFERENCES `referentiels`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `mandatory_documents`
  ADD CONSTRAINT `mandatory_documents_processId_processus_id_fk`
  FOREIGN KEY (`processId`) REFERENCES `processus`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `user_document_status`
  ADD CONSTRAINT `user_document_status_userId_users_id_fk`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `user_document_status`
  ADD CONSTRAINT `user_document_status_documentId_mandatory_documents_id_fk`
  FOREIGN KEY (`documentId`) REFERENCES `mandatory_documents`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
