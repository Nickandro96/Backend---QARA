-- Champs manquants identifiés pour un rapport d'audit conforme ISO 19011/
-- ISO 17021-1/MDR Annexe IX/MDSAP AU P0002 (Tâche D.7, validé par
-- l'utilisateur le 2026-07-23 — voir CORRECTIONS.md). Additif uniquement :
-- toutes les colonnes sont NULL-able ou avec valeur par défaut, aucun champ
-- bloquant. Collecte : section éditable post-création sur AuditDetail
-- (audits) et bloc « Profil réglementaire » sur la page Profil
-- (organisations/organisation_certificates).

-- A. Profil réglementaire de l'organisation (page de garde D.2 / section 2)
ALTER TABLE organisations
  ADD COLUMN srn VARCHAR(50) NULL,
  ADD COLUMN logoUrl VARCHAR(2048) NULL,
  ADD COLUMN prrcName VARCHAR(255) NULL,
  ADD COLUMN prrcQualification VARCHAR(255) NULL,
  ADD COLUMN notifiedBodyName VARCHAR(255) NULL,
  ADD COLUMN notifiedBodyNumber VARCHAR(50) NULL;

CREATE TABLE IF NOT EXISTS `organisation_certificates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organisationId` int NOT NULL,
  `referentialCode` varchar(50) NULL,
  `certificateNumber` varchar(100) NULL,
  `issueDate` timestamp NULL,
  `expiryDate` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `organisation_certificates_organisationId_idx` (`organisationId`),
  CONSTRAINT `organisation_certificates_organisationId_fk` FOREIGN KEY (`organisationId`) REFERENCES `organisations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- B. Champs d'audit manquants pour la page de garde / section 1 / annexes
-- du rapport (équipe d'audit, personnes rencontrées, exclusions de
-- périmètre généralisées à tous les référentiels, plan prévu vs réalisé).
ALTER TABLE audits
  ADD COLUMN auditNature VARCHAR(50) NULL,
  ADD COLUMN auditTeam JSON NULL,
  ADD COLUMN auditeesRepresentatives JSON NULL,
  ADD COLUMN scopeExclusions TEXT NULL,
  ADD COLUMN plannedAgenda JSON NULL,
  ADD COLUMN actualAgenda JSON NULL;

-- C. Référence/version/statut/diffusion du rapport (page de garde D.2,
-- exigence de forme D.3 — le rapport n'a jusqu'ici que reportUrl/createdAt).
ALTER TABLE audit_reports
  ADD COLUMN reference VARCHAR(50) NULL,
  ADD COLUMN version INT NOT NULL DEFAULT 1,
  ADD COLUMN status ENUM('draft', 'final') NOT NULL DEFAULT 'draft',
  ADD COLUMN distributionList TEXT NULL,
  ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'fr';

-- D. Méthode de cause racine + gradation MDSAP (section 5/6 du rapport,
-- uniquement pertinent quand le référentiel de l'audit est MDSAP).
ALTER TABLE capa_actions
  ADD COLUMN rootCauseMethod VARCHAR(50) NULL,
  ADD COLUMN mdsapGrade INT NULL,
  ADD COLUMN mdsapEscalation TEXT NULL;
