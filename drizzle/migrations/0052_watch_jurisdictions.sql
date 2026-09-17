ALTER TABLE `regulatory_updates`
  MODIFY COLUMN `jurisdiction` enum('EU','UK','CH','US','CA','AU','JP') NOT NULL DEFAULT 'EU';
