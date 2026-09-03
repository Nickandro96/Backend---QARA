-- Align the canonical NC/CAPA tables with the fields consumed by dashboard-v2.
-- Additive/idempotent migration: safe for installations where some columns
-- were introduced manually before they were represented in Drizzle.

ALTER TABLE `findings`
  ADD COLUMN IF NOT EXISTS `processId` int NULL,
  ADD COLUMN IF NOT EXISTS `referentialId` int NULL,
  ADD COLUMN IF NOT EXISTS `findingCode` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `findingType` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `criticality` varchar(50) NULL;

ALTER TABLE `actions`
  ADD COLUMN IF NOT EXISTS `title` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `actionType` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `priority` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `responsibleName` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `completedAt` timestamp NULL;

ALTER TABLE `actions`
  MODIFY COLUMN `status` enum(
    'open',
    'in_progress',
    'completed',
    'verified',
    'closed',
    'cancelled'
  ) NOT NULL DEFAULT 'open';

UPDATE `findings`
SET
  `criticality` = COALESCE(`criticality`, `severity`),
  `findingType` = COALESCE(`findingType`,
    CASE
      WHEN LOWER(COALESCE(`severity`, '')) IN ('critical', 'major', 'majeur') THEN 'nc_major'
      WHEN LOWER(COALESCE(`severity`, '')) IN ('minor', 'mineur') THEN 'nc_minor'
      ELSE 'observation'
    END
  )
WHERE `criticality` IS NULL OR `findingType` IS NULL;

UPDATE `actions`
SET
  `responsibleName` = COALESCE(`responsibleName`, `responsible`),
  `completedAt` = CASE
    WHEN `completedAt` IS NULL AND `status` IN ('completed', 'verified', 'closed') THEN `updatedAt`
    ELSE `completedAt`
  END;
