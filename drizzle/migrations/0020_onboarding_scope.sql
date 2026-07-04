-- Onboarding (SPEC-onboarding-logique.md / SPEC-onboarding-ecrans.md) : les
-- 4 rôles réglementaires n'ont jamais été correctement normalisés dans le
-- corpus (`questions.economicRole` mélange fabricant/organisme DM/fabricant
-- IVD/finished device manufacturer/assembleur/direction, en FR et EN) — voir
-- docs/audit/12-onboarding.md. On ajoute les colonnes normalisées plutôt que
-- de continuer à faire du matching fragile sur le libellé brut.
ALTER TABLE questions
  ADD COLUMN roleReglementaire JSON NULL,
  ADD COLUMN situationTags JSON NULL;

-- Nouvelles colonnes multi-valeurs sur `audits`, en complément (pas en
-- remplacement) de la colonne `economicRole` (VARCHAR, singulier) déjà
-- utilisée par les wizards ISO/MDR existants — ne pas casser leur usage.
ALTER TABLE audits
  ADD COLUMN economicRoles JSON NULL,
  ADD COLUMN markets JSON NULL,
  ADD COLUMN situationTags JSON NULL;

-- Source de vérité unique du périmètre utilisateur (remplace
-- isoQualifications + mdrRoleQualifications, fragmentés et sans équivalent
-- pour FDA/IVDR/MDSAP — voir SPEC-onboarding-logique.md).
CREATE TABLE IF NOT EXISTS `user_audit_scope` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `referentialCodes` json NULL,
  `economicRoles` json NULL,
  `markets` json NULL,
  `situationTags` json NULL,
  `currentStep` varchar(50) NOT NULL DEFAULT 'referentiels',
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_audit_scope_userId_uq` (`userId`),
  CONSTRAINT `user_audit_scope_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
