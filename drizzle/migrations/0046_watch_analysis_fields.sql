-- À valider explicitement avant application. Ne pas exécuter automatiquement.
ALTER TABLE regulatory_updates
  ADD COLUMN criticality ENUM('informational', 'watch', 'action_required') NULL,
  ADD COLUMN key_changes JSON NULL,
  ADD COLUMN action_required TEXT NULL;
