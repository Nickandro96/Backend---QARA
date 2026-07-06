-- Ajoute une colonne pour conserver l'intitulé fin de processus du corpus
-- (228 valeurs, ex. "Achats", "Manuel qualité") séparément de `processId`,
-- qui référence désormais toujours l'une des 15 catégories canoniques
-- (voir docs/audit/ETAT-DES-LIEUX-mission5-deploiement-complet.md §7 et
-- scripts/process_mapping_228_to_15.json). Sans cette séparation, l'import
-- devait choisir entre filtrage fonctionnel (15 catégories) et détail fin —
-- cette colonne garde les deux.
ALTER TABLE `questions`
  ADD COLUMN `processDetail` VARCHAR(255) DEFAULT NULL;
