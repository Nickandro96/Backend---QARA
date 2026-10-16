# Rapport audit mondial QARA — 10 personas expertes

> **Statut de cette revue.** Persona experte simulée par une IA à des fins de contre-recette interne. Ce document n'est ni une approbation d'un organisme notifié, ni une certification IRCA, FDA ou MDSAP. Les constats réglementaires doivent être validés par un professionnel habilité avant décision externe.

## Base probante commune

- Code audité : backend `63f366c`, frontend `06feee36` (les SHA du prompt sont obsolètes).
- Population analysée ligne par ligne : **473 questions versionnées**, et non 426 : MDR 80, IVDR 72, FDA QMSR 43, MDSAP 74, ISO 13485 93, ISO 14971 67, ISO 9001 44.
- Fichier exhaustif : `corpus-question-by-question.csv` (une ligne par question).
- Contrôles automatiques : 473/473 références présentes, 473/473 preuves attendues présentes, 473/473 critères de conformité/NC présents, 473/473 explications pédagogiques présentes, 379/473 liens vers une source publique officielle détectés; ISO 13485 s'appuie sur le texte client fourni plutôt que sur une URL publique.
- Dette éditoriale : 444/473 questions utilisent au moins une formulation générique récurrente; 141 groupes de titres répétés (356 lignes) et 49 groupes de textes strictement identiques (99 lignes). Ces répétitions peuvent représenter des angles d'audit différents, mais elles doivent être justifiées par un champ « intention/variante » ou fusionnées.
- Tests backend : **186/186 réussis**. Build local non concluant : `node_modules` pointe vers un ancien dossier hors espace autorisé; ce défaut de reproductibilité n'est pas un échec fonctionnel de production.
- Parcours UI réellement exécutés, en lecture seule : Analytique Vue globale, Site, Processus, Référentiel, Clause, Exigence, Constat. Les changements d'onglet fonctionnent. Les valeurs affichées (Paris, Lyon, Bordeaux, Munich, Boston; constats F-2026-001…) sont des données de démonstration codées en dur dans le frontend, donc non opposables.
- Parcours non exécutés : création des audits nommés, saisie de 473 réponses, génération CAPA IA et PDF en production. Motif : le prompt ne fournit aucun mot de passe et l'audit interdit l'accès aux secrets; aucune donnée de production n'a été créée artificiellement.

## 0. Résumé exécutif

**Verdict : NO-GO commercial full pour une promesse eQMS mondiale/opposable; GO conditionnel pour pilotes encadrés de diagnostic et préparation d'audit.** Le socle technique et le corpus sont solides : 473 questions riches et 186 tests backend verts. Les deux obstacles majeurs sont (1) l'Analytique de production affiche encore des jeux de démonstration codés en dur; (2) les parcours CAPA/PDF/complete audit demandés n'ont pas été contre-recettés en production pendant cette passe. L'écart 473 versionné / 485 observé récemment en base / 426 annoncé par le prompt interdit de prétendre à une couverture 100 % du corpus de production sans export canonique.

## 1. Verdicts des 10 personas

| Persona simulée | Angle | Verdict |
|---|---|---|
| Diallo | ON MDR/IVDR | Conditionnel |
| O'Brien | FDA QMSR | Conditionnel |
| Tanaka | MDSAP | Conditionnel |
| Al-Rashid | ISO 13485/multi-marchés | Conditionnel |
| Moreau | ISO 9001/PME | Oui pour accompagnement, non pour certification autonome |
| Volkova | SaMD | Non comme outil principal |
| Mendoza | LATAM | Non sans pack local |
| Dubois | IVDR | Conditionnel |
| Wright | Enterprise | Non comme remplacement eQMS |
| Kouyaté | Pédagogie | Potentiel positif conditionnel |

## 2. Notes par référentiel

| Référentiel | Note simulée |
|---|---:|
| MDR | 7.6/10 |
| IVDR | 7.5/10 |
| FDA QMSR | 7.8/10 |
| MDSAP | 7.3/10 |
| ISO 13485 | 7.9/10 |
| ISO 14971 | 7.7/10 |
| ISO 9001 | 7.8/10 |

## 3. Corpus — résultat unifié

- Population : 473/473 lignes contrôlées mécaniquement; preuve détaillée dans le CSV.
- Qualité structurale forte : tous les champs essentiels sont renseignés.
- Dette P1 : 444 formulations génériques; 141 groupes de titres répétés; 49 groupes de textes identiques. La répétition peut refléter trois techniques d'audit mais doit être rendue explicite.
- FDA : bonne mise à niveau QMSR dans les données versionnées.
- MDSAP : processus présents, packs pays trop minces.
- SaMD/LATAM : insuffisance structurelle.
- Gouvernance : établir un export canonique daté de production et comparer les clés à Git avant chaque release.

## 4. Top 30 fonctionnalités

