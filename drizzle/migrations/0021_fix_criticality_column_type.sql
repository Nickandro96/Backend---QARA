-- La colonne `questions`.`criticality` a été créée quelque part hors du
-- contrôle de version (comme documenté dans 0007b_baseline_core_tables.sql,
-- C-01) avec un type plus restrictif que ce que déclare drizzle/schema.ts
-- (varchar(50)) — probablement un ENUM sans la valeur 'critical' utilisée
-- par le corpus FDA. `CREATE TABLE IF NOT EXISTS` dans 0007b est un no-op
-- si la table existe déjà, donc ce type restrictif survit sans être corrigé.
-- Constaté en déploiement : import-corpus.mjs échoue avec
-- "Data truncated for column 'criticality' at row 1" sur toute question
-- avec criticality='critical' (le corpus FDA/QMSR en contient).
ALTER TABLE `questions` MODIFY COLUMN `criticality` varchar(50) DEFAULT NULL;
