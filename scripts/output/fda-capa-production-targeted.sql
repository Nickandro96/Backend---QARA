-- QARA — correctif FDA CAPA ciblé (3 clés)
-- Exécuter uniquement après une sauvegarde récupérable de la base.
-- Une instruction UPDATE à la fois dans Railway Query.
-- Aucun questionKey n'est modifié.

-- Q-FDA-CMC-0807
UPDATE questions
SET
  questionTextSource = CASE
    WHEN questionTextSource IS NULL THEN questionText
    ELSE questionTextSource
  END,
  questionText = 'Sous le QMSR actuel — 21 CFR 820.10 incorporant ISO 13485:2016 §8.5.2 et §8.5.3 (anciennement 21 CFR 820.100 sous la QSR) — prenez votre dernière action corrective. Montrez comment vous avez recherché la cause, défini et appliqué l’action, puis vérifié son efficacité.'
WHERE questionKey = 'Q-FDA-CMC-0807';

-- Q-FDA-CMC-1104
UPDATE questions
SET
  questionTextSource = CASE
    WHEN questionTextSource IS NULL THEN questionText
    ELSE questionTextSource
  END,
  questionText = 'Sous le QMSR actuel — 21 CFR 820.10 incorporant ISO 13485:2016 §8.5.2 et §8.5.3 (anciennement 21 CFR 820.100 sous la QSR) — prenez votre dernière action corrective. Montrez comment vous avez recherché la cause, défini et appliqué l’action, puis vérifié son efficacité.'
WHERE questionKey = 'Q-FDA-CMC-1104';

-- Q-FDA-CMC-4738
UPDATE questions
SET
  questionTextSource = CASE
    WHEN questionTextSource IS NULL THEN questionText
    ELSE questionTextSource
  END,
  questionText = 'Sous le QMSR actuel — 21 CFR 820.10 incorporant ISO 13485:2016 §8.5.2 et §8.5.3 (anciennement 21 CFR 820.100 sous la QSR) — prenez votre dernière action corrective. Montrez comment vous avez recherché la cause, défini et appliqué l’action, puis vérifié son efficacité.'
WHERE questionKey = 'Q-FDA-CMC-4738';

-- Vérification après les trois UPDATE (lecture seule)
SELECT questionKey, questionTextSource, questionText
FROM questions
WHERE questionKey IN ('Q-FDA-CMC-0807', 'Q-FDA-CMC-1104', 'Q-FDA-CMC-4738')
ORDER BY questionKey;
