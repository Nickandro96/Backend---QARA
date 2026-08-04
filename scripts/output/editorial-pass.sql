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
    WHEN 'Q-MDR-S-3363' THEN 'Montrez-moi, sur un cas réel récent, comment le résumé des caractéristiques de sécurité et des performances cliniques (SSCP) de votre dispositif implantable ou de classe III est rédigé de manière compréhensible pour l''utilisateur prévu (et le grand public le cas échéant), validé par l''organisme notifié et téléversé dans Eudamed.'
    WHEN 'Q-MDR-S-5062' THEN 'Déroulez un cas concret de SSCP pour un dispositif implantable ou de classe III : contenu, validation par l''organisme notifié, téléversement dans Eudamed — quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-MDR-SM-0792' THEN 'Montrez-moi, sur un cas réel récent, comment vous avez répondu à une demande motivée d''une autorité compétente : fourniture de toute l''information et documentation démontrant la conformité (dans une langue officielle acceptée), accès donné et échantillons remis si demandés.'
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
    WHEN 'Q-IVDR-MSMI-5641' THEN 'Montrez-moi, sur un cas réel récent, comment vous garantissez qu''un DIV n''est mis sur le marché que s''il respecte l''IVDR et sa destination, et où en est la preuve.'
    WHEN 'Q-IVDR-PI-0993' THEN 'Montrez-moi, sur un cas réel récent, comment le PSUR (rapport périodique de sécurité), lorsqu''applicable à votre DIV, est actualisé et transmis conformément aux exigences de l''Art. 81, et où en est la preuve.'
    WHEN 'Q-IVDR-GIUI-6261' THEN 'Montrez-moi, sur un cas réel récent, comment vous garantissez que l''étiquetage et la notice d''utilisation de votre DIV sont conformes, lisibles et validés, et où en est la preuve.'
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
-- RECONSTRUCTION EDITORIALE — MDSAP (1 questions)
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
-- RECONSTRUCTION EDITORIALE — ISO14971 (25 questions)
-- ============================================================

