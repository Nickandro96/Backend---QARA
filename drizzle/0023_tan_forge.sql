-- Update audit_responses table
ALTER TABLE `audit_responses` ADD COLUMN IF NOT EXISTS `auditId` int;
ALTER TABLE `audit_responses` ADD COLUMN IF NOT EXISTS `questionKey` varchar(255);
ALTER TABLE `audit_responses` ADD COLUMN IF NOT EXISTS `note` text;
ALTER TABLE `audit_responses` ADD COLUMN IF NOT EXISTS `role` varchar(50);
ALTER TABLE `audit_responses` ADD COLUMN IF NOT EXISTS `processId` varchar(50);

-- Create mdr_evidence_files table if not exists
CREATE TABLE IF NOT EXISTS `mdr_evidence_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`auditId` int NOT NULL,
	`questionKey` varchar(255) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mdr_evidence_files_id` PRIMARY KEY(`id`)
);

-- Add indexes and constraints if not exists
DROP PROCEDURE IF EXISTS AddMdrConstraints;
DELIMITER //
CREATE PROCEDURE AddMdrConstraints()
BEGIN
    -- Add foreign key for mdr_evidence_files
    IF NOT EXISTS (SELECT * FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_NAME = 'mdr_evidence_files_userId_users_id_fk') THEN
        ALTER TABLE `mdr_evidence_files` ADD CONSTRAINT `mdr_evidence_files_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade;
    END IF;

    -- Add index for mdr_evidence_files
    IF NOT EXISTS (SELECT * FROM information_schema.STATISTICS WHERE TABLE_NAME = 'mdr_evidence_files' AND INDEX_NAME = 'mdr_evidence_user_audit_question_idx') THEN
        CREATE INDEX `mdr_evidence_user_audit_question_idx` ON `mdr_evidence_files` (`userId`,`auditId`,`questionKey`);
    END IF;

    -- Add unique index for audit_responses if not exists
    IF NOT EXISTS (SELECT * FROM information_schema.STATISTICS WHERE TABLE_NAME = 'audit_responses' AND INDEX_NAME = 'user_audit_question_key_idx') THEN
        CREATE UNIQUE INDEX `user_audit_question_key_idx` ON `audit_responses` (`userId`,`auditId`,`questionKey`);
    END IF;
END //
DELIMITER ;
CALL AddMdrConstraints();
DROP PROCEDURE IF EXISTS AddMdrConstraints;
