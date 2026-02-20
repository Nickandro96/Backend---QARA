/* ============================================================
   Ensure 15 canonical processes exist (UPSERT by slug)
   - Does NOT rely on fixed IDs
   - If a slug exists: updates name + updatedAt
   - If missing: inserts a new row
   ============================================================ */

INSERT INTO `processus` (`name`, `slug`, `description`, `displayOrder`, `icon`, `createdAt`, `updatedAt`)
VALUES
  ('Distribution & logistique',      'distribution_logistics',     NULL, 0, NULL, NOW(), NOW()),
  ('Importation',                    'importation',               NULL, 0, NULL, NOW(), NOW()),
  ('Documentation technique',        'technical_documentation',   NULL, 0, NULL, NOW(), NOW()),
  ('Audits & conformité',            'audits_compliance',         NULL, 0, NULL, NOW(), NOW()),
  ('IT / données / cybersécurité',   'it_data_cybersecurity',     NULL, 0, NULL, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `updatedAt` = NOW();