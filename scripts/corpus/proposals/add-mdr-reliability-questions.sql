-- PROPOSITION UNIQUEMENT — NON EXÉCUTÉE LE 2026-09-19.
-- À faire valider par un expert MDR avant toute insertion en production.
-- Les six questionKey ont été vérifiés absents de production le 2026-09-19.

START TRANSACTION;

INSERT INTO questions
  (questionKey, questionText, referentialId, processId, article, criticality, economicRole, isActive)
SELECT
  'Q-MDR-RISK-ISO14971-2026',
  'Votre analyse de risques fait-elle référence à la norme ISO 14971:2019 et à ses annexes informatives ZA et ZB ?',
  3, p.id, 'MDR Art. 10(2), ISO 14971:2019 §3.5', 'high', 'fabricant', 1
FROM processus p
WHERE p.slug = 'risk_management'
  AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.questionKey = 'Q-MDR-RISK-ISO14971-2026');

INSERT INTO questions
  (questionKey, questionText, referentialId, processId, article, criticality, economicRole, isActive)
SELECT
  'Q-MDR-RISK-BENEFIT-2026',
  'Le rapport bénéfice/risque est-il documenté et justifié pour chaque destination d''usage ?',
  3, p.id, 'MDR Annexe I §8', 'critical', 'fabricant', 1
FROM processus p
WHERE p.slug = 'risk_management'
  AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.questionKey = 'Q-MDR-RISK-BENEFIT-2026');

INSERT INTO questions
  (questionKey, questionText, referentialId, processId, article, criticality, economicRole, isActive)
SELECT
  'Q-MDR-PMS-PSUR-2026',
  'Avez-vous établi un PSUR (Periodic Safety Update Report) pour vos dispositifs classe IIa et supérieure ?',
  3, p.id, 'MDR Art. 86', 'critical', 'fabricant', 1
FROM processus p
WHERE p.slug = 'pms_pmcf'
  AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.questionKey = 'Q-MDR-PMS-PSUR-2026');

INSERT INTO questions
  (questionKey, questionText, referentialId, processId, article, criticality, economicRole, isActive)
SELECT
  'Q-MDR-PMS-PSR-2026',
  'Votre PSR (Post-Market Summary Report) est-il mis à jour annuellement pour vos dispositifs classe I ?',
  3, p.id, 'MDR Art. 85', 'high', 'fabricant', 1
FROM processus p
WHERE p.slug = 'pms_pmcf'
  AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.questionKey = 'Q-MDR-PMS-PSR-2026');

INSERT INTO questions
  (questionKey, questionText, referentialId, processId, article, criticality, economicRole, isActive)
SELECT
  'Q-MDR-UDI-EUDAMED-2026',
  'L''UDI-DI de chaque dispositif est-il enregistré dans EUDAMED ?',
  3, p.id, 'MDR Art. 27', 'high', 'fabricant', 1
FROM processus p
WHERE p.slug = 'traceability_udi'
  AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.questionKey = 'Q-MDR-UDI-EUDAMED-2026');

INSERT INTO questions
  (questionKey, questionText, referentialId, processId, article, criticality, economicRole, isActive)
SELECT
  'Q-MDR-UDI-AIDC-HRI-2026',
  'Le support UDI physique (étiquette) est-il conforme aux exigences de format (AIDC + HRI) ?',
  3, p.id, 'MDR Annexe VI Partie C', 'high', 'fabricant', 1
FROM processus p
WHERE p.slug = 'traceability_udi'
  AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.questionKey = 'Q-MDR-UDI-AIDC-HRI-2026');

-- Contrôle attendu avant validation : exactement 6 lignes proposées.
SELECT questionKey, questionText, referentialId, processId, criticality, economicRole, isActive
FROM questions
WHERE questionKey IN (
  'Q-MDR-RISK-ISO14971-2026', 'Q-MDR-RISK-BENEFIT-2026',
  'Q-MDR-PMS-PSUR-2026', 'Q-MDR-PMS-PSR-2026',
  'Q-MDR-UDI-EUDAMED-2026', 'Q-MDR-UDI-AIDC-HRI-2026'
)
ORDER BY questionKey;

-- Remplacer ROLLBACK par COMMIT seulement après validation métier explicite.
ROLLBACK;
