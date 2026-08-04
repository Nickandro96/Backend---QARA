-- QARA — BACKFILL TECHNIQUE UNIQUEMENT : questionTextSource (171 lignes)
-- NE MODIFIE PAS questionText, title OU questionKey.
-- Point de contrôle B : sauvegarde et vérification de new-claude obligatoires avant exécution.
-- Exécuter d'abord les requêtes SELECT ci-dessous. Si la colonne n'existe pas, appliquer la
-- migration additive approuvée séparément ; ne pas improviser d'ALTER en production.

SELECT COUNT(*) AS total, COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;
SELECT COUNT(*) AS sources_deja_presentes FROM questions WHERE questionTextSource IS NOT NULL;

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

-- Vérifications après ce bloc uniquement
SELECT COUNT(*) AS sources_presentes_apres FROM questions WHERE questionTextSource IS NOT NULL;
SELECT COUNT(*) AS sources_manquantes_sur_les_171
FROM questions
WHERE questionKey IN (
  'Q-13485-AI-1246',
  'Q-13485-CC-8673',
  'Q-13485-DS-8148',
  'Q-13485-DS-9110',
  'Q-13485-EC-3453',
  'Q-13485-ED-7461',
  'Q-13485-EM-7954',
  'Q-13485-EP-6396',
  'Q-13485-ET-4587',
  'Q-13485-I-7207',
  'Q-13485-I-8964',
  'Q-13485-IDA-1734',
  'Q-13485-MQ-2988',
  'Q-13485-OQD-4733',
  'Q-13485-PE-8433',
  'Q-13485-PNC-8140',
  'Q-13485-PP-4306',
  'Q-13485-PP-6329',
  'Q-13485-PQD-3861',
  'Q-13485-PS-8314',
  'Q-13485-R-4859',
  'Q-13485-RD-4564',
  'Q-13485-RD-4767',
  'Q-13485-RD-6139',
  'Q-13485-RD-8627',
  'Q-13485-RH-8042',
  'Q-13485-RP-1479',
  'Q-13485-RP-5113',
  'Q-13485-RP-6946',
  'Q-13485-SA-0926',
  'Q-13485-SC-8394',
  'Q-13485-SP-1903',
  'Q-13485-T-3038',
  'Q-14971-AR-2120',
  'Q-14971-AR-6051',
  'Q-14971-CR-2327',
  'Q-14971-CR-6258',
  'Q-14971-CS-9495',
  'Q-14971-DGR-2987',
  'Q-14971-DGR-9056',
  'Q-14971-DSD-1644',
  'Q-14971-ER-0172',
  'Q-14971-ER-1264',
  'Q-14971-ER-1630',
  'Q-14971-ER-8113',
  'Q-14971-PGR-1248',
  'Q-14971-PGR-1943',
  'Q-14971-PGR-3372',
  'Q-14971-PGR-4002',
  'Q-14971-PGR-8687',
  'Q-14971-RDR-1036',
  'Q-14971-RDR-4511',
  'Q-14971-UP-2664',
  'Q-9001-AI-5121',
  'Q-9001-AI-9052',
  'Q-9001-C-9950',
  'Q-9001-CS-0673',
  'Q-9001-EC-4284',
  'Q-9001-EO-6948',
  'Q-9001-I-7802',
  'Q-9001-L-9332',
  'Q-9001-OQ-8052',
  'Q-9001-P-9514',
  'Q-9001-PO-1121',
  'Q-9001-PQ-9483',
  'Q-9001-RR-3394',
  'Q-9001-S-1248',
  'Q-9001-SM-5761',
  'Q-FDA-5K-7377',
  'Q-FDA-CC-4802',
  'Q-FDA-CC-5099',
  'Q-FDA-CR-3056',
  'Q-FDA-CR-5666',
  'Q-FDA-CR-7241',
  'Q-FDA-DLPC-6078',
  'Q-FDA-DQ-2580',
  'Q-FDA-FEI-8396',
  'Q-FDA-II1-6737',
  'Q-FDA-L-4709',
  'Q-FDA-MDR-9221',
  'Q-FDA-NDI-8530',
  'Q-FDA-PMR-8072',
  'Q-FDA-RCR-4961',
  'Q-FDA-RF-9013',
  'Q-FDA-RL-8745',
  'Q-FDA-SQQ-5999',
  'Q-FDA-US-4294',
  'Q-IVDR-AIFI-4529',
  'Q-IVDR-AIFI-6588',
  'Q-IVDR-CAI-3208',
  'Q-IVDR-CI-4756',
  'Q-IVDR-DI-8225',
  'Q-IVDR-DUCI-8719',
  'Q-IVDR-EP-8616',
  'Q-IVDR-GIG-5848',
  'Q-IVDR-GIG-9779',
  'Q-IVDR-GPCI-0625',
  'Q-IVDR-GPCI-4556',
  'Q-IVDR-IO-6222',
  'Q-IVDR-PE-1858',
  'Q-IVDR-PE-8439',
  'Q-IVDR-PI-5092',
  'Q-IVDR-RRI-8516',
  'Q-IVDR-SMI-2996',
  'Q-IVDR-VI-0498',
  'Q-IVDR-VI-2557',
  'Q-MDR-AIF-0786',
  'Q-MDR-AIF-2845',
  'Q-MDR-C-8747',
  'Q-MDR-CA-6183',
  'Q-MDR-CO-8331',
  'Q-MDR-D-7081',
  'Q-MDR-DUC-5437',
  'Q-MDR-EC-1984',
  'Q-MDR-EC-6441',
  'Q-MDR-GG-4573',
  'Q-MDR-GG-8504',
  'Q-MDR-GIU-4931',
  'Q-MDR-I-5980',
  'Q-MDR-I-6277',
  'Q-MDR-IC-4353',
  'Q-MDR-IC-8284',
  'Q-MDR-MC-8407',
  'Q-MDR-MSM-6162',
  'Q-MDR-P-0494',
  'Q-MDR-P-9760',
  'Q-MDR-RP-1538',
  'Q-MDR-RP-1835',
  'Q-MDR-RP-6887',
  'Q-MDR-RR-2567',
  'Q-MDR-RR-6201',
  'Q-MDR-TCDA-6992',
  'Q-MDR-TR-2051',
  'Q-MDR-TR-8120',
  'Q-MDR-U-2683',
  'Q-MDR-VIGF-0175',
  'Q-MDR-VIGF-1884',
  'Q-MDSAP-CSR-8134',
  'Q-MDSAP-DD-0167',
  'Q-MDSAP-DD-0982',
  'Q-MDSAP-DD-1089',
  'Q-MDSAP-DD-1719',
  'Q-MDSAP-DD-2102',
  'Q-MDSAP-DD-4161',
  'Q-MDSAP-DD-6533',
  'Q-MDSAP-DD-7051',
  'Q-MDSAP-DD-8592',
  'Q-MDSAP-DD-9315',
  'Q-MDSAP-DD-9660',
  'Q-MDSAP-DMAF-1123',
  'Q-MDSAP-DMAF-5720',
  'Q-MDSAP-DMAF-6417',
  'Q-MDSAP-M-1076',
  'Q-MDSAP-M-3867',
  'Q-MDSAP-M-4558',
  'Q-MDSAP-M-8052',
  'Q-MDSAP-M-9017',
  'Q-MDSAP-M-9936',
  'Q-MDSAP-MAI-0861',
  'Q-MDSAP-MAI-1941',
  'Q-MDSAP-MAI-4126',
  'Q-MDSAP-MAI-5068',
  'Q-MDSAP-MAI-5208',
  'Q-MDSAP-MAI-7427',
  'Q-MDSAP-MAI-8057',
  'Q-MDSAP-MDAE-1373',
  'Q-MDSAP-MDAE-1652',
  'Q-MDSAP-MDAE-6758',
  'Q-MDSAP-MDAE-9314',
  'Q-MDSAP-NG-4346',
  'Q-MDSAP-P-3663'
)
  AND questionTextSource IS NULL;
