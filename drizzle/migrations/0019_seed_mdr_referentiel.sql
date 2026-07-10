-- Additive, idempotent: seeds the missing MDR referentiel row.
--
-- Found during corpus diagnosis: every import script and audits.create's
-- default (referentialIds: [1]) hardcode referentialId=1 for MDR, but no
-- migration ever inserted a `referentiels` row with id=1 — only ISO
-- (0001_seed_iso_referentiels.sql, ids 2/3) and FDA (0017_fda_foundation.sql,
-- ids 4/5) seed their referentiels. MDR was the implicit "referentialId 1"
-- without a matching row. The MDR question-retrieval path
-- (server/mdr-router.ts) filters directly on the int referentialId and does
-- not join against `referentiels`, so this gap is not the cause of "Aucune
-- question trouvée" by itself — but it's a real data-consistency gap
-- (MDR has no code/name row, unlike ISO/FDA) worth closing additively.

-- Supports both naming conventions found in this repo (`referentiels` and
-- `referentials`), same defensive pattern as 0001_seed_iso_referentiels.sql.
SET @table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'referentiels'
);

SET @sql := IF(
  @table_exists > 0,
  "INSERT INTO referentiels (id, code, name, type) VALUES (1, 'MDR', 'MDR 2017/745', 'MDR') ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), type = VALUES(type)",
  "INSERT INTO referentials (id, code, name, type) VALUES (1, 'MDR', 'MDR 2017/745', 'MDR') ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name), type = VALUES(type)"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
