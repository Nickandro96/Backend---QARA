-- Étend la capacité des titres réglementaires complets du corpus QARA.
-- Le corpus validé contient des titres jusqu’à 333 caractères.
-- Modification additive de capacité : aucune valeur existante n’est réécrite.
ALTER TABLE questions
  MODIFY COLUMN title VARCHAR(1024) NULL;