UPDATE questions
SET
  questionTextSource = CASE WHEN questionTextSource IS NULL THEN questionText ELSE questionTextSource END,
  questionText = CASE questionKey
    WHEN 'Q-14971-MR-4038' THEN 'Choisissons un danger réel concerné par l''analyse des options de maîtrise des risques et la détermination des mesures appropriées pour ramener ce risque à un niveau acceptable : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-MR-9272' THEN 'Montrez-moi comment l''analyse des options de maîtrise des risques et la détermination des mesures appropriées pour ramener ce risque à un niveau acceptable relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-AOM-0896' THEN 'Choisissons un danger réel concerné par l''ordre de priorité des options de maîtrise du risque — sécurité inhérente à la conception et à la fabrication, puis mesures de protection, puis information pour la sécurité — : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-AOM-5470' THEN 'Montrez-moi comment l''ordre de priorité des options de maîtrise du risque — sécurité inhérente à la conception, mesures de protection, puis information pour la sécurité — relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-AOM-2955' THEN 'Déroulez un cas concret concerné par l''ordre de priorité des options de maîtrise du risque — sécurité inhérente à la conception et à la fabrication, mesures de protection, information pour la sécurité — : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-14971-MŒC-8079' THEN 'Montrez-moi, sur un cas réel récent, comment la mesure de maîtrise retenue a fait l''objet des deux vérifications distinctes exigées par la norme : la vérification que la mesure a bien été mise en œuvre, et la vérification indépendante de son efficacité.'
    WHEN 'Q-14971-ABR-2180' THEN 'Choisissons un danger réel dont le risque résiduel individuel n''est pas acceptable et pour lequel aucune réduction supplémentaire n''est réalisable : déroulez l''analyse bénéfice-risque menée, son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-ABR-5814' THEN 'Montrez-moi comment l''analyse bénéfice-risque, menée lorsque le risque résiduel individuel n''est pas acceptable et qu''aucune réduction supplémentaire n''est réalisable, relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-ABR-6111' THEN 'Déroulez un cas concret où le risque résiduel individuel n''a pas été jugé acceptable malgré l''impossibilité de réduction supplémentaire : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-14971-RIC-1049' THEN 'Choisissons un danger réel concerné par l''examen des risques découlant des mesures de maîtrise retenues — nouveaux dangers ou situations dangereuses introduits, ou impact sur des risques déjà estimés : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-RIC-7118' THEN 'Montrez-moi comment l''examen des risques découlant des mesures de maîtrise retenues — nouveaux dangers ou impact sur des risques déjà estimés — relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-CM-1778' THEN 'Montrez-moi, sur un cas réel récent, comment vous vérifiez que toutes les situations dangereuses identifiées ont été traitées et que toutes les activités de gestion des risques prévues sont achevées.'
    WHEN 'Q-14971-RRG-7446' THEN 'Montrez-moi comment vous avez évalué l''acceptabilité du risque résiduel global du dispositif — l''ensemble des risques résiduels individuels combinés, pas seulement risque par risque — avant sa mise sur le marché.'
    WHEN 'Q-14971-RRG-3515' THEN 'Déroulez, sur un audit récent, le raisonnement qui a permis de juger le risque résiduel global du dispositif acceptable : quelles données, quelle méthode d''agrégation, quelle décision et par qui ?'
    WHEN 'Q-14971-RGR-9160' THEN 'Montrez-moi, sur la dernière libération commerciale d''un dispositif, la revue de gestion des risques réalisée avant libération : qui l''a menée, sur quelles preuves, et comment elle conclut que le processus a été correctement mis en œuvre et que le risque résiduel global est acceptable.'
    WHEN 'Q-14971-RGR-3091' THEN 'Déroulez un cas concret de revue de gestion des risques avant libération commerciale : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité ?'
    WHEN 'Q-14971-RIPP-2086' THEN 'Choisissons une information de production/post-production réelle (réclamation, retour terrain, littérature) : montrez-moi comment vous l''examinez pour sa pertinence en matière de sécurité — nouveau danger, risque devenu inacceptable, remise en cause du risque résiduel global, évolution de l''état de l''art — son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-RIPP-4764' THEN 'Montrez-moi comment l''examen des informations de production et post-production — nouveaux dangers, risque devenu inacceptable, remise en cause du risque résiduel global, évolution de l''état de l''art — relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-APP-5733' THEN 'Choisissons un cas réel où une information post-production s''est révélée pertinente pour la sécurité : déroulez les actions prises — réexamen du dossier de risques, réappréciation, impact sur les mesures de maîtrise, actions sur les dispositifs déjà sur le marché, remontée à la revue de direction.'
    WHEN 'Q-14971-APP-7458' THEN 'Montrez-moi comment les actions prises face à une information post-production pertinente pour la sécurité — réexamen du dossier de risques, réappréciation, actions sur le marché, remontée à la revue de direction — relient votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-APP-9033' THEN 'Déroulez un cas concret d''information post-production jugée pertinente pour la sécurité : quelle décision, par qui, sur quelle preuve, avec quel contrôle d''efficacité sur le dossier de risques et, si nécessaire, sur les dispositifs déjà sur le marché ?'
    WHEN 'Q-14971-LRU-1486' THEN 'Choisissons un danger réel lié à une erreur d''utilisation ou une situation dangereuse d''usage : montrez-moi qu''il a bien été identifié à partir de l''utilisation prévue et de la mauvaise utilisation raisonnablement prévisible documentées (liaison IEC 62366-1), son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-LRU-3545' THEN 'Montrez-moi comment l''identification des dangers liés aux erreurs d''utilisation — fondée sur l''utilisation prévue et la mauvaise utilisation raisonnablement prévisible documentées, en lien avec l''analyse d''utilisabilité IEC 62366-1 — relie votre analyse de risques à une décision concrète sur le produit.'
    WHEN 'Q-14971-LRL-8098' THEN 'Choisissons un danger réel lié au logiciel ou à la sécurité des données/systèmes : montrez-moi qu''il est bien couvert par votre processus de gestion des risques, explicitement inclus dans son domaine d''application, son estimation, sa maîtrise et le risque résiduel retenu.'
    WHEN 'Q-14971-LRL-4167' THEN 'Montrez-moi comment l''identification des dangers liés au logiciel et à la sécurité des données/systèmes — explicitement incluse dans le domaine d''application de votre gestion des risques — relie votre analyse de risques à une décision concrète sur le produit.'
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
