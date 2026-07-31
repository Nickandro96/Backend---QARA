-- Additive uniquement : préserve la valeur originale de questionText avant
-- toute réécriture par la passe mécanique du corpus (troncatures "…"), pour
-- permettre un audit/rollback ligne par ligne sans restaurer la sauvegarde
-- complète. NULL pour toute question non touchée par cette passe. Voir
-- VALIDATION-passe-mecanique.md et scripts/mechanical-pass-reconstruct.mjs.
--
-- Pas de "IF NOT EXISTS" (incident du 2026-07-27, migration 0029 — syntaxe
-- rejetée par le MySQL de production). Si "Duplicate column name" à
-- l'exécution : la colonne existe déjà, c'est un no-op attendu.
ALTER TABLE `questions` ADD COLUMN `questionTextSource` TEXT NULL;
