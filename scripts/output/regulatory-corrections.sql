-- QARA — corrections réglementaires validées (hors passe éditoriale des 45)
-- Ne pas exécuter avant sauvegarde de la base et validation du point de contrôle B.
-- Ce paquet ne modifie aucun questionKey.

-- ISO 14971 : données de production et de surveillance vers le dossier de risques
UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = 'Montrez comment les données de production et de surveillance sont transmises au dossier de gestion des risques. Donnez un exemple où elles ont déclenché une réévaluation.'
WHERE questionKey = 'Q-14971-PPP-1811';

-- FDA QMSR : CAPA selon le règlement actuel (820.10 + ISO 13485 incorporée)
UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  title = 'QMSR — traitement des réclamations et CAPA : 21 CFR 820.35(a) et 820.10, ISO 13485:2016 §8.2.2, §8.5.2 et §8.5.3 incorporées par référence',
  questionText = 'Prenez votre dernière action corrective. Montrez comment vous avez recherché la cause, défini et appliqué l’action, puis vérifié son efficacité.'
WHERE questionKey IN ('Q-FDA-CMC-0807', 'Q-FDA-CMC-1104', 'Q-FDA-CMC-4738');

-- Vérifications attendues : 4 lignes, 4 clés distinctes, aucune ancienne référence 820.100
SELECT questionKey, title, questionTextSource IS NOT NULL AS source_archivee, questionText
FROM questions
WHERE questionKey IN ('Q-14971-PPP-1811', 'Q-FDA-CMC-0807', 'Q-FDA-CMC-1104', 'Q-FDA-CMC-4738')
ORDER BY questionKey;

SELECT COUNT(*) AS lignes_corrigees,
       COUNT(DISTINCT questionKey) AS cles_distinctes
FROM questions
WHERE questionKey IN ('Q-14971-PPP-1811', 'Q-FDA-CMC-0807', 'Q-FDA-CMC-1104', 'Q-FDA-CMC-4738');
