-- Corrige une contrainte de clé étrangère héritée sur `questions.referentialId`
-- qui référence par erreur une table `referentials` (anglais, absente du
-- schéma versionné) au lieu de `referentiels` (nom réel de la table, voir
-- drizzle/schema.ts) — dérive de schéma non versionnée antérieure (même
-- famille que C-01, docs/audit/02-audit-technique.md). Confirmé par le
-- message d'erreur observé sur l'environnement de test :
--   CONSTRAINT `questions_referentialId_referentials_id_fk`
--   FOREIGN KEY (`referentialId`) REFERENCES `referentials` (`id`)
-- Aucune migration versionnée ne crée cette contrainte (elle a été créée hors
-- contrôle de version, avant le renommage de la table en `referentiels`) —
-- reproduit et vérifié localement en recréant volontairement cette contrainte.
-- Idempotent : sans effet si la contrainte est déjà correcte ou absente.

-- 1) Nettoie les valeurs orphelines avant d'ajouter la bonne contrainte
--    (sécurité : sans effet si aucune ligne orpheline ; le prochain import
--    réécrit de toute façon referentialId pour chaque question).
UPDATE `questions`
SET `referentialId` = NULL
WHERE `referentialId` IS NOT NULL
  AND `referentialId` NOT IN (SELECT `id` FROM `referentiels`);

-- 2) Supprime l'ancienne contrainte si elle pointe vers la mauvaise table.
SET @wrong_fk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'referentialId'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    AND REFERENCED_TABLE_NAME <> 'referentiels'
  LIMIT 1
);
SET @drop_sql := IF(
  @wrong_fk IS NOT NULL,
  CONCAT('ALTER TABLE `questions` DROP FOREIGN KEY `', @wrong_fk, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Ajoute la bonne contrainte si elle n'existe pas déjà.
SET @has_correct_fk := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'referentialId'
    AND REFERENCED_TABLE_NAME = 'referentiels'
);
SET @add_sql := IF(
  @has_correct_fk = 0,
  'ALTER TABLE `questions` ADD CONSTRAINT `questions_referentialId_referentiels_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentiels` (`id`)',
  'SELECT 1'
);
PREPARE stmt2 FROM @add_sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
