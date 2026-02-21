-- 0015_questions_unify_risk_drop_risks.sql
-- Goal:
--   - The `questions` table historically contained BOTH `risk` and `risks`.
--   - This leads to mismatches (front/back/scripts reading different columns).
--   - We standardize on ONE column: `risk`.
--
-- This migration is SAFE / idempotent:
--   - If `risks` does not exist => it does nothing.
--   - If `risks` exists => it backfills `risk` when empty, then drops `risks`.

SET @db := DATABASE();

-- Does column `risks` exist?
SET @has_risks := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'risks'
);

-- Backfill risk from risks when risk is NULL/empty
SET @sql_backfill := IF(
  @has_risks > 0,
  "UPDATE `questions`
   SET `risk` = COALESCE(NULLIF(`risk`, ''), `risks`)
 WHERE (`risk` IS NULL OR `risk` = '')
   AND `risks` IS NOT NULL
   AND `risks` <> ''",
  "SELECT 1"
);

PREPARE stmt_backfill FROM @sql_backfill;
EXECUTE stmt_backfill;
DEALLOCATE PREPARE stmt_backfill;

-- Drop column risks
SET @sql_drop := IF(
  @has_risks > 0,
  "ALTER TABLE `questions` DROP COLUMN `risks`",
  "SELECT 1"
);

PREPARE stmt_drop FROM @sql_drop;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;
