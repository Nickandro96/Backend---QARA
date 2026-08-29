-- Pré-contrôle obligatoire avant application : cette requête doit retourner 0 ligne.
SELECT `source_id`, `official_id`, COUNT(*) AS duplicate_count
FROM `regulatory_updates`
WHERE `source_id` IS NOT NULL AND `official_id` IS NOT NULL
GROUP BY `source_id`, `official_id`
HAVING COUNT(*) > 1;

ALTER TABLE `regulatory_updates`
  ADD UNIQUE KEY `regulatory_updates_source_official_uq` (`source_id`, `official_id`);
