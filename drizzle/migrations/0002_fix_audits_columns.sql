-- 0002_fix_audits_columns.sql
-- Align DB schema with drizzle/schema.ts for `audits`

-- 1) If legacy column `auditType` exists, rename to `type`
SET @has_auditType := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audits'
    AND COLUMN_NAME = 'auditType'
);

SET @has_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audits'
    AND COLUMN_NAME = 'type'
);

SET @sql := IF(@has_auditType > 0 AND @has_type = 0,
  'ALTER TABLE `audits` CHANGE COLUMN `auditType` `type` varchar(50) NOT NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Ensure column `type` exists (if neither existed)
SET @has_type2 := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audits'
    AND COLUMN_NAME = 'type'
);

SET @sql := IF(@has_type2 = 0,
  'ALTER TABLE `audits` ADD COLUMN `type` varchar(50) NOT NULL DEFAULT ''mdr'' AFTER `name`;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Ensure economicRole exists
SET @has_econ := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audits'
    AND COLUMN_NAME = 'economicRole'
);
SET @sql := IF(@has_econ = 0,
  'ALTER TABLE `audits` ADD COLUMN `economicRole` varchar(50) NULL AFTER `status`;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Ensure processIds exists
SET @has_proc := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audits'
    AND COLUMN_NAME = 'processIds'
);
SET @sql := IF(@has_proc = 0,
  'ALTER TABLE `audits` ADD COLUMN `processIds` json NULL AFTER `economicRole`;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5) Ensure referentialIds exists
SET @has_ref := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audits'
    AND COLUMN_NAME = 'referentialIds'
);
SET @sql := IF(@has_ref = 0,
  'ALTER TABLE `audits` ADD COLUMN `referentialIds` json NULL AFTER `processIds`;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
