ALTER TABLE watch_company_profiles
  ADD COLUMN preferred_referentials JSON NULL COMMENT 'Ex. ["MDR","ISO13485"] — référentiels suivis',
  ADD COLUMN preferred_sources JSON NULL COMMENT 'Ex. ["eur-lex-mdr","federal-register"] — sources activées',
  ADD COLUMN notification_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN notification_frequency ENUM('realtime','daily','weekly','never') NOT NULL DEFAULT 'weekly';
