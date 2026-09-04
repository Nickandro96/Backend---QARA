ALTER TABLE `audit_reports`
  ADD COLUMN IF NOT EXISTS `reportType` varchar(50) NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS `reportTitle` varchar(255) NOT NULL DEFAULT 'Rapport d audit',
  ADD COLUMN IF NOT EXISTS `reportVersion` varchar(20) NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS `language` varchar(5) NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS `fileKey` varchar(512) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS `fileUrl` varchar(2048) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS `fileSize` int NULL,
  ADD COLUMN IF NOT EXISTS `fileFormat` varchar(20) NOT NULL DEFAULT 'pdf',
  ADD COLUMN IF NOT EXISTS `generatedBy` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `metadata` json NULL,
  ADD COLUMN IF NOT EXISTS `generatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE `audit_reports`
SET `fileUrl` = COALESCE(NULLIF(`fileUrl`, ''), `reportUrl`)
WHERE (`fileUrl` IS NULL OR `fileUrl` = '') AND `reportUrl` IS NOT NULL;
