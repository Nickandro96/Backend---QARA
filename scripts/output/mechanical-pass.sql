-- QARA — Passe mécanique du corpus : script de reconstruction
-- Généré par scripts/mechanical-pass-reconstruct.mjs le 2026-07-31T08:56:18.530Z
-- Total questions reconstruites : 171 (sur 216 tronquées, 45 restent pour la passe éditoriale)
--
-- PROCÉDURE (un bloc à la fois dans l'éditeur Query Railway) :
--   1. Sauvegarde préalable de la table questions (obligatoire, hors de ce fichier).
--   2. Bloc "0. VERIFICATION AVANT" — noter les résultats.
--   3. Bloc "1. MIGRATION ADDITIVE" — ajoute questionTextSource si absente.
--      Si erreur "Duplicate column name" : déjà appliquée, passer au bloc suivant.
--   4. Un bloc UPDATE par référentiel (idempotent : rejouable sans double effet,
--      questionTextSource n'est peuplée qu'une seule fois grâce au CASE/IS NULL).
--   5. Bloc "VERIFICATION APRES" — comparer aux résultats attendus.
--
-- Aucun questionKey n'est modifié. Aucune ligne n'est supprimée ni ajoutée.

-- ============================================================
-- 0. VERIFICATION AVANT (lecture seule)
-- ============================================================

-- 0a. Total du corpus (attendu : 473)
SELECT COUNT(*) AS total FROM questions;

-- 0b. Questions encore tronquées (attendu avant script : 216)
SELECT COUNT(*) AS tronquees FROM questions WHERE questionText LIKE '%…%';

-- 0c. Colonne questionTextSource existe-t-elle déjà ?
SELECT COUNT(*) AS colonne_deja_presente
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'questions' AND column_name = 'questionTextSource';

-- ============================================================
-- 1. MIGRATION ADDITIVE (une seule fois — si "Duplicate column name 'questionTextSource'", c'est déjà fait, passer au bloc 2)
-- ============================================================

ALTER TABLE questions ADD COLUMN questionTextSource TEXT NULL;

-- ============================================================
-- 2. RECONSTRUCTION — MDR (31 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-MDR-MSM-6162' THEN 'Montrez-moi, sur un cas réel récent, comment dispositif mis sur le marché uniquement s’il est conforme au MDR et utilisé conformément à sa destination est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-RP-6887' THEN 'Choisissons un danger réel concerné par couverture responsabilité financière et conservation documentaire adaptée au risque, classe et type de dispositif : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-RP-1538' THEN 'Montrez-moi comment couverture responsabilité financière et conservation documentaire adaptée au risque, classe et type de dispositif relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDR-RP-1835' THEN 'Choisissons un danger réel concerné par couverture responsabilité financière et conservation documentaire adaptée au risque, classe et type de dispositif : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-I-5980' THEN 'Montrez-moi, sur un cas réel récent, comment vérifications importateur avant mise sur le marché et traçabilité des réclamations/non-conformités est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-I-6277' THEN 'Déroulez un cas concret concerné par vérifications importateur avant mise sur le marché et traçabilité des réclamations/non-conformités : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-D-7081' THEN 'Montrez-moi, sur un cas réel récent, comment vérifications distributeur, stockage/transport, réclamations et coopération autorités est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-P-9760' THEN 'Déroulez un cas concret concerné par personne chargée de veiller au respect de la réglementation qualifiée et impliquée dans les libérations et obligations post-market : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-RR-2567' THEN 'Montrez-moi, sur un cas réel récent, comment obligations en cas de reconditionnement, relabelling ou modification susceptible d’affecter la conformité est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-RR-6201' THEN 'Déroulez un cas concret concerné par obligations en cas de reconditionnement, relabelling ou modification susceptible d’affecter la conformité : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-DUC-5437' THEN 'Montrez-moi comment vous garantissez que déclaration UE de conformité établie, tenue à jour et reliée au dossier technique est respectée sur un enregistrement récent.'
    WHEN 'Q-MDR-MC-8407' THEN 'Montrez-moi, sur un cas réel récent, comment marquage CE apposé uniquement après conformité démontrée est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-TCDA-6992' THEN 'Montrez-moi, sur un cas réel récent, comment identification des opérateurs économiques amont/aval dans la chaîne d’approvisionnement est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-U-2683' THEN 'Montrez-moi, sur un cas réel récent, comment système UDI attribué, apposé et maintenu dans les données réglementaires est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-C-8747' THEN 'Montrez-moi, sur un cas réel récent, comment classe de dispositif déterminée selon règles applicables et justifiée est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-CA-6183' THEN 'Montrez-moi, sur un cas réel récent, comment voie d’évaluation de conformité sélectionnée selon classe et type de dispositif est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-CO-8331' THEN 'Montrez-moi, sur un cas réel récent, comment certificats organisme notifié valides, périmètre cohérent et surveillance suivie est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-EC-6441' THEN 'Montrez-moi, sur un cas réel récent, comment évaluation clinique fondée sur données cliniques suffisantes et mise à jour sur cycle de vie est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-EC-1984' THEN 'Déroulez un cas concret concerné par évaluation clinique fondée sur données cliniques suffisantes et mise à jour sur cycle de vie : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-IC-4353' THEN 'Sortez le dernier cas concerné par investigations cliniques planifiées, autorisées, conduites et reportées si nécessaires et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-IC-8284' THEN 'Sortez le dernier cas concerné par investigations cliniques planifiées, autorisées, conduites et reportées si nécessaires et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-P-0494' THEN 'Montrez-moi, sur un cas réel récent, comment rapport périodique actualisé de sécurité produit lorsque applicable est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-VIGF-1884' THEN 'Sortez le dernier cas concerné par déclaration des incidents graves et actions correctives de sécurité terrain dans les délais applicables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-VIGF-0175' THEN 'Sortez le dernier cas concerné par déclaration des incidents graves et actions correctives de sécurité terrain dans les délais applicables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-TR-2051' THEN 'Sortez le dernier cas concerné par analyse et déclaration des tendances significatives d’incidents ou effets indésirables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-TR-8120' THEN 'Sortez le dernier cas concerné par analyse et déclaration des tendances significatives d’incidents ou effets indésirables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-AIF-2845' THEN 'Sortez le dernier cas concerné par investigation, analyse et suivi des incidents graves et FSCA et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-AIF-0786' THEN 'Sortez le dernier cas concerné par investigation, analyse et suivi des incidents graves et FSCA et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-GG-8504' THEN 'Choisissons un danger réel concerné par exigences générales de sécurité et performance démontrées et reliées aux risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-GG-4573' THEN 'Choisissons un danger réel concerné par exigences générales de sécurité et performance démontrées et reliées aux risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-GIU-4931' THEN 'Montrez-moi, sur un cas réel récent, comment étiquetage, notice et information utilisateur conformes, lisibles et validés est appliquée en pratique et où en est la preuve.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-MDR-MSM-6162', 'Q-MDR-RP-6887', 'Q-MDR-RP-1538', 'Q-MDR-RP-1835', 'Q-MDR-I-5980', 'Q-MDR-I-6277', 'Q-MDR-D-7081', 'Q-MDR-P-9760', 'Q-MDR-RR-2567', 'Q-MDR-RR-6201', 'Q-MDR-DUC-5437', 'Q-MDR-MC-8407', 'Q-MDR-TCDA-6992', 'Q-MDR-U-2683', 'Q-MDR-C-8747', 'Q-MDR-CA-6183', 'Q-MDR-CO-8331', 'Q-MDR-EC-6441', 'Q-MDR-EC-1984', 'Q-MDR-IC-4353', 'Q-MDR-IC-8284', 'Q-MDR-P-0494', 'Q-MDR-VIGF-1884', 'Q-MDR-VIGF-0175', 'Q-MDR-TR-2051', 'Q-MDR-TR-8120', 'Q-MDR-AIF-2845', 'Q-MDR-AIF-0786', 'Q-MDR-GG-8504', 'Q-MDR-GG-4573', 'Q-MDR-GIU-4931');

-- ============================================================
-- 2. RECONSTRUCTION — IVDR (19 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-IVDR-DI-8225' THEN 'Montrez-moi, sur un cas réel récent, comment vérifications distributeur, stockage/transport, réclamations et coopération autorités est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-PI-5092' THEN 'Montrez-moi, sur un cas réel récent, comment personne responsable conformité réglementaire qualifiée et impliquée est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-RRI-8516' THEN 'Montrez-moi, sur un cas réel récent, comment reconditionnement/relabeling maîtrisé sans altérer la conformité IVD est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-DUCI-8719' THEN 'Montrez-moi, sur un cas réel récent, comment déclaration UE de conformité IVD établie et tenue à jour est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-CI-4756' THEN 'Montrez-moi, sur un cas réel récent, comment classe A/B/C/D déterminée selon règles IVDR et justifiée est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-CAI-3208' THEN 'Montrez-moi, sur un cas réel récent, comment voie d’évaluation de conformité sélectionnée selon classe IVD est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-IO-6222' THEN 'Montrez-moi, sur un cas réel récent, comment intervention organisme notifié identifiée selon classe et statut est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-PE-8439' THEN 'Montrez-moi, sur un cas réel récent, comment évaluation des performances fondée sur validité scientifique, performance analytique et clinique est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-PE-1858' THEN 'Déroulez un cas concret concerné par évaluation des performances fondée sur validité scientifique, performance analytique et clinique : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-IVDR-EP-8616' THEN 'Sortez le dernier cas concerné par études de performance planifiées, autorisées, conduites, surveillées et reportées et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-VI-2557' THEN 'Sortez le dernier cas concerné par déclaration incidents graves et FSCA IVD dans les délais applicables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-VI-0498' THEN 'Sortez le dernier cas concerné par déclaration incidents graves et FSCA IVD dans les délais applicables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-AIFI-4529' THEN 'Sortez le dernier cas concerné par investigation, analyse causes et actions suite incident/FSCA et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-AIFI-6588' THEN 'Sortez le dernier cas concerné par investigation, analyse causes et actions suite incident/FSCA et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-SMI-2996' THEN 'Montrez-moi, sur un cas réel récent, comment coopération avec autorités et préparation aux actions de surveillance marché est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-GIG-9779' THEN 'Choisissons un danger réel concerné par exigences générales sécurité/performance IVD démontrées et reliées aux risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-IVDR-GIG-5848' THEN 'Choisissons un danger réel concerné par exigences générales sécurité/performance IVD démontrées et reliées aux risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-IVDR-GPCI-0625' THEN 'Ouvrons le dernier dossier de conception concerné par exigences de performance analytique/clinique, stabilité, traçabilité métrologique et fabrication démontrées : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-IVDR-GPCI-4556' THEN 'Ouvrons le dernier dossier de conception concerné par exigences de performance analytique/clinique, stabilité, traçabilité métrologique et fabrication démontrées : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-IVDR-DI-8225', 'Q-IVDR-PI-5092', 'Q-IVDR-RRI-8516', 'Q-IVDR-DUCI-8719', 'Q-IVDR-CI-4756', 'Q-IVDR-CAI-3208', 'Q-IVDR-IO-6222', 'Q-IVDR-PE-8439', 'Q-IVDR-PE-1858', 'Q-IVDR-EP-8616', 'Q-IVDR-VI-2557', 'Q-IVDR-VI-0498', 'Q-IVDR-AIFI-4529', 'Q-IVDR-AIFI-6588', 'Q-IVDR-SMI-2996', 'Q-IVDR-GIG-9779', 'Q-IVDR-GIG-5848', 'Q-IVDR-GPCI-0625', 'Q-IVDR-GPCI-4556');

-- ============================================================
-- 2. RECONSTRUCTION — FDA_QMSR (19 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-FDA-DQ-2580' THEN 'Montrez-moi, sur un cas réel récent, comment définitions réglementaires utilisées pour interpréter les obligations QMSR est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-II1-6737' THEN 'Montrez-moi, sur un cas réel récent, comment incorporation d’ISO 13485 dans le QMSR avec exigences FDA spécifiques est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-SQQ-5999' THEN 'Montrez-moi, sur un cas réel récent, comment mise en place d’un système qualité conforme au QMSR et exigences complémentaires FDA est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-CC-4802' THEN 'Montrez-moi, sur un cas réel récent, comment clarification des concepts FDA tels que organisation, safety/performance et exigences réglementaires est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-CC-5099' THEN 'Déroulez un cas concret concerné par clarification des concepts FDA tels que organisation, safety/performance et exigences réglementaires : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-FDA-DLPC-6078' THEN 'Montrez-moi, sur un cas réel récent, comment contrôles spécifiques étiquetage et conditionnement pour éviter erreurs et mélanges est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-MDR-9221' THEN 'Sortez le dernier cas concerné par détection, évaluation et déclaration des événements à déclaration obligatoire FDA et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-PMR-8072' THEN 'Sortez le dernier cas concerné par procédures écrites de medical device reporting et enregistrements d’évaluation et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-RF-9013' THEN 'Sortez le dernier cas concerné par rapports fabricants sur décès, blessures graves ou dysfonctionnements reportables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-CR-5666' THEN 'Choisissons un danger réel concerné par rapports et enregistrements FDA des corrections et retraits visant un risque santé ou violation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-FDA-CR-7241' THEN 'Montrez-moi comment rapports et enregistrements FDA des corrections et retraits visant un risque santé ou violation relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-FDA-CR-3056' THEN 'Choisissons un danger réel concerné par rapports et enregistrements FDA des corrections et retraits visant un risque santé ou violation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-FDA-RCR-4961' THEN 'Sortez le dernier cas concerné par déclaration FDA des corrections/removals dans les délais applicables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-RL-8745' THEN 'Montrez-moi comment vous garantissez que enregistrement établissement et listing des dispositifs auprès de la FDA est respectée sur un enregistrement récent.'
    WHEN 'Q-FDA-FEI-8396' THEN 'Montrez-moi, sur un cas réel récent, comment obligations établissements étrangers et identification importateurs est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-5K-7377' THEN 'Montrez-moi, sur un cas réel récent, comment décision de nécessité 510(k) et démonstration de substantial equivalence est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-L-4709' THEN 'Montrez-moi, sur un cas réel récent, comment étiquetage dispositif conforme, non trompeur, avec informations obligatoires est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-US-4294' THEN 'Montrez-moi, sur un cas réel récent, comment attribution, changement, maintien et soumission GUDID des identifiants UDI est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-NDI-8530' THEN 'Montrez-moi, sur un cas réel récent, comment évaluation des changements nécessitant un nouveau Device Identifier est appliquée en pratique et où en est la preuve.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-FDA-DQ-2580', 'Q-FDA-II1-6737', 'Q-FDA-SQQ-5999', 'Q-FDA-CC-4802', 'Q-FDA-CC-5099', 'Q-FDA-DLPC-6078', 'Q-FDA-MDR-9221', 'Q-FDA-PMR-8072', 'Q-FDA-RF-9013', 'Q-FDA-CR-5666', 'Q-FDA-CR-7241', 'Q-FDA-CR-3056', 'Q-FDA-RCR-4961', 'Q-FDA-RL-8745', 'Q-FDA-FEI-8396', 'Q-FDA-5K-7377', 'Q-FDA-L-4709', 'Q-FDA-US-4294', 'Q-FDA-NDI-8530');

-- ============================================================
-- 2. RECONSTRUCTION — MDSAP (34 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-MDSAP-M-9936' THEN 'Choisissons un danger réel concerné par politique, objectifs, planification qualité et ressources alignés sur risques et conformité : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-M-4558' THEN 'Montrez-moi comment politique, objectifs, planification qualité et ressources alignés sur risques et conformité relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-M-3867' THEN 'Choisissons un danger réel concerné par politique, objectifs, planification qualité et ressources alignés sur risques et conformité : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-M-8052' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise du périmètre, sites, processus externalisés et exclusions/non-applicabilités est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDSAP-M-9017' THEN 'Choisissons un danger réel concerné par gestion des risques intégrée aux processus MDSAP et exigences juridictionnelles : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-M-1076' THEN 'Choisissons un danger réel concerné par gestion des risques intégrée aux processus MDSAP et exigences juridictionnelles : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-1941' THEN 'Prenez un fournisseur critique : montrez-moi comment collecte et analyse des données qualité issues production, audits, feedback, fournisseurs et surveillance est appliquée, de la sélection à la surveillance des performances.'
    WHEN 'Q-MDSAP-MAI-4126' THEN 'Choisissons un danger réel concerné par traitement des réclamations et investigations proportionnées au risque : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-8057' THEN 'Choisissons un danger réel concerné par traitement des réclamations et investigations proportionnées au risque : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-5068' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise des produits non conformes avant/après distribution est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDSAP-MAI-0861' THEN 'Choisissons un danger réel concerné par audits internes planifiés selon risques, changements et résultats précédents : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-5208' THEN 'Choisissons un danger réel concerné par audits internes planifiés selon risques, changements et résultats précédents : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-7427' THEN 'Montrez-moi, sur un cas réel récent, comment analyse de tendances et escalade des signaux qualité/réglementaires est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDSAP-DD-8592' THEN 'Choisissons un danger réel concerné par planification conception et interfaces entre exigences, risques, vérification et validation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-0167' THEN 'Montrez-moi comment planification conception et interfaces entre exigences, risques, vérification et validation relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-DD-6533' THEN 'Choisissons un danger réel concerné par planification conception et interfaces entre exigences, risques, vérification et validation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-7051' THEN 'Choisissons un danger réel concerné par entrées de conception incluant exigences utilisateur, réglementaires, sécurité/performance et risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-9315' THEN 'Montrez-moi comment entrées de conception incluant exigences utilisateur, réglementaires, sécurité/performance et risques relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-DD-0982' THEN 'Choisissons un danger réel concerné par entrées de conception incluant exigences utilisateur, réglementaires, sécurité/performance et risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-4161' THEN 'Choisissons un danger réel concerné par changements de conception évalués pour impact risque, production, labeling et autorisations marché : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-1089' THEN 'Montrez-moi comment changements de conception évalués pour impact risque, production, labeling et autorisations marché relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-DD-2102' THEN 'Choisissons un danger réel concerné par changements de conception évalués pour impact risque, production, labeling et autorisations marché : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-9660' THEN 'Choisissons un danger réel concerné par dossier de conception démontrant la traçabilité complète entrée-sortie-risque-validation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-1719' THEN 'Choisissons un danger réel concerné par dossier de conception démontrant la traçabilité complète entrée-sortie-risque-validation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-P-3663' THEN 'Montrez-moi, sur un cas réel récent, comment vérification des produits/services achetés selon criticité et historique est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDSAP-DMAF-5720' THEN 'Montrez-moi comment vous garantissez que autorisations de mise sur le marché et enregistrements établissement valides pour AU/BR/CA/JP/US est respectée sur un enregistrement récent.'
    WHEN 'Q-MDSAP-DMAF-6417' THEN 'Montrez-moi, sur un cas réel récent, comment changements produit/site/étiquetage évalués pour impact autorisations et listings est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDSAP-DMAF-1123' THEN 'Montrez-moi comment vous garantissez que dispositifs commercialisés cohérents avec licences, listings, certificats et dossiers techniques est respectée sur un enregistrement récent.'
    WHEN 'Q-MDSAP-MDAE-6758' THEN 'Sortez le dernier cas concerné par détection et décision de reportability selon juridictions AU/BR/CA/JP/US et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-MDAE-1652' THEN 'Sortez le dernier cas concerné par délais de déclaration, contenu des rapports et preuves de soumission et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-MDAE-1373' THEN 'Sortez le dernier cas concerné par advisory notices, FSCA/recalls et communications autorités/clients maîtrisés et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-MDAE-9314' THEN 'Sortez le dernier cas concerné par advisory notices, FSCA/recalls et communications autorités/clients maîtrisés et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-NG-4346' THEN 'Prenez un dossier de lot récent : montrez-moi comment gradation MDSAP 1 à 5 fondée sur impact, récurrence, absence procédure et absence mise en œuvre est appliquée au poste, pas seulement décrite dans une procédure.'
    WHEN 'Q-MDSAP-CSR-8134' THEN 'Montrez-moi, sur un cas réel récent, comment exigences spécifiques TGA, ANVISA, Santé Canada, MHLW/PMDA et FDA intégrées dans l’audit est appliquée en pratique et où en est la preuve.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-MDSAP-M-9936', 'Q-MDSAP-M-4558', 'Q-MDSAP-M-3867', 'Q-MDSAP-M-8052', 'Q-MDSAP-M-9017', 'Q-MDSAP-M-1076', 'Q-MDSAP-MAI-1941', 'Q-MDSAP-MAI-4126', 'Q-MDSAP-MAI-8057', 'Q-MDSAP-MAI-5068', 'Q-MDSAP-MAI-0861', 'Q-MDSAP-MAI-5208', 'Q-MDSAP-MAI-7427', 'Q-MDSAP-DD-8592', 'Q-MDSAP-DD-0167', 'Q-MDSAP-DD-6533', 'Q-MDSAP-DD-7051', 'Q-MDSAP-DD-9315', 'Q-MDSAP-DD-0982', 'Q-MDSAP-DD-4161', 'Q-MDSAP-DD-1089', 'Q-MDSAP-DD-2102', 'Q-MDSAP-DD-9660', 'Q-MDSAP-DD-1719', 'Q-MDSAP-P-3663', 'Q-MDSAP-DMAF-5720', 'Q-MDSAP-DMAF-6417', 'Q-MDSAP-DMAF-1123', 'Q-MDSAP-MDAE-6758', 'Q-MDSAP-MDAE-1652', 'Q-MDSAP-MDAE-1373', 'Q-MDSAP-MDAE-9314', 'Q-MDSAP-NG-4346', 'Q-MDSAP-CSR-8134');

-- ============================================================
-- 2. RECONSTRUCTION — ISO13485 (33 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-13485-PE-8433' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise des processus externalisés influençant la conformité des dispositifs est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-DS-8148' THEN 'Prenez un dossier de lot récent : montrez-moi comment structure documentaire incluant politique, objectifs, manuel qualité, procédures et enregistrements requis est appliquée au poste, pas seulement décrite dans une procédure.'
    WHEN 'Q-13485-MQ-2988' THEN 'Montrez-moi, sur un cas réel récent, comment manuel qualité décrivant le périmètre, les exclusions justifiées et les interactions de processus est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-ED-7461' THEN 'Montrez-moi, sur un cas réel récent, comment engagement de la direction envers le SMQ et les exigences réglementaires est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-PQD-3861' THEN 'Montrez-moi, sur un cas réel récent, comment politique qualité adaptée aux dispositifs médicaux et aux exigences réglementaires est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-OQD-4733' THEN 'Montrez-moi, sur un cas réel récent, comment objectifs qualité mesurables déployés aux fonctions et niveaux pertinents est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-PS-8314' THEN 'Montrez-moi, sur un cas réel récent, comment planification du SMQ préservant son intégrité lors des changements est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-RD-4767' THEN 'Sortez le dernier cas concerné par représentant de la direction garantissant le reporting et la promotion des exigences et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-13485-RD-6139' THEN 'Choisissons un danger réel concerné par revue de direction incluant entrées réglementaires, feedback, audits, fournisseurs, risques et actions : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-RD-4564' THEN 'Montrez-moi comment revue de direction incluant entrées réglementaires, feedback, audits, fournisseurs, risques et actions relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-13485-RD-8627' THEN 'Choisissons un danger réel concerné par revue de direction incluant entrées réglementaires, feedback, audits, fournisseurs, risques et actions : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-RH-8042' THEN 'Montrez-moi, sur un cas réel récent, comment compétence, formation, sensibilisation et traçabilité du personnel est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-I-8964' THEN 'Montrez-moi, sur un cas réel récent, comment infrastructures nécessaires pour prévenir la non-conformité du produit est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-ET-4587' THEN 'Montrez-moi, sur un cas réel récent, comment conditions d’environnement de travail et maîtrise de la contamination est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-RP-6946' THEN 'Choisissons un danger réel concerné par planification de la réalisation produit incluant exigences qualité, risques, vérifications et enregistrements : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-RP-1479' THEN 'Montrez-moi comment planification de la réalisation produit incluant exigences qualité, risques, vérifications et enregistrements relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-13485-RP-5113' THEN 'Choisissons un danger réel concerné par planification de la réalisation produit incluant exigences qualité, risques, vérifications et enregistrements : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-EP-6396' THEN 'Montrez-moi, sur un cas réel récent, comment détermination des exigences client, réglementaires, d’usage et de livraison est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-CC-8673' THEN 'Montrez-moi, sur un cas réel récent, comment communication client incluant informations produit, contrats, feedback et réclamations est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-EC-3453' THEN 'Ouvrons le dernier dossier de conception concerné par entrées conception complètes, vérifiables, incluant exigences fonctionnelles, performance, sécurité, réglementation : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-13485-SC-8394' THEN 'Ouvrons le dernier dossier de conception concerné par sorties conception approuvées permettant vérification et fournissant critères d’acceptation : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-13485-IDA-1734' THEN 'Prenez un fournisseur critique : montrez-moi comment exigences d’achat documentées, incluant critères produit, procédures, qualification et QMS fournisseur est appliquée, de la sélection à la surveillance des performances.'
    WHEN 'Q-13485-PP-4306' THEN 'Montrez-moi, sur un cas réel récent, comment exigences de propreté produit et maîtrise de contamination est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-I-7207' THEN 'Montrez-moi, sur un cas réel récent, comment activités d’installation maîtrisées et vérifiées si applicables est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-DS-9110' THEN 'Montrez-moi, sur un cas réel récent, comment exigences spécifiques aux dispositifs stériles et barrières stériles est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-T-3038' THEN 'Montrez-moi, sur un cas réel récent, comment traçabilité produit, lots, composants et exigences réglementaires applicables est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-PP-6329' THEN 'Montrez-moi, sur un cas réel récent, comment préservation de la conformité durant traitement, stockage, manutention et livraison est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-EM-7954' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise, étalonnage et vérification des équipements de mesure est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-R-4859' THEN 'Montrez-moi comment vous garantissez que traitement des réclamations avec investigation, justification et enregistrements est respectée sur un enregistrement récent.'
    WHEN 'Q-13485-SA-0926' THEN 'Sortez le dernier cas concerné par reporting réglementaire des événements et avis consultatifs selon exigences applicables et reconstituons la chronologie : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-13485-AI-1246' THEN 'Montrez-moi, sur un cas réel récent, comment audits internes planifiés et réalisés sur l’ensemble du SMQ est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-SP-1903' THEN 'Montrez-moi, sur un cas réel récent, comment surveillance et mesure du produit aux étapes appropriées est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-PNC-8140' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise du produit non conforme avant et après livraison est appliquée en pratique et où en est la preuve.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-13485-PE-8433', 'Q-13485-DS-8148', 'Q-13485-MQ-2988', 'Q-13485-ED-7461', 'Q-13485-PQD-3861', 'Q-13485-OQD-4733', 'Q-13485-PS-8314', 'Q-13485-RD-4767', 'Q-13485-RD-6139', 'Q-13485-RD-4564', 'Q-13485-RD-8627', 'Q-13485-RH-8042', 'Q-13485-I-8964', 'Q-13485-ET-4587', 'Q-13485-RP-6946', 'Q-13485-RP-1479', 'Q-13485-RP-5113', 'Q-13485-EP-6396', 'Q-13485-CC-8673', 'Q-13485-EC-3453', 'Q-13485-SC-8394', 'Q-13485-IDA-1734', 'Q-13485-PP-4306', 'Q-13485-I-7207', 'Q-13485-DS-9110', 'Q-13485-T-3038', 'Q-13485-PP-6329', 'Q-13485-EM-7954', 'Q-13485-R-4859', 'Q-13485-SA-0926', 'Q-13485-AI-1246', 'Q-13485-SP-1903', 'Q-13485-PNC-8140');

-- ============================================================
-- 2. RECONSTRUCTION — ISO14971 (20 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-14971-PGR-8687' THEN 'Choisissons un danger réel concerné par processus de gestion des risques couvrant toutes les phases du cycle de vie du dispositif : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-PGR-3372' THEN 'Choisissons un danger réel concerné par processus de gestion des risques couvrant toutes les phases du cycle de vie du dispositif : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-RDR-4511' THEN 'Choisissons un danger réel concerné par responsabilités, ressources et revue de direction pour la gestion des risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-RDR-1036' THEN 'Choisissons un danger réel concerné par responsabilités, ressources et revue de direction pour la gestion des risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-CR-6258' THEN 'Choisissons un danger réel concerné par compétence du personnel réalisant les activités de gestion des risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-CR-2327' THEN 'Choisissons un danger réel concerné par compétence du personnel réalisant les activités de gestion des risques : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-PGR-1943' THEN 'Choisissons un danger réel concerné par plan de gestion des risques définissant périmètre, responsabilités, critères d’acceptabilité et activités : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-PGR-1248' THEN 'Montrez-moi comment plan de gestion des risques définissant périmètre, responsabilités, critères d’acceptabilité et activités relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-PGR-4002' THEN 'Choisissons un danger réel concerné par plan de gestion des risques définissant périmètre, responsabilités, critères d’acceptabilité et activités : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-DGR-2987' THEN 'Choisissons un danger réel concerné par dossier de gestion des risques traçable vers analyses, évaluations, contrôles et revues : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-DGR-9056' THEN 'Choisissons un danger réel concerné par dossier de gestion des risques traçable vers analyses, évaluations, contrôles et revues : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-AR-6051' THEN 'Choisissons un danger réel concerné par analyse des risques sur le dispositif médical selon le plan approuvé : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-AR-2120' THEN 'Choisissons un danger réel concerné par analyse des risques sur le dispositif médical selon le plan approuvé : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-UP-2664' THEN 'Montrez-moi, sur un cas réel récent, comment définition de l’usage prévu et du mauvais usage raisonnablement prévisible est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-14971-CS-9495' THEN 'Montrez-moi, sur un cas réel récent, comment identification des caractéristiques liées à la sécurité du dispositif est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-14971-DSD-1644' THEN 'Montrez-moi, sur un cas réel récent, comment identification des dangers, situations dangereuses et séquences d’événements est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-14971-ER-1264' THEN 'Choisissons un danger réel concerné par estimation des risques pour chaque situation dangereuse identifiée : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-ER-1630' THEN 'Choisissons un danger réel concerné par estimation des risques pour chaque situation dangereuse identifiée : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-ER-8113' THEN 'Choisissons un danger réel concerné par comparaison des risques estimés aux critères d’acceptabilité définis : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-ER-0172' THEN 'Choisissons un danger réel concerné par comparaison des risques estimés aux critères d’acceptabilité définis : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-14971-PGR-8687', 'Q-14971-PGR-3372', 'Q-14971-RDR-4511', 'Q-14971-RDR-1036', 'Q-14971-CR-6258', 'Q-14971-CR-2327', 'Q-14971-PGR-1943', 'Q-14971-PGR-1248', 'Q-14971-PGR-4002', 'Q-14971-DGR-2987', 'Q-14971-DGR-9056', 'Q-14971-AR-6051', 'Q-14971-AR-2120', 'Q-14971-UP-2664', 'Q-14971-CS-9495', 'Q-14971-DSD-1644', 'Q-14971-ER-1264', 'Q-14971-ER-1630', 'Q-14971-ER-8113', 'Q-14971-ER-0172');

-- ============================================================
-- 2. RECONSTRUCTION — ISO9001 (15 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-9001-PQ-9483' THEN 'Montrez-moi, sur un cas réel récent, comment politique qualité pertinente, communiquée et tenue à jour est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-RR-3394' THEN 'Montrez-moi, sur un cas réel récent, comment responsabilités et autorités qualité attribuées et comprises est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-OQ-8052' THEN 'Montrez-moi, sur un cas réel récent, comment objectifs mesurables, suivis et cohérents avec la politique qualité est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-CS-0673' THEN 'Montrez-moi, sur un cas réel récent, comment planification maîtrisée des changements du système qualité est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-P-9514' THEN 'Montrez-moi, sur un cas réel récent, comment ressources humaines adaptées aux activités qualité et opérationnelles est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-I-7802' THEN 'Montrez-moi, sur un cas réel récent, comment infrastructures nécessaires pour réaliser les produits et services conformes est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-EO-6948' THEN 'Montrez-moi, sur un cas réel récent, comment conditions environnementales et psychosociales adaptées aux opérations est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-S-1248' THEN 'Montrez-moi, sur un cas réel récent, comment personnel conscient de la politique, des objectifs et des impacts qualité est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-C-9950' THEN 'Montrez-moi, sur un cas réel récent, comment communications internes et externes pertinentes planifiées est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-PO-1121' THEN 'Montrez-moi, sur un cas réel récent, comment planification et maîtrise opérationnelle des produits et services est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-EC-4284' THEN 'Montrez-moi, sur un cas réel récent, comment revue et maîtrise des exigences relatives aux produits et services est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-L-9332' THEN 'Montrez-moi, sur un cas réel récent, comment libération des produits et services après vérification des critères est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-SM-5761' THEN 'Montrez-moi, sur un cas réel récent, comment détermination, analyse et évaluation des performances du SMQ est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-9001-AI-9052' THEN 'Choisissons un danger réel concerné par programme d’audit interne planifié selon les risques et résultats : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-9001-AI-5121' THEN 'Choisissons un danger réel concerné par programme d’audit interne planifié selon les risques et résultats : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-9001-PQ-9483', 'Q-9001-RR-3394', 'Q-9001-OQ-8052', 'Q-9001-CS-0673', 'Q-9001-P-9514', 'Q-9001-I-7802', 'Q-9001-EO-6948', 'Q-9001-S-1248', 'Q-9001-C-9950', 'Q-9001-PO-1121', 'Q-9001-EC-4284', 'Q-9001-L-9332', 'Q-9001-SM-5761', 'Q-9001-AI-9052', 'Q-9001-AI-5121');

-- ============================================================
-- 3. VERIFICATION APRES
-- ============================================================

-- 3a. Total du corpus (attendu, inchangé : 473)
SELECT COUNT(*) AS total FROM questions;

-- 3b. Questions encore tronquées (attendu après script : 45, la passe éditoriale)
SELECT COUNT(*) AS tronquees_restantes FROM questions WHERE questionText LIKE '%…%';

-- 3c. questionTextSource peuplée sur exactement 171 lignes
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- 3d. Aucun questionKey dupliqué ou modifié (le compte de clés distinctes doit rester 473)
SELECT COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;

-- 3e. Échantillon de contrôle manuel (à comparer visuellement à VALIDATION-passe-mecanique.md section D)
SELECT questionKey, questionTextSource, questionText
FROM questions
WHERE questionKey IN ('Q-14971-PGR-8687', 'Q-MDR-MC-8407', 'Q-9001-EO-6948')
ORDER BY questionKey;
