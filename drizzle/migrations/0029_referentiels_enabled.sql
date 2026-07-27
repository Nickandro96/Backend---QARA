-- Additive uniquement : permet de désactiver un référentiel du wizard
-- générique (étape 0, sélection du référentiel) sans supprimer ses lignes
-- ni casser les audits déjà créés dessus. DEFAULT true : aucun référentiel
-- existant n'est masqué par cette migration. Voir CORRECTIONS.md.
ALTER TABLE `referentiels` ADD COLUMN IF NOT EXISTS `enabled` BOOLEAN NOT NULL DEFAULT true;
