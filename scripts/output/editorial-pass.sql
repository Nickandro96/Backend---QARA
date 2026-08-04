-- QARA — Passe éditoriale du corpus : script de reconstruction (45 questions)
-- Généré par scripts/editorial-pass-apply.mjs le 2026-08-04T08:39:34.691Z
-- Fait suite à la passe mécanique (171 questions, migration 0030, déjà en prod).
--
-- PROCÉDURE (un bloc à la fois dans l'éditeur Query Railway) :
--   1. Sauvegarde préalable de la table questions (obligatoire, hors de ce fichier).
--   2. Bloc "0. VERIFICATION AVANT" — noter les résultats.
--   3. Un bloc UPDATE par référentiel (idempotent : rejouable sans double effet,
--      questionTextSource n'est peuplée qu'une seule fois via CASE/IS NULL —
--      la colonne existe déjà, migration 0030 appliquée avec la passe mécanique).
--   4. Bloc "VERIFICATION APRES" — comparer aux résultats attendus.
--
-- Aucun questionKey modifié. Aucune ligne supprimée ni ajoutée. Aucune
-- exigence réglementaire inventée — reformulations ancrées sur title/
-- expectedEvidence/officialSource de chaque ligne et, pour 13 lignes au
-- title lui-même tronqué à 250 caractères (voir rapport), sur le texte
-- réglementaire réel vérifié (21 CFR 860 Subpart D, FD&C 524B, MDR Art.
-- 32/10(14), ISO 9001 Amd.1:2024, MDSAP AU P0002).

-- ============================================================
-- 0. VERIFICATION AVANT (lecture seule)
-- ============================================================

-- 0a. Total du corpus (attendu : 473, inchangé)
SELECT COUNT(*) AS total FROM questions;

-- 0b. Questions encore tronquées (attendu avant ce script : 45 — la passe
--     mécanique a déjà ramené 216 à 45)
SELECT COUNT(*) AS tronquees FROM questions WHERE questionText LIKE '%…%';

-- 0c. questionTextSource déjà peuplée sur 171 lignes (passe mécanique) —
--     confirme qu'on repart du bon état
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- ============================================================
-- RECONSTRUCTION EDITORIALE — MDR (3 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-MDR-S-3363' THEN 'Pour un dispositif implantable ou de classe III, montrez que le résumé de sécurité et de performances est compréhensible, validé par l''organisme notifié et publié dans Eudamed.'
    WHEN 'Q-MDR-S-5062' THEN 'Qui vérifie et met à jour le résumé de sécurité et de performances ? Montrez la dernière version et son approbation.'
    WHEN 'Q-MDR-SM-0792' THEN 'Montrez la dernière demande reçue d''une autorité et votre réponse. Avez-vous fourni tous les documents et échantillons demandés dans la langue acceptée ?'
    ELSE questionText
  END
WHERE questionKey IN ('Q-MDR-S-3363', 'Q-MDR-S-5062', 'Q-MDR-SM-0792');

-- ============================================================
-- RECONSTRUCTION EDITORIALE — IVDR (3 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-IVDR-MSMI-5641' THEN 'Avant de mettre un DIV sur le marché, quels contrôles réalisez-vous pour vérifier qu''il respecte l''IVDR et qu''il est utilisé comme prévu ? Montrez un dossier réel.'
    WHEN 'Q-IVDR-PI-0993' THEN 'Pour votre dernier rapport périodique de sécurité applicable, montrez qu''il a été mis à jour, approuvé et transmis comme prévu.'
    WHEN 'Q-IVDR-GIUI-6261' THEN 'Prenez un DIV commercialisé. Montrez que son étiquette et sa notice sont lisibles, conformes et approuvées avant utilisation.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-IVDR-MSMI-5641', 'Q-IVDR-PI-0993', 'Q-IVDR-GIUI-6261');

-- ============================================================
-- RECONSTRUCTION EDITORIALE — FDA_QMSR (7 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-FDA-5K-1069' THEN 'Pour un dossier 510(k) récent, pourquoi avez-vous choisi le dispositif de comparaison et quelles preuves montrent que votre dispositif est aussi sûr et efficace ?'
    WHEN 'Q-FDA-N-2561' THEN 'Pour un dossier De Novo, pourquoi cette voie a-t-elle été choisie et pourquoi aucun dispositif de comparaison adapté n''existait-il ?'
    WHEN 'Q-FDA-N-1933' THEN 'Qui a validé le choix de la voie De Novo ? Montrez l''analyse des risques et les preuves utilisées pour cette décision.'
    WHEN 'Q-FDA-N-6492' THEN 'Pour un dossier De Novo accepté, montrez la décision de la FDA et les contrôles particuliers que vous devez maintenant respecter.'
    WHEN 'Q-FDA-SQ-5662' THEN 'Prenez un fournisseur critique. Comment l''avez-vous choisi, contrôlé et suivi ? Montrez les résultats les plus récents.'
    WHEN 'Q-FDA-SC-6736' THEN 'Pour un dispositif connecté récent, montrez comment la cybersécurité a été prise en compte depuis la conception jusqu''à la validation, y compris la liste des composants logiciels.'
    WHEN 'Q-FDA-SC-4677' THEN 'Comment surveillez-vous et corrigez-vous les failles de cybersécurité après la mise sur le marché ? Montrez-moi un exemple réel.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-FDA-5K-1069', 'Q-FDA-N-2561', 'Q-FDA-N-1933', 'Q-FDA-N-6492', 'Q-FDA-SQ-5662', 'Q-FDA-SC-6736', 'Q-FDA-SC-4677');

-- ============================================================
-- RECONSTRUCTION EDITORIALE — MDSAP (1 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-MDSAP-PL-3453' THEN 'Montrez-moi un exemple où un problème trouvé dans un processus a conduit à contrôler plus en détail un autre processus lié.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-MDSAP-PL-3453');

-- ============================================================
-- RECONSTRUCTION EDITORIALE — ISO14971 (25 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-14971-MR-4038' THEN 'Prenez un risque réel. Quelles mesures avez-vous envisagées, laquelle avez-vous retenue et pourquoi ? Montrez que le risque restant est acceptable.'
    WHEN 'Q-14971-MR-9272' THEN 'Montrez-moi un exemple où l''analyse des risques a conduit à une décision ou à une modification du dispositif. Quelle preuve garde la trace de cette décision ?'
    WHEN 'Q-14971-AOM-0896' THEN 'Pour un risque réel, avez-vous d''abord cherché à le réduire par la conception, puis par une protection, et enfin par une information de sécurité ? Montrez votre choix.'
    WHEN 'Q-14971-AOM-5470' THEN 'Montrez-moi un exemple où vous avez suivi l''ordre prévu pour réduire un risque. Pourquoi avez-vous retenu cette solution ?'
    WHEN 'Q-14971-AOM-2955' THEN 'Qui a choisi la mesure utilisée pour réduire le risque ? Montrez les preuves utilisées et comment son efficacité a été vérifiée.'
    WHEN 'Q-14971-MŒC-8079' THEN 'Pour une mesure destinée à réduire un risque, montrez qu''elle a bien été mise en place et qu''elle réduit réellement ce risque.'
    WHEN 'Q-14971-ABR-2180' THEN 'Prenez un risque qui reste trop élevé après les mesures mises en place. Montrez pourquoi il ne pouvait pas être réduit davantage et comment vous avez comparé ce risque aux bénéfices attendus du dispositif.'
    WHEN 'Q-14971-ABR-5814' THEN 'Qui a décidé que les bénéfices du dispositif justifiaient le risque restant ? Montrez les données utilisées, la justification et l''approbation de cette décision.'
    WHEN 'Q-14971-ABR-6111' THEN 'Sur un cas concret, montrez ce qui a été décidé lorsqu''un risque restait trop élevé et qu''aucune mesure supplémentaire n''était possible.'
    WHEN 'Q-14971-RIC-1049' THEN 'Prenez une mesure mise en place pour réduire un risque. A-t-elle créé un nouveau risque ou modifié un risque déjà connu ? Montrez comment vous l''avez vérifié et traité.'
    WHEN 'Q-14971-RIC-7118' THEN 'Comment vérifiez-vous que les mesures prises pour réduire un risque n''en créent pas un autre ? Montrez-moi un exemple réel.'
    WHEN 'Q-14971-CM-1778' THEN 'Montrez-moi que tous les dangers identifiés ont été traités et que toutes les actions prévues ont été terminées et vérifiées.'
    WHEN 'Q-14971-RRG-7446' THEN 'Avant la mise sur le marché, comment avez-vous vérifié que le risque résiduel global du dispositif était acceptable ? Montrez le résultat de cette évaluation.'
    WHEN 'Q-14971-RRG-3515' THEN 'Qui a approuvé l’acceptabilité du risque résiduel global du dispositif ? Montrez les données utilisées et la décision prise.'
    WHEN 'Q-14971-RGR-9160' THEN 'Pour le dernier dispositif libéré, montrez la revue des risques réalisée avant sa libération et la conclusion obtenue.'
    WHEN 'Q-14971-RGR-3091' THEN 'Qui a autorisé la libération du dispositif après la revue des risques ? Montrez les preuves et l''approbation.'
    WHEN 'Q-14971-RIPP-2086' THEN 'Prenez une réclamation, un retour du terrain ou une nouvelle publication. Comment avez-vous vérifié si cette information révélait un nouveau risque ou modifiait un risque connu ?'
    WHEN 'Q-14971-RIPP-4764' THEN 'Montrez-moi un exemple où une information venant du terrain a conduit à modifier le dossier de risques ou le dispositif.'
    WHEN 'Q-14971-APP-5733' THEN 'Prenez une information reçue après la production qui concernait la sécurité. Quelles actions avez-vous prises sur le dossier de risques et sur les dispositifs déjà sur le marché ?'
    WHEN 'Q-14971-APP-7458' THEN 'Montrez-moi un exemple où une information venant du terrain a conduit à une décision sur le dispositif. Qui a décidé et pourquoi ?'
    WHEN 'Q-14971-APP-9033' THEN 'Après une alerte de sécurité venant du terrain, comment avez-vous vérifié que les actions prises étaient efficaces ? Montrez-moi un cas réel.'
    WHEN 'Q-14971-LRU-1486' THEN 'Prenez une erreur d''utilisation possible du dispositif. Comment l''avez-vous identifiée et comment avez-vous réduit le risque associé ?'
    WHEN 'Q-14971-LRU-3545' THEN 'Comment prenez-vous en compte les mauvaises utilisations que vous pouvez raisonnablement prévoir ? Montrez-moi un exemple.'
    WHEN 'Q-14971-LRL-8098' THEN 'Prenez un risque lié au logiciel ou à la sécurité des données. Montrez comment vous l''avez identifié, évalué et réduit.'
    WHEN 'Q-14971-LRL-4167' THEN 'Comment vérifiez-vous que les risques liés au logiciel et à la cybersécurité sont inclus dans votre analyse des risques ? Montrez-moi un exemple.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-14971-MR-4038', 'Q-14971-MR-9272', 'Q-14971-AOM-0896', 'Q-14971-AOM-5470', 'Q-14971-AOM-2955', 'Q-14971-MŒC-8079', 'Q-14971-ABR-2180', 'Q-14971-ABR-5814', 'Q-14971-ABR-6111', 'Q-14971-RIC-1049', 'Q-14971-RIC-7118', 'Q-14971-CM-1778', 'Q-14971-RRG-7446', 'Q-14971-RRG-3515', 'Q-14971-RGR-9160', 'Q-14971-RGR-3091', 'Q-14971-RIPP-2086', 'Q-14971-RIPP-4764', 'Q-14971-APP-5733', 'Q-14971-APP-7458', 'Q-14971-APP-9033', 'Q-14971-LRU-1486', 'Q-14971-LRU-3545', 'Q-14971-LRL-8098', 'Q-14971-LRL-4167');

-- ============================================================
-- RECONSTRUCTION EDITORIALE — ISO9001 (6 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-9001-PI-3467' THEN 'Quelles personnes ou organisations peuvent influencer votre système qualité, et qu''attendent-elles de vous ? Montrez comment vous suivez l''évolution de leurs attentes.'
    WHEN 'Q-9001-RO-2538' THEN 'Prenez un risque ou une opportunité pour votre système qualité. Qu''avez-vous décidé de faire et comment avez-vous vérifié que cela fonctionnait ?'
    WHEN 'Q-9001-RO-9521' THEN 'Comment les actions liées aux risques et aux opportunités sont-elles intégrées au travail quotidien ? Montrez-moi un exemple.'
    WHEN 'Q-9001-CLO-5514' THEN 'Quels changements internes ou externes peuvent affecter votre système qualité ? Montrez comment vous avez déterminé si le changement climatique est un sujet important pour votre activité.'
    WHEN 'Q-9001-PS-7808' THEN 'Quels sites, activités, produits et services sont couverts par votre système qualité ? Montrez comment vous avez justifié ce qui n''est pas couvert.'
    WHEN 'Q-9001-L-0975' THEN 'Comment la direction montre-t-elle qu''elle est responsable du système qualité ? Donnez un exemple de décision prise ou de ressource accordée.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-9001-PI-3467', 'Q-9001-RO-2538', 'Q-9001-RO-9521', 'Q-9001-CLO-5514', 'Q-9001-PS-7808', 'Q-9001-L-0975');

-- Correction réglementaire validée : ISO 9001 §6.1 reste dans le périmètre SMQ
UPDATE questions
SET expectedEvidence = 'Analyse des risques et opportunités du SMQ ; plan d’actions ; responsables et délais ; preuve d’intégration dans les processus ; suivi des résultats et évaluation de l’efficacité.'
WHERE questionKey IN ('Q-9001-RO-2538', 'Q-9001-RO-9521');

-- ============================================================
-- CORRECTIONS REGLEMENTAIRES FINALES — PREUVE CONSOLIDEE
-- ============================================================

-- ISO 14971 §10 : les informations de production et post-production
-- alimentent le dossier de gestion des risques et peuvent déclencher
-- une réévaluation. Aucun lien avec IQ/OQ/PQ ou la validation des procédés.
UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = 'Montrez comment les données de production et de surveillance sont transmises au dossier de gestion des risques. Donnez un exemple où elles ont déclenché une réévaluation.'
WHERE questionKey = 'Q-14971-PPP-1811';

-- FDA CAPA : référence actuelle QMSR + traçabilité de l'ancienne QSR.
-- Depuis le 2 février 2026, 21 CFR 820.10 incorpore ISO 13485:2016 ;
-- 21 CFR 820.100 est indiqué comme ancienne référence, pas comme QMSR actuel.
UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = 'Sous le QMSR actuel — 21 CFR 820.10 incorporant ISO 13485:2016 §8.5.2 et §8.5.3 (anciennement 21 CFR 820.100 sous la QSR) — prenez votre dernière action corrective. Montrez comment vous avez recherché la cause, défini et appliqué l’action, puis vérifié son efficacité.'
WHERE questionKey IN ('Q-FDA-CMC-0807', 'Q-FDA-CMC-1104', 'Q-FDA-CMC-4738');

-- Preuve ciblée des quatre catégories réglementaires validées.
SELECT questionKey, questionText
FROM questions
WHERE questionKey IN (
  'Q-14971-PPP-1811',
  'Q-FDA-CMC-0807', 'Q-FDA-CMC-1104', 'Q-FDA-CMC-4738',
  'Q-9001-RO-2538', 'Q-9001-RO-9521',
  'Q-14971-RRG-7446', 'Q-14971-RRG-3515'
)
ORDER BY questionKey;

-- ============================================================
-- VERIFICATION APRES
-- ============================================================

-- a. Total du corpus (attendu, inchangé : 473)
SELECT COUNT(*) AS total FROM questions;

-- b. Questions encore tronquées (attendu : 0 — fin de la troncature "…" sur
--    tout le scope initial des 216 ; les 11 questions au title tronqué hors
--    scope de cette passe ne sont pas concernées par ce compte, leur
--    questionText n'a jamais été tronqué)
SELECT COUNT(*) AS tronquees_restantes FROM questions WHERE questionText LIKE '%…%';

-- c. questionTextSource peuplée sur 171 + 45 = 216 lignes au total
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- d. Aucun questionKey dupliqué ou perdu (toujours 473 distincts)
SELECT COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;

-- e. Échantillon de contrôle manuel
SELECT questionKey, questionTextSource, questionText
FROM questions
WHERE questionKey IN ('Q-14971-RRG-7446', 'Q-MDR-S-3363', 'Q-9001-RO-2538')
ORDER BY questionKey;
