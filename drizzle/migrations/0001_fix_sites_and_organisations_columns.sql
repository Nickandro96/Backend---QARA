-- 0001_fix_sites_and_organisations_columns.sql
-- Goal: add expected columns (camelCase) without breaking legacy columns
-- and backfill from legacy columns when present.

SET @db := DATABASE();

-- -----------------------
-- SITES: add missing columns
-- -----------------------
-- userId
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='userId';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `userId` INT NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- addressLine1
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='addressLine1';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `addressLine1` VARCHAR(255) NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- addressLine2
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='addressLine2';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `addressLine2` VARCHAR(255) NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- postalCode
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='postalCode';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `postalCode` VARCHAR(30) NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- code
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='code';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `code` VARCHAR(50) NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- isActive
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='isActive';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `isActive` TINYINT(1) NULL DEFAULT 1;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- organisationId
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='organisationId';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `organisationId` INT NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notes (si pas déjà ajouté)
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='notes';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `notes` TEXT NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email (si pas déjà ajouté)
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='email';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `email` VARCHAR(255) NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone (si pas déjà ajouté)
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='phone';
SET @sql := IF(@c=0, 'ALTER TABLE `sites` ADD COLUMN `phone` VARCHAR(50) NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill from legacy columns if they exist
-- userid -> userId
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='userid';
SET @sql := IF(@c>0, 'UPDATE `sites` SET `userId` = `userid` WHERE `userId` IS NULL AND `userid` IS NOT NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- address -> addressLine1
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='sites' AND COLUMN_NAME='address';
SET @sql := IF(@c>0, 'UPDATE `sites` SET `addressLine1` = `address` WHERE `addressLine1` IS NULL AND `address` IS NOT NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------
-- ORGANISATIONS: add missing columns
-- -----------------------
-- userId
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='organisations' AND COLUMN_NAME='userId';
SET @sql := IF(@c=0, 'ALTER TABLE `organisations` ADD COLUMN `userId` INT NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- createdAt
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='organisations' AND COLUMN_NAME='createdAt';
SET @sql := IF(@c=0, 'ALTER TABLE `organisations` ADD COLUMN `createdAt` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- updatedAt
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='organisations' AND COLUMN_NAME='updatedAt';
SET @sql := IF(@c=0, 'ALTER TABLE `organisations` ADD COLUMN `updatedAt` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill userid -> userId if legacy exists
SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@db AND TABLE_NAME='organisations' AND COLUMN_NAME='userid';
SET @sql := IF(@c>0, 'UPDATE `organisations` SET `userId` = `userid` WHERE `userId` IS NULL AND `userid` IS NOT NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