| # | Fonctionnalité | Mention | Valeur | Complexité | Priorité |
|---:|---|---|---:|---|---|
| 1 | Analytics alimentées uniquement par agrégats réels | 4–10 profils | 7–10 | M à XL | P0 |
| 2 | Audit trail + signatures Part 11/eIDAS | 4–10 profils | 7–10 | M à XL | P0 |
| 3 | Graphe exigence-preuve-risque-NC-CAPA | 4–10 profils | 7–10 | M à XL | P0 |
| 4 | Document control | 4–10 profils | 7–10 | M à XL | P0 |
| 5 | RBAC tenant/site | 4–10 profils | 7–10 | M à XL | P0 |
| 6 | Mode classe III / IVDR C-D | 4–10 profils | 7–10 | M à XL | P0 |
| 7 | Complaint→MDR decision tree | 4–10 profils | 7–10 | M à XL | P0 |
| 8 | Chaîne CER-PMCF-PSUR | 4–10 profils | 7–10 | M à XL | P0 |
| 9 | Programme sauvegarde/restauration surveillé | 4–10 profils | 7–10 | M à XL | P0 |
| 10 | Validation live CAPA/PDF | 4–10 profils | 7–10 | M à XL | P0 |
| 11 | Audit combiné multi-référentiels | 4–10 profils | 7–10 | M à XL | P1 |
| 12 | Mapping juridictionnel | 4–10 profils | 7–10 | M à XL | P1 |
| 13 | Training/compétences | 4–10 profils | 7–10 | M à XL | P1 |
| 14 | Supplier management | 4–10 profils | 7–10 | M à XL | P1 |
| 15 | Programme annuel d'audit | 4–10 profils | 7–10 | M à XL | P1 |
| 16 | Workflow/escalade configurable | 4–10 profils | 7–10 | M à XL | P1 |
| 17 | Module SaMD IEC 62304 | 4–10 profils | 7–10 | M à XL | P1 |
| 18 | Cybersécurité/SBOM | 4–10 profils | 7–10 | M à XL | P1 |
| 19 | Données IA/ML et changements | 4–10 profils | 7–10 | M à XL | P1 |
| 20 | Module performance IVDR | 4–10 profils | 7–10 | M à XL | P1 |
| 21 | Packs PMDA/TGA/Health Canada | 4–10 profils | 7–10 | M à XL | P1 |
| 22 | Packs LATAM | 4–10 profils | 7–10 | M à XL | P1 |
| 23 | Interface/exports anglais | 4–10 profils | 7–10 | M à XL | P1 |
| 24 | Version/licence des normes | 4–10 profils | 7–10 | M à XL | P1 |
| 25 | Mode apprentissage | 4–10 profils | 7–10 | M à XL | P2 |
| 26 | Offline/PWA | 4–10 profils | 7–10 | M à XL | P2 |
| 27 | Langues locales | 4–10 profils | 7–10 | M à XL | P2 |
| 28 | Tarification émergente | 4–10 profils | 7–10 | M à XL | P2 |
| 29 | Intégrations Jira/Git | 4–10 profils | 7–10 | M à XL | P2 |
| 30 | Benchmark anonymisé | 4–10 profils | 7–10 | M à XL | P2 |

## 5. Vision mondiale

QARA doit devenir un graphe de conformité vivant : une exigence officielle versionnée, des preuves réutilisables, des risques, constats et CAPA liés, des variantes pays, et un « regard auditeur » explicable. Son avantage n'est pas une checklist supplémentaire, mais la réduction de l'écart entre texte, preuve et décision.

## 6. Feuille de route

**0–30 jours :** retirer/étiqueter toute donnée analytique de démonstration; réconcilier 473/485/426; exécuter CAPA/PDF live; corriger le build hermétique; mettre audit trail/signature au cadrage. **1–3 mois :** evidence graph, audit combiné, classe III/IVDR, QMSR inspection readiness, SaMD initial. **3–12 mois :** document control, training, fournisseurs, packs pays prioritaires, anglais. **3 ans :** plateforme multi-juridictionnelle prédictive, avec partenaires réglementaires locaux.

## 7. Unique et irremplaçable

Le positionnement unique crédible : « QARA pense comme un auditeur, exige une preuve, explique pourquoi elle suffit ou non, puis mesure l'efficacité ». Ce positionnement exige l'abandon des chiffres de démo en production et une traçabilité électronique opposable.

## 8. Signatures

Les dix noms correspondent à des **personas simulées**. Aucune signature professionnelle, FDA, IRCA ou organisme notifié n'est revendiquée. Approbation réelle requise auprès d'experts indépendants nommés et contractés.

## Décision et critères de sortie

GO full seulement après : zéro donnée de démo non étiquetée; corpus production réconcilié à 100 %; CAPA+PDF+audit complet réussis sur les 7 référentiels; audit trail/signatures validés selon périmètre; 14 jours sans P0; >95 % des parcours critiques; trois pilotes terminant audit+CAPA+PDF.
