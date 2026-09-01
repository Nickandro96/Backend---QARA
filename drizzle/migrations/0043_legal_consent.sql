-- À valider explicitement avant application. Ne pas exécuter automatiquement.
ALTER TABLE users
  ADD COLUMN cgu_accepted_at DATETIME NULL
    COMMENT 'Date d\'acceptation des CGU',
  ADD COLUMN cgu_version VARCHAR(20) NULL
    COMMENT 'Version des CGU acceptées ex. 2026-09-01',
  ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'Consentement communications marketing';
