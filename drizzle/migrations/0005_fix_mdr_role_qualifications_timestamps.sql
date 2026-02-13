-- 0005_fix_mdr_role_qualifications_timestamps.sql
-- Add createdAt / updatedAt columns safely (MySQL compatible)

-- createdAt
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'mdr_role_qualifications'
    AND column_name = 'createdAt'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `mdr_role_qualifications` ADD COLUMN `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- updatedAt
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'mdr_role_qualifications'
    AND column_name = 'updatedAt'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `mdr_role_qualifications` ADD COLUMN `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
