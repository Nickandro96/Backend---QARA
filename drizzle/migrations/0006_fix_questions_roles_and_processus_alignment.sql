/* 0006_fix_questions_roles_and_processus_alignment.sql */

/* 1) Ensure processus.updatedAt exists (avoid "Unknown column updatedAt") */
SET @col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'processus'
    AND column_name = 'updatedAt'
);

SET @sql := IF(
  @col = 0,
  'ALTER TABLE processus ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

/* 2) Align processus IDs with MDR_PROCESSES displayOrder (1..15)
   This makes questions.processId (2,3,...) match processus.id */
INSERT INTO processus (id, name, createdAt, updatedAt) VALUES
  (1,  'Gouvernance & stratégie réglementaire', NOW(), NOW()),
  (2,  'Affaires réglementaires (RA)',         NOW(), NOW()),
  (3,  'Système de management qualité (QMS)',  NOW(), NOW()),
  (4,  'Gestion des risques (ISO 14971)',      NOW(), NOW()),
  (5,  'Conception & développement',           NOW(), NOW()),
  (6,  'Achats & fournisseurs',                NOW(), NOW()),
  (7,  'Production & sous-traitance',          NOW(), NOW()),
  (8,  'Traçabilité / UDI',                    NOW(), NOW()),
  (9,  'PMS / PMCF',                           NOW(), NOW()),
  (10, 'Vigilance & incidents',                NOW(), NOW()),
  (11, 'Distribution & logistique',            NOW(), NOW()),
  (12, 'Importation',                          NOW(), NOW()),
  (13, 'Documentation technique',              NOW(), NOW()),
  (14, 'Audits & conformité',                  NOW(), NOW()),
  (15, 'IT / données / cybersécurité',         NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  updatedAt = NOW();

/* 3) Normalize economicRole in questions (EN -> FR) */
UPDATE questions
SET economicRole = CASE LOWER(TRIM(economicRole))
  WHEN 'manufacturer' THEN 'fabricant'
  WHEN 'importer'     THEN 'importateur'
  WHEN 'distributor'  THEN 'distributeur'
  WHEN 'authorized representative' THEN 'mandataire'
  WHEN 'authorised representative' THEN 'mandataire'
  WHEN 'ar' THEN 'mandataire'
  ELSE economicRole
END
WHERE economicRole IS NOT NULL AND economicRole <> '';

/* 4) Normalize economicRole in audits (EN -> FR) */
UPDATE audits
SET economicRole = CASE LOWER(TRIM(economicRole))
  WHEN 'manufacturer' THEN 'fabricant'
  WHEN 'importer'     THEN 'importateur'
  WHEN 'distributor'  THEN 'distributeur'
  WHEN 'authorized representative' THEN 'mandataire'
  WHEN 'authorised representative' THEN 'mandataire'
  WHEN 'ar' THEN 'mandataire'
  ELSE economicRole
END
WHERE economicRole IS NOT NULL AND economicRole <> '';

/* 5) Normalize economicRole in mdr_role_qualifications (EN -> FR) */
UPDATE mdr_role_qualifications
SET economicRole = CASE LOWER(TRIM(economicRole))
  WHEN 'manufacturer' THEN 'fabricant'
  WHEN 'importer'     THEN 'importateur'
  WHEN 'distributor'  THEN 'distributeur'
  WHEN 'authorized representative' THEN 'mandataire'
  WHEN 'authorised representative' THEN 'mandataire'
  WHEN 'ar' THEN 'mandataire'
  ELSE economicRole
END
WHERE economicRole IS NOT NULL AND economicRole <> '';
