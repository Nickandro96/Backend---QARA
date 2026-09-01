-- À valider explicitement avant application. Ne pas exécuter automatiquement.
ALTER TABLE capa_actions
  ADD COLUMN aiContexte TEXT NULL
    COMMENT 'Contexte de situation généré par IA',
  ADD COLUMN aiNonConformite TEXT NULL
    COMMENT 'Formulation normalisée de la NC',
  ADD COLUMN ai5Pourquoi JSON NULL
    COMMENT 'Analyse 5 Pourquoi structurée',
  ADD COLUMN aiActionsProposees JSON NULL
    COMMENT 'Actions proposées par IA avant sélection',
  ADD COLUMN aiNiveauConfiance VARCHAR(10) NULL,
  ADD COLUMN selectedActionIds JSON NULL
    COMMENT 'IDs des actions choisies par l utilisateur',
  ADD COLUMN progressNote TEXT NULL
    COMMENT 'Note de mise à jour du statut',
  ADD COLUMN progressUpdatedAt DATETIME NULL,
  ADD COLUMN progressUpdatedBy INT NULL,
  ADD COLUMN correctionImmediate TEXT NULL
    COMMENT 'Correction immédiate validée par l utilisateur';
