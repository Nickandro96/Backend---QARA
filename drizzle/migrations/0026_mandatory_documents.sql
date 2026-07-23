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

-- Contraintes ajoutées de façon idempotente (garde information_schema) plutôt
-- que via un simple ADD CONSTRAINT : MariaDB 10.11 ne supporte pas
-- `ADD CONSTRAINT IF NOT EXISTS ... FOREIGN KEY` (testé, erreur de syntaxe
-- 1064), et un ADD CONSTRAINT nu sur un nom déjà pris échoue avec
-- ER_FK_DUP_NAME (1826) — c'est cet incident qui a bloqué 0027 en
-- production (voir CORRECTIONS.md, script apply-sql-migrations.ts toléré en
-- complément, mais rendre cette migration elle-même idempotente évite de
-- dépendre uniquement de la tolérance du runner).
SET @fk1 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'mandatory_documents'
    AND CONSTRAINT_NAME = 'mandatory_documents_referentialId_referentiels_id_fk'
);
SET @sql1 := IF(@fk1 = 0,
  'ALTER TABLE `mandatory_documents` ADD CONSTRAINT `mandatory_documents_referentialId_referentiels_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentiels`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @fk2 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'mandatory_documents'
    AND CONSTRAINT_NAME = 'mandatory_documents_processId_processus_id_fk'
);
SET @sql2 := IF(@fk2 = 0,
  'ALTER TABLE `mandatory_documents` ADD CONSTRAINT `mandatory_documents_processId_processus_id_fk` FOREIGN KEY (`processId`) REFERENCES `processus`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @fk3 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_document_status'
    AND CONSTRAINT_NAME = 'user_document_status_userId_users_id_fk'
);
SET @sql3 := IF(@fk3 = 0,
  'ALTER TABLE `user_document_status` ADD CONSTRAINT `user_document_status_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @fk4 := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_document_status'
    AND CONSTRAINT_NAME = 'user_document_status_documentId_mandatory_documents_id_fk'
);
SET @sql4 := IF(@fk4 = 0,
  'ALTER TABLE `user_document_status` ADD CONSTRAINT `user_document_status_documentId_mandatory_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mandatory_documents`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;
