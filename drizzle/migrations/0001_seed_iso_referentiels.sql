-- Seed ISO referentials with stable ids.
-- Supports both naming conventions found in projects: `referentiels` and `referentials`.

SET @table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'referentiels'
);

SET @sql := IF(
  @table_exists > 0,
  "INSERT INTO referentiels (id, code, name) VALUES (2, 'ISO9001', 'ISO 9001'), (3, 'ISO13485', 'ISO 13485') ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name)",
  "INSERT INTO referentials (id, code, name) VALUES (2, 'ISO9001', 'ISO 9001'), (3, 'ISO13485', 'ISO 13485') ON DUPLICATE KEY UPDATE code = VALUES(code), name = VALUES(name)"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
