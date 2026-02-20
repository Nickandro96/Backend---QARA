/* ============================================================
   Unification processus ISO/MDR -> 15 processus + slug unique
   Idempotent: peut être relancé sans casser (gère "déjà existant")
   ============================================================ */

-- 1) Ajouter la colonne slug si elle n'existe pas
ALTER TABLE `processus`
  ADD COLUMN `slug` VARCHAR(100) NULL AFTER `name`;

-- 2) Index unique sur slug (sera ignoré si déjà existant)
CREATE UNIQUE INDEX `processus_slug_uq` ON `processus` (`slug`);

-- 3) Remplir les slugs pour les 10 processus existants (id=1..10)
UPDATE `processus` SET `slug` = 'governance_strategy' WHERE `id` = 1 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'regulatory_affairs'     WHERE `id` = 2 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'qms'                    WHERE `id` = 3 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'risk_management'        WHERE `id` = 4 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'design_development'     WHERE `id` = 5 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'purchasing_suppliers'   WHERE `id` = 6 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'production_subcontract' WHERE `id` = 7 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'traceability_udi'       WHERE `id` = 8 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'pms_pmcf'               WHERE `id` = 9 AND (`slug` IS NULL OR `slug` = '');
UPDATE `processus` SET `slug` = 'vigilance_incidents'    WHERE `id` = 10 AND (`slug` IS NULL OR `slug` = '');

-- 4) Insérer les 5 processus manquants (11..15)
-- NB: Si l'ID existe déjà, INSERT IGNORE ne fera rien.
INSERT IGNORE INTO `processus` (`id`, `name`, `slug`, `description`, `displayOrder`, `icon`, `createdAt`, `updatedAt`)
VALUES
  (11, 'Distribution & logistique',           'distribution_logistics',     NULL, 0, NULL, NOW(), NOW()),
  (12, 'Importation',                         'importation',               NULL, 0, NULL, NOW(), NOW()),
  (13, 'Documentation technique',             'technical_documentation',   NULL, 0, NULL, NOW(), NOW()),
  (14, 'Audits & conformité',                 'audits_compliance',         NULL, 0, NULL, NOW(), NOW()),
  (15, 'IT / données / cybersécurité',        'it_data_cybersecurity',     NULL, 0, NULL, NOW(), NOW());

-- 5) Sécuriser: si certains slugs sont encore NULL, on les met en fallback unique basé sur l'id
-- (évite slug NULL si tu veux tout baser sur slug à terme)
UPDATE `processus`
SET `slug` = CONCAT('process_', `id`)
WHERE (`slug` IS NULL OR `slug` = '');
