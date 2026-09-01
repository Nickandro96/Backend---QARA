-- À valider explicitement avant application. Ne pas exécuter automatiquement.
ALTER TABLE capa_actions
  ADD COLUMN watchItemId VARCHAR(36) NULL
    COMMENT 'ID regulatory_updates si NC issue de la veille',
  ADD COLUMN source ENUM('audit', 'veille_reglementaire', 'manuel')
    NOT NULL DEFAULT 'audit';

CREATE INDEX capa_actions_watch_item_idx ON capa_actions (watchItemId);
