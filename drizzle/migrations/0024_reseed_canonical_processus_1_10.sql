-- Réamorce les processus canoniques 1-10 (Gouvernance, Affaires réglementaires,
-- QMS, Gestion des risques, Conception & développement, Achats & fournisseurs,
-- Production & sous-traitance, Traçabilité/UDI, PMS/PMCF, Vigilance & incidents).
--
-- Root cause : 0007_create_referentiels_and_processus.sql tente de les créer,
-- mais dans le même fichier/transaction il modifie aussi `audits` et
-- `mdr_role_qualifications` — des tables qui n'existent pas encore à ce point
-- de l'ordre des migrations (créées juste après, par 0007b_baseline_core_tables.sql).
-- Sur une base neuve, ces UPDATE échouent (ER_NO_SUCH_TABLE), toute la
-- transaction du fichier est annulée (y compris l'INSERT des processus 1-10 fait
-- plus tôt dans le même fichier), et l'erreur est absorbée comme "ignorable" —
-- le hash de la migration est quand même marqué "appliqué", donc elle ne se
-- rejoue jamais. Résultat : les ids 1-10 n'ont jamais existé dans aucun
-- environnement (seuls 11-15 existent, créés séparément et sans risque par
-- 0010_processus_unify_15.sql). Découvert en corrigeant le classement des
-- questions par processus (scripts/process_mapping_228_to_15.json).
--
-- Cette migration ne touche que `processus` (aucun risque de rollback lié à
-- une autre table) et est idempotente (upsert par id).
-- Le slug est réaffirmé aussi (colonne ajoutée par 0010, qui s'exécute avant
-- celle-ci) au cas où l'id 1-10 est déjà occupé par un ancien processus
-- "fantôme" (voir import-corpus.mjs) dont le slug ne correspondrait plus au
-- nom canonique après cette mise à jour.
INSERT INTO `processus` (`id`, `name`, `slug`, `createdAt`, `updatedAt`) VALUES
  (1,  'Gouvernance & stratégie réglementaire', 'governance_strategy', NOW(), NOW()),
  (2,  'Affaires réglementaires (RA)',         'regulatory_affairs',   NOW(), NOW()),
  (3,  'Système de management qualité (QMS)',  'qms',                  NOW(), NOW()),
  (4,  'Gestion des risques (ISO 14971)',      'risk_management',      NOW(), NOW()),
  (5,  'Conception & développement',           'design_development',   NOW(), NOW()),
  (6,  'Achats & fournisseurs',                'purchasing_suppliers', NOW(), NOW()),
  (7,  'Production & sous-traitance',          'production_subcontract', NOW(), NOW()),
  (8,  'Traçabilité / UDI',                    'traceability_udi',     NOW(), NOW()),
  (9,  'PMS / PMCF',                           'pms_pmcf',             NOW(), NOW()),
  (10, 'Vigilance & incidents',                'vigilance_incidents',  NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `slug` = VALUES(`slug`),
  `updatedAt` = NOW();
