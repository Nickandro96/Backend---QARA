/* Ensure slug is always present */
UPDATE processus
SET slug = CONCAT('process_', id)
WHERE slug IS NULL OR slug = '';

ALTER TABLE processus
  MODIFY COLUMN slug VARCHAR(100) NOT NULL;