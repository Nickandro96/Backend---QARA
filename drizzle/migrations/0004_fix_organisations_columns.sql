-- 0003_fix_organisations_columns.sql
-- Add missing columns expected by API (organizations.list)

ALTER TABLE `organisations`
  ADD COLUMN `legalEntityType` varchar(50) NULL,
  ADD COLUMN `addressLine1` varchar(255) NULL,
  ADD COLUMN `addressLine2` varchar(255) NULL,
  ADD COLUMN `city` varchar(100) NULL,
  ADD COLUMN `postalCode` varchar(20) NULL,
  ADD COLUMN `country` varchar(100) NULL;
