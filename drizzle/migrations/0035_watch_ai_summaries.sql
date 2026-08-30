ALTER TABLE regulatory_updates
  ADD COLUMN summary_fr TEXT NULL COMMENT 'Résumé IA en français — généré depuis raw_content',
  ADD COLUMN summary_en TEXT NULL COMMENT 'Résumé IA en anglais — généré depuis raw_content';
