-- 0003_fix_audits_defaults.sql
-- Fix audits.create using DEFAULT for type + economicRole

ALTER TABLE `audits`
  MODIFY COLUMN `type` varchar(50) NOT NULL DEFAULT 'mdr',
  MODIFY COLUMN `economicRole` varchar(50) NULL DEFAULT NULL;
