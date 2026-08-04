-- ATTENTION — NE PAS EXECUTER EN PRODUCTION EN L'ETAT.
-- Ce fichier mélange un backfill technique avec 45 reformulations et 24 titres
-- qui ne disposent pas d'une validation réglementaire globale explicite.
-- QARA — Script préparatoire consolidé : questionTextSource (171) + passe éditoriale (45) + titres tronqués (24)
-- Généré par scripts/final-pass-apply.mjs le 2026-08-04T09:09:19.535Z
--
-- CONTEXTE IMPORTANT : la passe mécanique (171 questions) a été mergée dans
-- qitbxl. Le script "release" de Railway (package.json) exécute migrations +
-- import-corpus.mjs à CHAQUE déploiement — ce dernier réimporte questionText
-- depuis scripts/questions_import_ready.json (upsert par questionKey) mais ne
-- touche JAMAIS questionTextSource. Résultat probable : questionText est
-- déjà correct pour ces 171 lignes (d'où "45/473 restantes" observé), MAIS
-- questionTextSource est probablement encore NULL pour elles — la
-- traçabilité voulue par la migration 0030 n'a jamais été vraiment peuplée.
-- Le bloc 2 ci-dessous corrige ça. Les vérifications ne présument pas du
-- chiffre exact avant correction — elles le rapportent, à comparer au
-- commentaire de chaque requête.
--
-- PROCÉDURE (un bloc à la fois dans l'éditeur Query Railway) :
--   1. Sauvegarde préalable de la table questions (obligatoire, hors de ce fichier).
--   2. Bloc "0. VERIFICATION AVANT" — noter les résultats réels.
--   3. Bloc "1. MIGRATION ADDITIVE" (idempotent, "Duplicate column name" = déjà fait).
--   4. Bloc "2. BACKFILL questionTextSource POUR LES 171".
--   5. Les 6 blocs "3. PASSE EDITORIALE" (un par référentiel).
--   6. Le bloc "4. CORRECTION DES 24 TITRES TRONQUES".
--   7. Bloc "VERIFICATION APRES".
--
-- Aucun questionKey modifié. Aucune ligne supprimée ni ajoutée. Aucune
-- exigence réglementaire inventée.

-- ============================================================
-- 0. VERIFICATION AVANT (lecture seule)
-- ============================================================

-- 0a. Total du corpus (attendu : 473)
SELECT COUNT(*) AS total FROM questions;

-- 0b. Questions encore tronquées dans questionText (attendu : 45 si le
--     réimport automatique a déjà appliqué la passe mécanique ; 216 sinon —
--     dans ce dernier cas, s'arrêter et vérifier pourquoi avant de continuer)
SELECT COUNT(*) AS tronquees FROM questions WHERE questionText LIKE '%…%';

-- 0c. questionTextSource actuellement peuplée (chiffre à noter, pas à
--     présumer — voir le contexte ci-dessus)
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- 0d. Titres encore tronqués à 250 caractères exactement (attendu : 24)
SELECT COUNT(*) AS titres_tronques FROM questions WHERE LENGTH(title) = 250;

-- ============================================================
-- 1. MIGRATION ADDITIVE (idempotente — si "Duplicate column name", déjà faite)
-- ============================================================

ALTER TABLE questions ADD COLUMN questionTextSource TEXT NULL;

-- ============================================================
-- 2. BACKFILL questionTextSource POUR LES 171 QUESTIONS DE LA PASSE MECANIQUE
--    (questionText n'est PAS modifié ici, seulement questionTextSource si NULL)
-- ============================================================

UPDATE questions
SET questionTextSource = CASE questionKey
    WHEN 'Q-13485-AI-1246' THEN 'Montrez-moi, sur un cas réel récent, comment audits internes planifiés et réalisés sur l’ensemble du SMQ est… est la preuve.'
    WHEN 'Q-13485-CC-8673' THEN 'Montrez-moi, sur un cas réel récent, comment communication client incluant informations produit, contrats,… est la preuve.'
    WHEN 'Q-13485-DS-8148' THEN 'Prenez un dossier de lot récent : montrez-moi comment structure documentaire incluant politique, objectifs, manuel qualité,… est appliquée au poste, pas seulement décrite dans une procédure.'
    WHEN 'Q-13485-DS-9110' THEN 'Montrez-moi, sur un cas réel récent, comment exigences spécifiques aux dispositifs stériles et barrières stériles… est la preuve.'
    WHEN 'Q-13485-EC-3453' THEN 'Ouvrons le dernier dossier de conception concerné par entrées conception complètes, vérifiables, incluant exigences… : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-13485-ED-7461' THEN 'Montrez-moi, sur un cas réel récent, comment engagement de la direction envers le SMQ et les exigences… est la preuve.'
    WHEN 'Q-13485-EM-7954' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise, étalonnage et vérification des équipements de mesure est… est la preuve.'
    WHEN 'Q-13485-EP-6396' THEN 'Montrez-moi, sur un cas réel récent, comment détermination des exigences client, réglementaires, d’usage et de… est la preuve.'
    WHEN 'Q-13485-ET-4587' THEN 'Montrez-moi, sur un cas réel récent, comment conditions d’environnement de travail et maîtrise de la contamination… est la preuve.'
    WHEN 'Q-13485-I-7207' THEN 'Montrez-moi, sur un cas réel récent, comment activités d’installation maîtrisées et vérifiées si applicables est… est la preuve.'
    WHEN 'Q-13485-I-8964' THEN 'Montrez-moi, sur un cas réel récent, comment infrastructures nécessaires pour prévenir la non-conformité du… est la preuve.'
    WHEN 'Q-13485-IDA-1734' THEN 'Prenez un fournisseur critique : montrez-moi comment exigences d’achat documentées, incluant critères produit, procédures,… est appliquée, de la sélection à la surveillance des performances.'
    WHEN 'Q-13485-MQ-2988' THEN 'Montrez-moi, sur un cas réel récent, comment manuel qualité décrivant le périmètre, les exclusions justifiées et… est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-13485-OQD-4733' THEN 'Montrez-moi, sur un cas réel récent, comment objectifs qualité mesurables déployés aux fonctions et niveaux… est la preuve.'
    WHEN 'Q-13485-PE-8433' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise des processus externalisés influençant la conformité des… est la preuve.'
    WHEN 'Q-13485-PNC-8140' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise du produit non conforme avant et après livraison est… est la preuve.'
    WHEN 'Q-13485-PP-4306' THEN 'Montrez-moi, sur un cas réel récent, comment exigences de propreté produit et maîtrise de contamination est… est la preuve.'
    WHEN 'Q-13485-PP-6329' THEN 'Montrez-moi, sur un cas réel récent, comment préservation de la conformité durant traitement, stockage,… est la preuve.'
    WHEN 'Q-13485-PQD-3861' THEN 'Montrez-moi, sur un cas réel récent, comment politique qualité adaptée aux dispositifs médicaux et aux exigences… est la preuve.'
    WHEN 'Q-13485-PS-8314' THEN 'Montrez-moi, sur un cas réel récent, comment planification du SMQ préservant son intégrité lors des changements… est la preuve.'
    WHEN 'Q-13485-R-4859' THEN 'Montrez-moi comment vous garantissez que traitement des réclamations avec investigation,… est respectée sur un enregistrement récent.'
    WHEN 'Q-13485-RD-4564' THEN 'Montrez-moi comment revue de direction incluant entrées réglementaires, feedback, audits,… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-13485-RD-4767' THEN 'Sortez le dernier cas concerné par représentant de la direction garantissant le reporting et la… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-13485-RD-6139' THEN 'Choisissons un danger réel concerné par revue de direction incluant entrées réglementaires, feedback, audits,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-RD-8627' THEN 'Choisissons un danger réel concerné par revue de direction incluant entrées réglementaires, feedback, audits,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-RH-8042' THEN 'Montrez-moi, sur un cas réel récent, comment compétence, formation, sensibilisation et traçabilité du personnel… est la preuve.'
    WHEN 'Q-13485-RP-1479' THEN 'Montrez-moi comment planification de la réalisation produit incluant exigences qualité,… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-13485-RP-5113' THEN 'Choisissons un danger réel concerné par planification de la réalisation produit incluant exigences qualité,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-RP-6946' THEN 'Choisissons un danger réel concerné par planification de la réalisation produit incluant exigences qualité,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-13485-SA-0926' THEN 'Sortez le dernier cas concerné par reporting réglementaire des événements et avis consultatifs selon… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-13485-SC-8394' THEN 'Ouvrons le dernier dossier de conception concerné par sorties conception approuvées permettant vérification et fournissant… : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-13485-SP-1903' THEN 'Montrez-moi, sur un cas réel récent, comment surveillance et mesure du produit aux étapes appropriées est… est la preuve.'
    WHEN 'Q-13485-T-3038' THEN 'Montrez-moi, sur un cas réel récent, comment traçabilité produit, lots, composants et exigences réglementaires… est la preuve.'
    WHEN 'Q-14971-AR-2120' THEN 'Choisissons un danger réel concerné par analyse des risques sur le dispositif médical selon le plan approuvé… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-AR-6051' THEN 'Choisissons un danger réel concerné par analyse des risques sur le dispositif médical selon le plan approuvé… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-CR-2327' THEN 'Choisissons un danger réel concerné par compétence du personnel réalisant les activités de gestion des… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-CR-6258' THEN 'Choisissons un danger réel concerné par compétence du personnel réalisant les activités de gestion des… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-CS-9495' THEN 'Montrez-moi, sur un cas réel récent, comment identification des caractéristiques liées à la sécurité du dispositif… est la preuve.'
    WHEN 'Q-14971-DGR-2987' THEN 'Choisissons un danger réel concerné par dossier de gestion des risques traçable vers analyses, évaluations,… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-DGR-9056' THEN 'Choisissons un danger réel concerné par dossier de gestion des risques traçable vers analyses, évaluations,… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-DSD-1644' THEN 'Montrez-moi, sur un cas réel récent, comment identification des dangers, situations dangereuses et séquences… est la preuve.'
    WHEN 'Q-14971-ER-0172' THEN 'Choisissons un danger réel concerné par comparaison des risques estimés aux critères d’acceptabilité définis… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-ER-1264' THEN 'Choisissons un danger réel concerné par estimation des risques pour chaque situation dangereuse identifiée :… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-ER-1630' THEN 'Choisissons un danger réel concerné par estimation des risques pour chaque situation dangereuse identifiée :… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-ER-8113' THEN 'Choisissons un danger réel concerné par comparaison des risques estimés aux critères d’acceptabilité définis… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-PGR-1248' THEN 'Montrez-moi comment plan de gestion des risques définissant périmètre, responsabilités,… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-PGR-1943' THEN 'Choisissons un danger réel concerné par plan de gestion des risques définissant périmètre, responsabilités,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-PGR-3372' THEN 'Choisissons un danger réel concerné par processus de gestion des risques couvrant toutes les phases du cycle… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-PGR-4002' THEN 'Choisissons un danger réel concerné par plan de gestion des risques définissant périmètre, responsabilités,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-PGR-8687' THEN 'Choisissons un danger réel concerné par processus de gestion des risques couvrant toutes les phases du cycle… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-RDR-1036' THEN 'Choisissons un danger réel concerné par responsabilités, ressources et revue de direction pour la gestion des… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-RDR-4511' THEN 'Choisissons un danger réel concerné par responsabilités, ressources et revue de direction pour la gestion des… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-UP-2664' THEN 'Montrez-moi, sur un cas réel récent, comment définition de l’usage prévu et du mauvais usage raisonnablement… est la preuve.'
    WHEN 'Q-9001-AI-5121' THEN 'Choisissons un danger réel concerné par programme d’audit interne planifié selon les risques et résultats :… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-9001-AI-9052' THEN 'Choisissons un danger réel concerné par programme d’audit interne planifié selon les risques et résultats :… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-9001-C-9950' THEN 'Montrez-moi, sur un cas réel récent, comment communications internes et externes pertinentes planifiées est… est la preuve.'
    WHEN 'Q-9001-CS-0673' THEN 'Montrez-moi, sur un cas réel récent, comment planification maîtrisée des changements du système qualité est… est la preuve.'
    WHEN 'Q-9001-EC-4284' THEN 'Montrez-moi, sur un cas réel récent, comment revue et maîtrise des exigences relatives aux produits et services… est la preuve.'
    WHEN 'Q-9001-EO-6948' THEN 'Montrez-moi, sur un cas réel récent, comment conditions environnementales et psychosociales adaptées aux… est la preuve.'
    WHEN 'Q-9001-I-7802' THEN 'Montrez-moi, sur un cas réel récent, comment infrastructures nécessaires pour réaliser les produits et services… est la preuve.'
    WHEN 'Q-9001-L-9332' THEN 'Montrez-moi, sur un cas réel récent, comment libération des produits et services après vérification des critères… est la preuve.'
    WHEN 'Q-9001-OQ-8052' THEN 'Montrez-moi, sur un cas réel récent, comment objectifs mesurables, suivis et cohérents avec la politique qualité… est la preuve.'
    WHEN 'Q-9001-P-9514' THEN 'Montrez-moi, sur un cas réel récent, comment ressources humaines adaptées aux activités qualité et opérationnelles… est la preuve.'
    WHEN 'Q-9001-PO-1121' THEN 'Montrez-moi, sur un cas réel récent, comment planification et maîtrise opérationnelle des produits et services est… est la preuve.'
    WHEN 'Q-9001-PQ-9483' THEN 'Montrez-moi, sur un cas réel récent, comment politique qualité pertinente, communiquée et tenue à jour est… est la preuve.'
    WHEN 'Q-9001-RR-3394' THEN 'Montrez-moi, sur un cas réel récent, comment responsabilités et autorités qualité attribuées et comprises est… est la preuve.'
    WHEN 'Q-9001-S-1248' THEN 'Montrez-moi, sur un cas réel récent, comment personnel conscient de la politique, des objectifs et des impacts… est la preuve.'
    WHEN 'Q-9001-SM-5761' THEN 'Montrez-moi, sur un cas réel récent, comment détermination, analyse et évaluation des performances du SMQ est… est la preuve.'
    WHEN 'Q-FDA-5K-7377' THEN 'Montrez-moi, sur un cas réel récent, comment décision de nécessité 510(k) et démonstration de substantial… est la preuve.'
    WHEN 'Q-FDA-CC-4802' THEN 'Montrez-moi, sur un cas réel récent, comment clarification des concepts FDA tels que organisation,… est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-FDA-CC-5099' THEN 'Déroulez un cas concret concerné par clarification des concepts FDA tels que organisation,… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-FDA-CR-3056' THEN 'Choisissons un danger réel concerné par rapports et enregistrements FDA des corrections et retraits visant un… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-FDA-CR-5666' THEN 'Choisissons un danger réel concerné par rapports et enregistrements FDA des corrections et retraits visant un… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-FDA-CR-7241' THEN 'Montrez-moi comment rapports et enregistrements FDA des corrections et retraits visant un… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-FDA-DLPC-6078' THEN 'Montrez-moi, sur un cas réel récent, comment contrôles spécifiques étiquetage et conditionnement pour éviter… est la preuve.'
    WHEN 'Q-FDA-DQ-2580' THEN 'Montrez-moi, sur un cas réel récent, comment définitions réglementaires utilisées pour interpréter les obligations… est la preuve.'
    WHEN 'Q-FDA-FEI-8396' THEN 'Montrez-moi, sur un cas réel récent, comment obligations établissements étrangers et identification importateurs… est la preuve.'
    WHEN 'Q-FDA-II1-6737' THEN 'Montrez-moi, sur un cas réel récent, comment incorporation d’ISO 13485 dans le QMSR avec exigences FDA spécifiques… est la preuve.'
    WHEN 'Q-FDA-L-4709' THEN 'Montrez-moi, sur un cas réel récent, comment étiquetage dispositif conforme, non trompeur, avec informations… est la preuve.'
    WHEN 'Q-FDA-MDR-9221' THEN 'Sortez le dernier cas concerné par détection, évaluation et déclaration des événements à déclaration… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-NDI-8530' THEN 'Montrez-moi, sur un cas réel récent, comment évaluation des changements nécessitant un nouveau Device Identifier… est la preuve.'
    WHEN 'Q-FDA-PMR-8072' THEN 'Sortez le dernier cas concerné par procédures écrites de medical device reporting et enregistrements… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-RCR-4961' THEN 'Sortez le dernier cas concerné par déclaration FDA des corrections/removals dans les délais applicables… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-RF-9013' THEN 'Sortez le dernier cas concerné par rapports fabricants sur décès, blessures graves ou dysfonctionnements… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-FDA-RL-8745' THEN 'Montrez-moi comment vous garantissez que enregistrement établissement et listing des… est respectée sur un enregistrement récent.'
    WHEN 'Q-FDA-SQQ-5999' THEN 'Montrez-moi, sur un cas réel récent, comment mise en place d’un système qualité conforme au QMSR et exigences… est la preuve.'
    WHEN 'Q-FDA-US-4294' THEN 'Montrez-moi, sur un cas réel récent, comment attribution, changement, maintien et soumission GUDID des… est la preuve.'
    WHEN 'Q-IVDR-AIFI-4529' THEN 'Sortez le dernier cas concerné par investigation, analyse causes et actions suite incident/FSCA et… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-AIFI-6588' THEN 'Sortez le dernier cas concerné par investigation, analyse causes et actions suite incident/FSCA et… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-CAI-3208' THEN 'Montrez-moi, sur un cas réel récent, comment voie d’évaluation de conformité sélectionnée selon classe IVD est… est la preuve.'
    WHEN 'Q-IVDR-CI-4756' THEN 'Montrez-moi, sur un cas réel récent, comment classe A/B/C/D déterminée selon règles IVDR et justifiée est… est la preuve.'
    WHEN 'Q-IVDR-DI-8225' THEN 'Montrez-moi, sur un cas réel récent, comment vérifications distributeur, stockage/transport, réclamations et… est la preuve.'
    WHEN 'Q-IVDR-DUCI-8719' THEN 'Montrez-moi, sur un cas réel récent, comment déclaration UE de conformité IVD établie et tenue à jour est… est la preuve.'
    WHEN 'Q-IVDR-EP-8616' THEN 'Sortez le dernier cas concerné par études de performance planifiées, autorisées, conduites, surveillées… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-GIG-5848' THEN 'Choisissons un danger réel concerné par exigences générales sécurité/performance IVD démontrées et reliées… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-IVDR-GIG-9779' THEN 'Choisissons un danger réel concerné par exigences générales sécurité/performance IVD démontrées et reliées… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-IVDR-GPCI-0625' THEN 'Ouvrons le dernier dossier de conception concerné par exigences de performance analytique/clinique, stabilité, traçabilité… : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-IVDR-GPCI-4556' THEN 'Ouvrons le dernier dossier de conception concerné par exigences de performance analytique/clinique, stabilité, traçabilité… : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-IVDR-IO-6222' THEN 'Montrez-moi, sur un cas réel récent, comment intervention organisme notifié identifiée selon classe et statut est… est la preuve.'
    WHEN 'Q-IVDR-PE-1858' THEN 'Déroulez un cas concret concerné par évaluation des performances fondée sur validité scientifique,… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-IVDR-PE-8439' THEN 'Montrez-moi, sur un cas réel récent, comment évaluation des performances fondée sur validité scientifique,… est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-IVDR-PI-5092' THEN 'Montrez-moi, sur un cas réel récent, comment personne responsable conformité réglementaire qualifiée et impliquée… est la preuve.'
    WHEN 'Q-IVDR-RRI-8516' THEN 'Montrez-moi, sur un cas réel récent, comment reconditionnement/relabeling maîtrisé sans altérer la conformité IVD… est la preuve.'
    WHEN 'Q-IVDR-SMI-2996' THEN 'Montrez-moi, sur un cas réel récent, comment coopération avec autorités et préparation aux actions de surveillance… est la preuve.'
    WHEN 'Q-IVDR-VI-0498' THEN 'Sortez le dernier cas concerné par déclaration incidents graves et FSCA IVD dans les délais applicables… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-IVDR-VI-2557' THEN 'Sortez le dernier cas concerné par déclaration incidents graves et FSCA IVD dans les délais applicables… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-AIF-0786' THEN 'Sortez le dernier cas concerné par investigation, analyse et suivi des incidents graves et FSCA et… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-AIF-2845' THEN 'Sortez le dernier cas concerné par investigation, analyse et suivi des incidents graves et FSCA et… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-C-8747' THEN 'Montrez-moi, sur un cas réel récent, comment classe de dispositif déterminée selon règles applicables et justifiée… est la preuve.'
    WHEN 'Q-MDR-CA-6183' THEN 'Montrez-moi, sur un cas réel récent, comment voie d’évaluation de conformité sélectionnée selon classe et type de… est la preuve.'
    WHEN 'Q-MDR-CO-8331' THEN 'Montrez-moi, sur un cas réel récent, comment certificats organisme notifié valides, périmètre cohérent et… est la preuve.'
    WHEN 'Q-MDR-D-7081' THEN 'Montrez-moi, sur un cas réel récent, comment vérifications distributeur, stockage/transport, réclamations et… est la preuve.'
    WHEN 'Q-MDR-DUC-5437' THEN 'Montrez-moi comment vous garantissez que déclaration UE de conformité établie, tenue à… est respectée sur un enregistrement récent.'
    WHEN 'Q-MDR-EC-1984' THEN 'Déroulez un cas concret concerné par évaluation clinique fondée sur données cliniques suffisantes et mise… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-EC-6441' THEN 'Montrez-moi, sur un cas réel récent, comment évaluation clinique fondée sur données cliniques suffisantes et mise… est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-GG-4573' THEN 'Choisissons un danger réel concerné par exigences générales de sécurité et performance démontrées et reliées… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-GG-8504' THEN 'Choisissons un danger réel concerné par exigences générales de sécurité et performance démontrées et reliées… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-GIU-4931' THEN 'Montrez-moi, sur un cas réel récent, comment étiquetage, notice et information utilisateur conformes, lisibles et… est la preuve.'
    WHEN 'Q-MDR-I-5980' THEN 'Montrez-moi, sur un cas réel récent, comment vérifications importateur avant mise sur le marché et traçabilité des… est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-I-6277' THEN 'Déroulez un cas concret concerné par vérifications importateur avant mise sur le marché et traçabilité des… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-IC-4353' THEN 'Sortez le dernier cas concerné par investigations cliniques planifiées, autorisées, conduites et… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-IC-8284' THEN 'Sortez le dernier cas concerné par investigations cliniques planifiées, autorisées, conduites et… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-MC-8407' THEN 'Montrez-moi, sur un cas réel récent, comment marquage CE apposé uniquement après conformité démontrée est… est la preuve.'
    WHEN 'Q-MDR-MSM-6162' THEN 'Montrez-moi, sur un cas réel récent, comment dispositif mis sur le marché uniquement s’il est conforme au MDR et… est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-P-0494' THEN 'Montrez-moi, sur un cas réel récent, comment rapport périodique actualisé de sécurité produit lorsque applicable… est la preuve.'
    WHEN 'Q-MDR-P-9760' THEN 'Déroulez un cas concret concerné par personne chargée de veiller au respect de la réglementation qualifiée… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-RP-1538' THEN 'Montrez-moi comment couverture responsabilité financière et conservation documentaire… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDR-RP-1835' THEN 'Choisissons un danger réel concerné par couverture responsabilité financière et conservation documentaire… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-RP-6887' THEN 'Choisissons un danger réel concerné par couverture responsabilité financière et conservation documentaire… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDR-RR-2567' THEN 'Montrez-moi, sur un cas réel récent, comment obligations en cas de reconditionnement, relabelling ou modification… est appliquée en pratique et où en est la preuve.'
    WHEN 'Q-MDR-RR-6201' THEN 'Déroulez un cas concret concerné par obligations en cas de reconditionnement, relabelling ou modification… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-TCDA-6992' THEN 'Montrez-moi, sur un cas réel récent, comment identification des opérateurs économiques amont/aval dans la chaîne… est la preuve.'
    WHEN 'Q-MDR-TR-2051' THEN 'Sortez le dernier cas concerné par analyse et déclaration des tendances significatives d’incidents ou… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-TR-8120' THEN 'Sortez le dernier cas concerné par analyse et déclaration des tendances significatives d’incidents ou… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-U-2683' THEN 'Montrez-moi, sur un cas réel récent, comment système UDI attribué, apposé et maintenu dans les données… est la preuve.'
    WHEN 'Q-MDR-VIGF-0175' THEN 'Sortez le dernier cas concerné par déclaration des incidents graves et actions correctives de sécurité… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDR-VIGF-1884' THEN 'Sortez le dernier cas concerné par déclaration des incidents graves et actions correctives de sécurité… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-CSR-8134' THEN 'Montrez-moi, sur un cas réel récent, comment exigences spécifiques TGA, ANVISA, Santé Canada, MHLW/PMDA et FDA… est la preuve.'
    WHEN 'Q-MDSAP-DD-0167' THEN 'Montrez-moi comment planification conception et interfaces entre exigences, risques,… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-DD-0982' THEN 'Choisissons un danger réel concerné par entrées de conception incluant exigences utilisateur, réglementaires,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-1089' THEN 'Montrez-moi comment changements de conception évalués pour impact risque, production,… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-DD-1719' THEN 'Choisissons un danger réel concerné par dossier de conception démontrant la traçabilité complète… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-2102' THEN 'Choisissons un danger réel concerné par changements de conception évalués pour impact risque, production,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-4161' THEN 'Choisissons un danger réel concerné par changements de conception évalués pour impact risque, production,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-6533' THEN 'Choisissons un danger réel concerné par planification conception et interfaces entre exigences, risques,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-7051' THEN 'Choisissons un danger réel concerné par entrées de conception incluant exigences utilisateur, réglementaires,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-8592' THEN 'Choisissons un danger réel concerné par planification conception et interfaces entre exigences, risques,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DD-9315' THEN 'Montrez-moi comment entrées de conception incluant exigences utilisateur, réglementaires,… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-DD-9660' THEN 'Choisissons un danger réel concerné par dossier de conception démontrant la traçabilité complète… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-DMAF-1123' THEN 'Montrez-moi comment vous garantissez que dispositifs commercialisés cohérents avec… est respectée sur un enregistrement récent.'
    WHEN 'Q-MDSAP-DMAF-5720' THEN 'Montrez-moi comment vous garantissez que autorisations de mise sur le marché et… est respectée sur un enregistrement récent.'
    WHEN 'Q-MDSAP-DMAF-6417' THEN 'Montrez-moi, sur un cas réel récent, comment changements produit/site/étiquetage évalués pour impact autorisations… est la preuve.'
    WHEN 'Q-MDSAP-M-1076' THEN 'Choisissons un danger réel concerné par gestion des risques intégrée aux processus MDSAP et exigences… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-M-3867' THEN 'Choisissons un danger réel concerné par politique, objectifs, planification qualité et ressources alignés sur… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-M-4558' THEN 'Montrez-moi comment politique, objectifs, planification qualité et ressources alignés sur… relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-MDSAP-M-8052' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise du périmètre, sites, processus externalisés et… est la preuve.'
    WHEN 'Q-MDSAP-M-9017' THEN 'Choisissons un danger réel concerné par gestion des risques intégrée aux processus MDSAP et exigences… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-M-9936' THEN 'Choisissons un danger réel concerné par politique, objectifs, planification qualité et ressources alignés sur… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-0861' THEN 'Choisissons un danger réel concerné par audits internes planifiés selon risques, changements et résultats… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-1941' THEN 'Prenez un fournisseur critique : montrez-moi comment collecte et analyse des données qualité issues production, audits,… est appliquée, de la sélection à la surveillance des performances.'
    WHEN 'Q-MDSAP-MAI-4126' THEN 'Choisissons un danger réel concerné par traitement des réclamations et investigations proportionnées au… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-5068' THEN 'Montrez-moi, sur un cas réel récent, comment maîtrise des produits non conformes avant/après distribution est… est la preuve.'
    WHEN 'Q-MDSAP-MAI-5208' THEN 'Choisissons un danger réel concerné par audits internes planifiés selon risques, changements et résultats… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MAI-7427' THEN 'Montrez-moi, sur un cas réel récent, comment analyse de tendances et escalade des signaux qualité/réglementaires… est la preuve.'
    WHEN 'Q-MDSAP-MAI-8057' THEN 'Choisissons un danger réel concerné par traitement des réclamations et investigations proportionnées au… estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-MDSAP-MDAE-1373' THEN 'Sortez le dernier cas concerné par advisory notices, FSCA/recalls et communications autorités/clients… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-MDAE-1652' THEN 'Sortez le dernier cas concerné par délais de déclaration, contenu des rapports et preuves de soumission… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-MDAE-6758' THEN 'Sortez le dernier cas concerné par détection et décision de reportability selon juridictions… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-MDAE-9314' THEN 'Sortez le dernier cas concerné par advisory notices, FSCA/recalls et communications autorités/clients… : date de connaissance, décision, date d''action. Le délai a-t-il été tenu ?'
    WHEN 'Q-MDSAP-NG-4346' THEN 'Prenez un dossier de lot récent : montrez-moi comment gradation MDSAP 1 à 5 fondée sur impact, récurrence, absence… est appliquée au poste, pas seulement décrite dans une procédure.'
    WHEN 'Q-MDSAP-P-3663' THEN 'Montrez-moi, sur un cas réel récent, comment vérification des produits/services achetés selon criticité et… est la preuve.'
    ELSE questionTextSource
  END
WHERE questionTextSource IS NULL
  AND questionKey IN ('Q-13485-AI-1246', 'Q-13485-CC-8673', 'Q-13485-DS-8148', 'Q-13485-DS-9110', 'Q-13485-EC-3453', 'Q-13485-ED-7461', 'Q-13485-EM-7954', 'Q-13485-EP-6396', 'Q-13485-ET-4587', 'Q-13485-I-7207', 'Q-13485-I-8964', 'Q-13485-IDA-1734', 'Q-13485-MQ-2988', 'Q-13485-OQD-4733', 'Q-13485-PE-8433', 'Q-13485-PNC-8140', 'Q-13485-PP-4306', 'Q-13485-PP-6329', 'Q-13485-PQD-3861', 'Q-13485-PS-8314', 'Q-13485-R-4859', 'Q-13485-RD-4564', 'Q-13485-RD-4767', 'Q-13485-RD-6139', 'Q-13485-RD-8627', 'Q-13485-RH-8042', 'Q-13485-RP-1479', 'Q-13485-RP-5113', 'Q-13485-RP-6946', 'Q-13485-SA-0926', 'Q-13485-SC-8394', 'Q-13485-SP-1903', 'Q-13485-T-3038', 'Q-14971-AR-2120', 'Q-14971-AR-6051', 'Q-14971-CR-2327', 'Q-14971-CR-6258', 'Q-14971-CS-9495', 'Q-14971-DGR-2987', 'Q-14971-DGR-9056', 'Q-14971-DSD-1644', 'Q-14971-ER-0172', 'Q-14971-ER-1264', 'Q-14971-ER-1630', 'Q-14971-ER-8113', 'Q-14971-PGR-1248', 'Q-14971-PGR-1943', 'Q-14971-PGR-3372', 'Q-14971-PGR-4002', 'Q-14971-PGR-8687', 'Q-14971-RDR-1036', 'Q-14971-RDR-4511', 'Q-14971-UP-2664', 'Q-9001-AI-5121', 'Q-9001-AI-9052', 'Q-9001-C-9950', 'Q-9001-CS-0673', 'Q-9001-EC-4284', 'Q-9001-EO-6948', 'Q-9001-I-7802', 'Q-9001-L-9332', 'Q-9001-OQ-8052', 'Q-9001-P-9514', 'Q-9001-PO-1121', 'Q-9001-PQ-9483', 'Q-9001-RR-3394', 'Q-9001-S-1248', 'Q-9001-SM-5761', 'Q-FDA-5K-7377', 'Q-FDA-CC-4802', 'Q-FDA-CC-5099', 'Q-FDA-CR-3056', 'Q-FDA-CR-5666', 'Q-FDA-CR-7241', 'Q-FDA-DLPC-6078', 'Q-FDA-DQ-2580', 'Q-FDA-FEI-8396', 'Q-FDA-II1-6737', 'Q-FDA-L-4709', 'Q-FDA-MDR-9221', 'Q-FDA-NDI-8530', 'Q-FDA-PMR-8072', 'Q-FDA-RCR-4961', 'Q-FDA-RF-9013', 'Q-FDA-RL-8745', 'Q-FDA-SQQ-5999', 'Q-FDA-US-4294', 'Q-IVDR-AIFI-4529', 'Q-IVDR-AIFI-6588', 'Q-IVDR-CAI-3208', 'Q-IVDR-CI-4756', 'Q-IVDR-DI-8225', 'Q-IVDR-DUCI-8719', 'Q-IVDR-EP-8616', 'Q-IVDR-GIG-5848', 'Q-IVDR-GIG-9779', 'Q-IVDR-GPCI-0625', 'Q-IVDR-GPCI-4556', 'Q-IVDR-IO-6222', 'Q-IVDR-PE-1858', 'Q-IVDR-PE-8439', 'Q-IVDR-PI-5092', 'Q-IVDR-RRI-8516', 'Q-IVDR-SMI-2996', 'Q-IVDR-VI-0498', 'Q-IVDR-VI-2557', 'Q-MDR-AIF-0786', 'Q-MDR-AIF-2845', 'Q-MDR-C-8747', 'Q-MDR-CA-6183', 'Q-MDR-CO-8331', 'Q-MDR-D-7081', 'Q-MDR-DUC-5437', 'Q-MDR-EC-1984', 'Q-MDR-EC-6441', 'Q-MDR-GG-4573', 'Q-MDR-GG-8504', 'Q-MDR-GIU-4931', 'Q-MDR-I-5980', 'Q-MDR-I-6277', 'Q-MDR-IC-4353', 'Q-MDR-IC-8284', 'Q-MDR-MC-8407', 'Q-MDR-MSM-6162', 'Q-MDR-P-0494', 'Q-MDR-P-9760', 'Q-MDR-RP-1538', 'Q-MDR-RP-1835', 'Q-MDR-RP-6887', 'Q-MDR-RR-2567', 'Q-MDR-RR-6201', 'Q-MDR-TCDA-6992', 'Q-MDR-TR-2051', 'Q-MDR-TR-8120', 'Q-MDR-U-2683', 'Q-MDR-VIGF-0175', 'Q-MDR-VIGF-1884', 'Q-MDSAP-CSR-8134', 'Q-MDSAP-DD-0167', 'Q-MDSAP-DD-0982', 'Q-MDSAP-DD-1089', 'Q-MDSAP-DD-1719', 'Q-MDSAP-DD-2102', 'Q-MDSAP-DD-4161', 'Q-MDSAP-DD-6533', 'Q-MDSAP-DD-7051', 'Q-MDSAP-DD-8592', 'Q-MDSAP-DD-9315', 'Q-MDSAP-DD-9660', 'Q-MDSAP-DMAF-1123', 'Q-MDSAP-DMAF-5720', 'Q-MDSAP-DMAF-6417', 'Q-MDSAP-M-1076', 'Q-MDSAP-M-3867', 'Q-MDSAP-M-4558', 'Q-MDSAP-M-8052', 'Q-MDSAP-M-9017', 'Q-MDSAP-M-9936', 'Q-MDSAP-MAI-0861', 'Q-MDSAP-MAI-1941', 'Q-MDSAP-MAI-4126', 'Q-MDSAP-MAI-5068', 'Q-MDSAP-MAI-5208', 'Q-MDSAP-MAI-7427', 'Q-MDSAP-MAI-8057', 'Q-MDSAP-MDAE-1373', 'Q-MDSAP-MDAE-1652', 'Q-MDSAP-MDAE-6758', 'Q-MDSAP-MDAE-9314', 'Q-MDSAP-NG-4346', 'Q-MDSAP-P-3663');

-- ============================================================
-- 3. PASSE EDITORIALE — MDR (3 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-MDR-S-3363' THEN 'Montrez-moi, sur un cas réel récent, comment le résumé des caractéristiques de sécurité et des performances cliniques (SSCP) de votre dispositif implantable ou de classe III est rédigé de manière compréhensible pour l''utilisateur prévu (et le grand public le cas échéant), validé par l''organisme notifié et téléversé dans Eudamed.'
    WHEN 'Q-MDR-S-5062' THEN 'Déroulez un cas concret de SSCP pour un dispositif implantable ou de classe III : contenu, validation par l''organisme notifié, téléversement dans Eudamed — quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-SM-0792' THEN 'Montrez-moi, sur un cas réel récent, comment vous avez répondu à une demande motivée d''une autorité compétente : fourniture de toute l''information et documentation démontrant la conformité (dans une langue officielle acceptée), accès donné et échantillons remis si demandés.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-MDR-S-3363', 'Q-MDR-S-5062', 'Q-MDR-SM-0792');

-- ============================================================
-- 3. PASSE EDITORIALE — IVDR (3 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-IVDR-MSMI-5641' THEN 'Montrez-moi, sur un cas réel récent, comment vous garantissez qu''un DIV n''est mis sur le marché que s''il respecte l''IVDR et sa destination, et où en est la preuve.'
    WHEN 'Q-IVDR-PI-0993' THEN 'Montrez-moi, sur un cas réel récent, comment le PSUR (rapport périodique de sécurité), lorsqu''applicable à votre DIV, est actualisé et transmis conformément aux exigences de l''Art. 81, et où en est la preuve.'
    WHEN 'Q-IVDR-GIUI-6261' THEN 'Montrez-moi, sur un cas réel récent, comment vous garantissez que l''étiquetage et la notice d''utilisation de votre DIV sont conformes, lisibles et validés, et où en est la preuve.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-IVDR-MSMI-5641', 'Q-IVDR-PI-0993', 'Q-IVDR-GIUI-6261');

-- ============================================================
-- 3. PASSE EDITORIALE — FDA_QMSR (7 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-FDA-5K-1069' THEN 'Montrez-moi, sur un cas réel récent de soumission 510(k), comment le choix de voie, la comparaison au predicate et la démonstration de substantial equivalence (FD&C 513(i)) ont été conduits — contenu de la soumission (§807.87) et résumé/déclaration SE (§807.92-93) — et où en est la preuve.'
    WHEN 'Q-FDA-N-2561' THEN 'Choisissons un dossier De Novo réel (FD&C 513(f)(2), 21 CFR 860 Subpart D) pour un dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : déroulez le contenu du dossier, sa recevabilité, les délais respectés et les effets de l''ordre de classification obtenu (contrôles spéciaux applicables, base pour de futurs 510(k)).'
    WHEN 'Q-FDA-N-1933' THEN 'Montrez-moi comment le choix de la voie De Novo pour un dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé relie votre analyse de risques à la décision de classification et aux contrôles spéciaux qui en découlent.'
    WHEN 'Q-FDA-N-6492' THEN 'Déroulez un dossier De Novo réel du contenu de la demande jusqu''à l''ordre de classification obtenu : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité sur les contrôles spéciaux applicables ?'
    WHEN 'Q-FDA-SQ-5662' THEN 'Prenez un fournisseur critique : montrez-moi comment la maîtrise des achats et des fournisseurs (QMSR 21 CFR 820.10, via ISO 13485 §7.4 incorporée par référence au §820.7) est appliquée — critères d''évaluation/sélection/surveillance proportionnés au risque, informations d''achat, vérification du produit acheté, rapports de performance fournisseur — de la sélection à la surveillance des performances.'
    WHEN 'Q-FDA-SC-6736' THEN 'Ouvrons le dernier dossier de conception concerné par les exigences de cybersécurité pour les « cyber devices » (FD&C 524B) — plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, nomenclature logicielle (SBOM), intégrés au design control (ISO 13485 §7.3) — : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation.'
    WHEN 'Q-FDA-SC-4677' THEN 'Montrez-moi, sur un cas réel récent, comment le plan de surveillance et de correction des vulnérabilités, le processus assurant la cybersécurité et la nomenclature logicielle (SBOM) exigés pour les « cyber devices » (FD&C 524B) sont intégrés à votre design control (ISO 13485 §7.3), et où en est la preuve.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-FDA-5K-1069', 'Q-FDA-N-2561', 'Q-FDA-N-1933', 'Q-FDA-N-6492', 'Q-FDA-SQ-5662', 'Q-FDA-SC-6736', 'Q-FDA-SC-4677');

-- ============================================================
-- 3. PASSE EDITORIALE — MDSAP (1 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-MDSAP-PL-3453' THEN 'Montrez-moi, sur un cas réel récent, comment des informations issues d''un processus (non-conformité, réclamation, donnée de surveillance) ont orienté l''échantillonnage et la profondeur d''audit d''un processus lié, conformément à l''approche d''audit MDSAP (AU P0002) — et où en est la preuve.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-MDSAP-PL-3453');

-- ============================================================
-- 3. PASSE EDITORIALE — ISO14971 (25 questions)
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
    WHEN 'Q-14971-RRG-7446' THEN 'Avant la mise sur le marché, comment avez-vous vérifié que l''ensemble des risques restant sur le dispositif était acceptable ? Montrez le résultat de cette évaluation.'
    WHEN 'Q-14971-RRG-3515' THEN 'Qui a validé que l''ensemble des risques restant sur le dispositif était acceptable ? Montrez les données utilisées et la décision prise.'
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
-- 3. PASSE EDITORIALE — ISO9001 (6 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-9001-PI-3467' THEN 'Montrez-moi, sur un cas réel récent, comment vous déterminez et surveillez les parties intéressées pertinentes et leurs exigences — y compris, le cas échéant, des exigences liées aux changements climatiques (Amd.1:2024) — et où en est la preuve.'
    WHEN 'Q-9001-RO-2538' THEN 'Choisissons un risque ou une opportunité réel(le) affectant votre SMQ : déroulez comment il/elle a été identifié(e) lors de la planification (6.1), quelles actions ont été engagées pour le traiter, et comment leur efficacité a été évaluée.'
    WHEN 'Q-9001-RO-9521' THEN 'Montrez-moi, sur un cas réel récent, comment la planification des risques et opportunités affectant votre SMQ (6.1) débouche sur des actions proportionnées, intégrées à vos processus et dont l''efficacité est évaluée.'
    WHEN 'Q-9001-CLO-5514' THEN 'Montrez-moi, sur un cas réel récent, comment vous déterminez et surveillez les enjeux externes et internes pertinents pour la finalité, l''orientation stratégique et les résultats attendus de votre SMQ — y compris, depuis l''Amendement 1:2024, la détermination de la pertinence des changements climatiques comme enjeu — et où en est la preuve.'
    WHEN 'Q-9001-PS-7808' THEN 'Montrez-moi, sur un cas réel récent, comment vous avez déterminé le domaine d''application de votre SMQ (enjeux 4.1, parties intéressées 4.2, produits/services), et comment toute exigence jugée non applicable est justifiée par écrit, sans incidence sur la conformité des produits/services ni sur la satisfaction client.'
    WHEN 'Q-9001-L-0975' THEN 'Montrez-moi, sur un cas réel récent, comment la direction démontre son leadership et son engagement envers le SMQ — responsabilité de son efficacité, intégration aux processus métiers, ressources allouées — y compris l''orientation client (5.1.2) : exigences client déterminées et satisfaites, risques et opportunités affectant la conformité traités.'
    ELSE questionText
  END
WHERE questionKey IN ('Q-9001-PI-3467', 'Q-9001-RO-2538', 'Q-9001-RO-9521', 'Q-9001-CLO-5514', 'Q-9001-PS-7808', 'Q-9001-L-0975');

-- ============================================================
-- 4. CORRECTION DES 24 TITRES TRONQUES (title uniquement, questionText/
--    questionTextSource non touchés par ce bloc)
-- ============================================================

UPDATE questions
SET title = CASE questionKey
    WHEN 'Q-FDA-N-2561' THEN '21 CFR 860 Subpart D (§§860.200–860.260) — demande de classification De Novo (FD&C 513(f)(2)) pour dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : contenu, recevabilité, délais et effets de l''ordre de classification (contrôles spéciaux applicables, base pour de futurs 510(k)).'
    WHEN 'Q-FDA-N-1933' THEN '21 CFR 860 Subpart D (§§860.200–860.260) — demande de classification De Novo (FD&C 513(f)(2)) pour dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : contenu, recevabilité, délais et effets de l''ordre de classification (contrôles spéciaux applicables, base pour de futurs 510(k)).'
    WHEN 'Q-FDA-N-6492' THEN '21 CFR 860 Subpart D (§§860.200–860.260) — demande de classification De Novo (FD&C 513(f)(2)) pour dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : contenu, recevabilité, délais et effets de l''ordre de classification (contrôles spéciaux applicables, base pour de futurs 510(k)).'
    WHEN 'Q-FDA-SQ-5662' THEN 'QMSR 21 CFR 820.10 — maîtrise des achats et des fournisseurs via ISO 13485 7.4 incorporée par référence (§820.7) : critères d''évaluation/sélection/surveillance proportionnés au risque, informations d''achat, vérification du produit acheté ; les rapports de performance fournisseur documentés.'
    WHEN 'Q-FDA-SC-6736' THEN 'FD&C section 524B — exigences cybersécurité pour les « cyber devices » (plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, SBOM) dans les soumissions premarket ; intégration au design control ISO 13485 7.3 (gestion du cycle de vie du logiciel).'
    WHEN 'Q-FDA-SC-4677' THEN 'FD&C section 524B — exigences cybersécurité pour les « cyber devices » (plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, SBOM) dans les soumissions premarket ; intégration au design control ISO 13485 7.3 (gestion du cycle de vie du logiciel).'
    WHEN 'Q-9001-CLO-5514' THEN '4.1 — détermination et surveillance des enjeux externes et internes pertinents pour la finalité, l''orientation stratégique et les résultats attendus du SMQ, y compris la détermination de la pertinence des changements climatiques comme enjeu (Amd.1:2024).'
    WHEN 'Q-9001-PS-7808' THEN '4.3 — détermination du domaine d''application du SMQ (enjeux 4.1, parties intéressées 4.2, produits/services) et justification documentée de toute exigence jugée non applicable, sans incidence sur la conformité des produits/services ni la satisfaction client.'
    WHEN 'Q-9001-L-0975' THEN '5.1 — leadership et engagement démontrés de la direction (responsabilité de l''efficacité du SMQ, intégration aux processus métiers, ressources) incluant l''orientation client (5.1.2 : exigences déterminées et satisfaites, risques/opportunités sur la conformité traités).'
    WHEN 'Q-MDR-S-3363' THEN 'Art. 32 — résumé des caractéristiques de sécurité et des performances cliniques (SSCP) pour les dispositifs implantables et de classe III (hors sur mesure et investigation), validé par l''organisme notifié et téléversé dans Eudamed, rédigé de manière compréhensible pour l''utilisateur prévu (et le grand public le cas échéant).'
    WHEN 'Q-MDR-S-5062' THEN 'Art. 32 — résumé des caractéristiques de sécurité et des performances cliniques (SSCP) pour les dispositifs implantables et de classe III (hors sur mesure et investigation), validé par l''organisme notifié et téléversé dans Eudamed, rédigé de manière compréhensible pour l''utilisateur prévu (et le grand public le cas échéant).'
    WHEN 'Q-MDR-SM-0792' THEN 'Art. 10(14) — obligation du fabricant de coopérer avec l''autorité compétente : fournir sur demande motivée toutes les informations et la documentation démontrant la conformité (dans une langue officielle acceptée), donner accès et remettre des échantillons si demandés.'
    WHEN 'Q-MDSAP-PL-3453' THEN 'MDSAP AU P0002 (Audit Approach) — exploitation des liaisons inter-processus : les informations issues d''un processus (ex. NC, réclamations, données de surveillance) orientent l''échantillonnage et la profondeur d''audit des processus liés, conformément à l''approche d''audit MDSAP.'
    WHEN 'Q-FDA-CMC-0807' THEN 'QMSR 21 CFR 820.35(a) — exigences d''enregistrement des réclamations (revue, évaluation, investigation, UDI) en complément d''ISO 13485 8.2.2 incorporée par référence (§820.7/820.10) ; boucle avec le reporting MDR (21 CFR 803), les corrections/removals et les CAPA associées.'
    WHEN 'Q-FDA-CMC-1104' THEN 'QMSR 21 CFR 820.35(a) — exigences d''enregistrement des réclamations (revue, évaluation, investigation, UDI) en complément d''ISO 13485 8.2.2 incorporée par référence (§820.7/820.10) ; boucle avec le reporting MDR (21 CFR 803), les corrections/removals et les CAPA associées.'
    WHEN 'Q-FDA-CMC-4738' THEN 'QMSR 21 CFR 820.35(a) — exigences d''enregistrement des réclamations (revue, évaluation, investigation, UDI) en complément d''ISO 13485 8.2.2 incorporée par référence (§820.7/820.10) ; boucle avec le reporting MDR (21 CFR 803), les corrections/removals et les CAPA associées.'
    WHEN 'Q-FDA-DCS-2444' THEN '21 CFR 807.81(a)(3) — nouveau 510(k) requis pour tout changement/modification significatif du dispositif ou de son étiquetage susceptible d''affecter sécurité ou efficacité (guidance FDA « Deciding When to Submit a 510(k) for a Change to an Existing Device »).'
    WHEN 'Q-FDA-DCS-2147' THEN '21 CFR 807.81(a)(3) — nouveau 510(k) requis pour tout changement/modification significatif du dispositif ou de son étiquetage susceptible d''affecter sécurité ou efficacité (guidance FDA « Deciding When to Submit a 510(k) for a Change to an Existing Device »).'
    WHEN 'Q-FDA-SQ-4087' THEN 'QMSR 21 CFR 820.10 — maîtrise des achats et des fournisseurs via ISO 13485 7.4 incorporée par référence (§820.7) : critères d''évaluation/sélection/surveillance proportionnés au risque, informations d''achat, vérification du produit acheté ; les rapports de performance fournisseur documentés.'
    WHEN 'Q-FDA-SC-8311' THEN 'FD&C section 524B — exigences cybersécurité pour les « cyber devices » (plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, SBOM) dans les soumissions premarket ; intégration au design control ISO 13485 7.3 (gestion du cycle de vie du logiciel).'
    WHEN 'Q-14971-CIP-2019' THEN '10.2 — collecte des informations selon les six sources exigées : production/surveillance du procédé, utilisateurs, installation/utilisation/maintenance, chaîne d''approvisionnement, informations publiques, état de l''art généralement admis (+ veille active de l''état de l''art).'
    WHEN 'Q-9001-OA-2015' THEN '10.1 — détermination et sélection des opportunités d''amélioration et actions pour satisfaire aux exigences client et accroître la satisfaction : amélioration des produits/services (incluant besoins et attentes futurs), correction/prévention/réduction des effets indésirables, amélioration de la performance et de l''efficacité du SMQ.'
    WHEN 'Q-MDR-S-1304' THEN 'Art. 32 — résumé des caractéristiques de sécurité et des performances cliniques (SSCP) pour les dispositifs implantables et de classe III (hors sur mesure et investigation), validé par l''organisme notifié et téléversé dans Eudamed, rédigé de manière compréhensible pour l''utilisateur prévu (et le grand public le cas échéant).'
    WHEN 'Q-MDR-DSM-0911' THEN 'Annexe XIII — procédure pour les dispositifs sur mesure : déclaration (section 1) accompagnant le dispositif et mise à disposition du patient/utilisateur identifié (Art. 21(2)), documentation (section 2) établie, tenue à jour et tenue à disposition des autorités compétentes.'
    ELSE title
  END
WHERE questionKey IN ('Q-FDA-N-2561', 'Q-FDA-N-1933', 'Q-FDA-N-6492', 'Q-FDA-SQ-5662', 'Q-FDA-SC-6736', 'Q-FDA-SC-4677', 'Q-9001-CLO-5514', 'Q-9001-PS-7808', 'Q-9001-L-0975', 'Q-MDR-S-3363', 'Q-MDR-S-5062', 'Q-MDR-SM-0792', 'Q-MDSAP-PL-3453', 'Q-FDA-CMC-0807', 'Q-FDA-CMC-1104', 'Q-FDA-CMC-4738', 'Q-FDA-DCS-2444', 'Q-FDA-DCS-2147', 'Q-FDA-SQ-4087', 'Q-FDA-SC-8311', 'Q-14971-CIP-2019', 'Q-9001-OA-2015', 'Q-MDR-S-1304', 'Q-MDR-DSM-0911');

-- ============================================================
-- VERIFICATION APRES
-- ============================================================

-- a. Total du corpus (attendu, inchangé : 473)
SELECT COUNT(*) AS total FROM questions;

-- b. Questions encore tronquées dans questionText (attendu : 0)
SELECT COUNT(*) AS tronquees_restantes FROM questions WHERE questionText LIKE '%…%';

-- c. questionTextSource peuplée sur 171 + 45 = 216 lignes exactement
SELECT COUNT(*) AS lignes_avec_source FROM questions WHERE questionTextSource IS NOT NULL;

-- d. Titres encore tronqués à 250 caractères (attendu : 0)
SELECT COUNT(*) AS titres_tronques_restants FROM questions WHERE LENGTH(title) = 250;

-- e. Aucun questionKey dupliqué ou perdu (toujours 473 distincts)
SELECT COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;

-- f. Échantillon de contrôle manuel
SELECT questionKey, LENGTH(title) AS title_len, questionTextSource IS NOT NULL AS a_une_source, questionText
FROM questions
WHERE questionKey IN ('Q-14971-RRG-7446', 'Q-MDR-S-3363', 'Q-FDA-N-2561', 'Q-MDR-DSM-0911')
ORDER BY questionKey;
