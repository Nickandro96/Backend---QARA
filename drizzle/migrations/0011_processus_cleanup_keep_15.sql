/* ============================================================
   Cleanup processus: keep ONLY the 15 canonical slugs
   - Creates a backup table first
   - Deletes non-canonical rows
   ============================================================ */

-- 0) Backup (safe)
CREATE TABLE IF NOT EXISTS processus_backup_20260220 AS
SELECT * FROM processus;

-- 1) Delete everything that is NOT part of the canonical 15
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

-- 2) Optional: reset AUTO_INCREMENT (so new inserts start after max id)
-- (safe even if skipped)
SET @max_id := (SELECT IFNULL(MAX(id), 15) FROM processus);
SET @next_ai := @max_id + 1;
SET @sql := CONCAT('ALTER TABLE processus AUTO_INCREMENT = ', @next_ai);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
