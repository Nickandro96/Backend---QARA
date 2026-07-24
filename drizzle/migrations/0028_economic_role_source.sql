-- Additive uniquement : préserve la valeur brute d'economicRole avant toute
-- normalisation, pour permettre un audit/rollback ligne par ligne sans
-- restaurer la sauvegarde complète. Voir CORRECTIONS.md (table de
-- correspondance des rôles, validée ligne par ligne).
ALTER TABLE `questions` ADD COLUMN `economicRoleSource` VARCHAR(255) NULL;
