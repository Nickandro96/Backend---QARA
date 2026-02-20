/* ============================================================
   Cleanup processus (safe with FK):
   - Backup processus
   - Remap questions.processId -> canonical 15 processes (by slug/name)
   - Force any remaining non-canonical refs to 'qms'
   - Delete non-canonical processes (now unreferenced)
   ============================================================ */

-- 0) Backup (safe)
CREATE TABLE IF NOT EXISTS processus_backup_20260220 AS
SELECT * FROM processus;

-- Canonical slug list
-- (must match what you want to keep)
-- 15 slugs:
-- governance_strategy, regulatory_affairs, qms, risk_management, design_development,
-- purchasing_suppliers, production_subcontract, traceability_udi, pms_pmcf, vigilance_incidents,
-- distribution_logistics, importation, technical_documentation, audits_compliance, it_data_cybersecurity

-- 1) Create a mapping old processId -> new canonical processId
DROP TEMPORARY TABLE IF EXISTS processus_map;
CREATE TEMPORARY TABLE processus_map (
  oldId INT PRIMARY KEY,
  newId INT NOT NULL
);

-- 1a) Map by slug (when duplicates share the same slug)
INSERT IGNORE INTO processus_map (oldId, newId)
SELECT p.id AS oldId, c.id AS newId
FROM processus p
JOIN processus c
  ON c.slug IN (
    'governance_strategy',
    'regulatory_affairs',
    'qms',
    'risk_management',
    'design_development',
    'purchasing_suppliers',
    'production_subcontract',
    'traceability_udi',
    'pms_pmcf',
    'vigilance_incidents',
    'distribution_logistics',
    'importation',
    'technical_documentation',
    'audits_compliance',
    'it_data_cybersecurity'
  )
 AND p.slug = c.slug
WHERE p.id <> c.id;

-- 1b) Map by name (when old rows have no slug but same name)
INSERT IGNORE INTO processus_map (oldId, newId)
SELECT p.id AS oldId, c.id AS newId
FROM processus p
JOIN processus c
  ON c.slug IN (
    'governance_strategy',
    'regulatory_affairs',
    'qms',
    'risk_management',
    'design_development',
    'purchasing_suppliers',
    'production_subcontract',
    'traceability_udi',
    'pms_pmcf',
    'vigilance_incidents',
    'distribution_logistics',
    'importation',
    'technical_documentation',
    'audits_compliance',
    'it_data_cybersecurity'
  )
 AND p.name = c.name
WHERE (p.slug IS NULL OR p.slug = '')
  AND p.id <> c.id;

-- 1c) Identity mapping for canonical rows (optional, makes joins easier)
INSERT IGNORE INTO processus_map (oldId, newId)
SELECT id, id FROM processus
WHERE slug IN (
  'governance_strategy',
  'regulatory_affairs',
  'qms',
  'risk_management',
  'design_development',
  'purchasing_suppliers',
  'production_subcontract',
  'traceability_udi',
  'pms_pmcf',
  'vigilance_incidents',
  'distribution_logistics',
  'importation',
  'technical_documentation',
  'audits_compliance',
  'it_data_cybersecurity'
);

-- 2) Remap questions.processId using the map
UPDATE questions q
JOIN processus_map m ON q.processId = m.oldId
SET q.processId = m.newId
WHERE q.processId <> m.newId;

-- 3) Force any remaining references to non-canonical processes -> 'qms'
-- This prevents FK issues if some old processes did not map by slug/name.
UPDATE questions q
JOIN processus p ON q.processId = p.id
SET q.processId = (
  SELECT id FROM processus WHERE slug = 'qms' LIMIT 1
)
WHERE p.slug IS NULL
   OR p.slug NOT IN (
     'governance_strategy',
     'regulatory_affairs',
     'qms',
     'risk_management',
     'design_development',
     'purchasing_suppliers',
     'production_subcontract',
     'traceability_udi',
     'pms_pmcf',
     'vigilance_incidents',
     'distribution_logistics',
     'importation',
     'technical_documentation',
     'audits_compliance',
     'it_data_cybersecurity'
   );

-- 4) Now delete non-canonical processes (should be unreferenced)
DELETE FROM processus
WHERE slug IS NULL
   OR slug NOT IN (
     'governance_strategy',
     'regulatory_affairs',
     'qms',
     'risk_management',
     'design_development',
     'purchasing_suppliers',
     'production_subcontract',
     'traceability_udi',
     'pms_pmcf',
     'vigilance_incidents',
     'distribution_logistics',
     'importation',
     'technical_documentation',
     'audits_compliance',
     'it_data_cybersecurity'
   );

-- 5) Optional: reset AUTO_INCREMENT
SET @max_id := (SELECT IFNULL(MAX(id), 15) FROM processus);
SET @next_ai := @max_id + 1;
SET @sql := CONCAT('ALTER TABLE processus AUTO_INCREMENT = ', @next_ai);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;