# Rapport consolidé — double audit expert QARA

Date : 5 octobre 2026  
Nature : contre-recette interne par personas simulées, sans valeur de certification FDA, IRCA ou organisme notifié.

## Décision

**NO-GO commercial full. GO conditionnel limité à des pilotes encadrés.**

Les deux protocoles ont été appliqués séparément puis rapprochés. Ils convergent sur un socle technique prometteur, mais plusieurs preuves exigées pour une commercialisation large et une promesse eQMS opposable restent absentes.

## Résultats communs

- Backend : 186 tests réussis sur 186, aucun échec.
- Corpus versionné : 473 questions et 473 identifiants uniques, répartis sur 7 référentiels et 233 couples référentiel-processus.
- Structure du corpus : références, preuves attendues, critères de conformité et éléments pédagogiques présents sur les 473 lignes.
- Dix revues/personas produites dans chacun des deux protocoles.
- Aucun secret consulté, copié ou enregistré; aucun paiement et aucune suppression de données.
- Le build local n'est pas reproductible dans cet environnement, car `node_modules/esbuild` pointe vers un ancien workspace; cela constitue une dette d'outillage, pas la preuve d'un défaut du déploiement.

## Bloquants P0

1. **Corpus canonique non réconcilié** : 426 questions annoncées dans un prompt, 473 dans Git et 485 dans une preuve récente de production/restauration. Les écarts doivent être expliqués clé par clé.
2. **Analytique non opposable** : la navigation des vues fonctionne, mais certaines valeurs, sites et constats sont encore codés en dur ou démonstratifs. Ils doivent être alimentés par des agrégats backend réels ou explicitement étiquetés comme démonstration.
3. **Parcours live incomplets** : création d'audit, réponse complète, clôture, CAPA et PDF n'ont pas été rejoués sur les 7 référentiels lors de cette passe connectée.
4. **Stabilité non acquise** : les 14 jours sans P0 ne peuvent pas être déclarés au 5 octobre. Un suivi quotidien est actif jusqu'au 19 octobre 2026.
5. **Trois pilotes non prouvés dans cette passe** : il manque trois PV distincts démontrant audit complet + CAPA + PDF avec un taux de réussite supérieur à 95 %.
6. **Sauvegardes insuffisamment industrialisées** : une restauration ponctuelle avec RTO 2,22 min, RPO 10,06 min et concordance de six tables est prouvée; la planification, la rétention hors service principal, le contrôle anti-fichier vide, le manifeste SHA-256 et l'alerte d'échec sur 14 jours restent à démontrer.

## Dette P1 majeure

- Double validation humaine du corpus réglementaire non réalisée.
- 49 groupes de textes strictement identiques couvrent 99 lignes; ils doivent être justifiés comme variantes/crosswalks ou fusionnés.
- 93 lignes ont une source officielle ou un statut de vérification insuffisamment explicite selon la grille du premier audit.
- Les packs SaMD, LATAM et certains pays MDSAP restent trop faibles pour une promesse mondiale.
- Audit trail, signatures électroniques, gouvernance documentaire et RBAC multi-site doivent être cadrés selon le périmètre commercial revendiqué.

## Positionnement recommandé

QARA peut être proposé à court terme comme outil encadré de diagnostic, de préparation d'audit et de pilotage qualité. Il ne doit pas encore être vendu comme remplacement complet et opposable d'un eQMS mondial.

La différenciation à construire est le **QARA Evidence Graph** : Exigence → Processus → Risque → Question → Preuve → Constat → CAPA → Efficacité → Indicateur → Revue de direction, avec crosswalk multi-référentiels et indice de confiance des preuves.

## Conditions cumulatives du GO full

- zéro donnée analytique de démonstration non étiquetée;
- réconciliation à 100 % des corpus 426/473/485;
- parcours audit + CAPA + PDF réussi sur les 7 référentiels;
- plus de 95 % de réussite des parcours critiques;
- trois organisations pilotes ayant terminé audit + CAPA + PDF;
- sauvegardes automatiques, hors service principal, contrôlées et alertées;
- 14 jours sans P0;
- validation humaine des questions critiques et décision formelle signée.

## Sources internes

- Audit intégral : `outputs/audit-integral-2026-10-05/`
- Audit expert final : `outputs/audit-expert-final-2026-10-05/`
- Matrices exhaustives : `03-MATRICE-QUESTIONS-QARA.csv` et `corpus-question-by-question.csv`
- Rapports de décision : `00-SYNTHESE-DIRECTION-QARA.md` et `RAPPORT-AUDIT-MONDIAL-QARA-10-EXPERTS-2026-10-05.md`

