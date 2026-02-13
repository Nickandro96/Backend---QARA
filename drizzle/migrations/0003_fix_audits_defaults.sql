-- Ensure audits.type has a DEFAULT and economicRole is nullable
ALTER TABLE `audits`
  MODIFY COLUMN `type` varchar(50) NOT NULL DEFAULT 'mdr',
  MODIFY COLUMN `economicRole` varchar(50) NULL DEFAULT NULL;
