# Rapport Sarah O'Brien — FDA QMSR

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

## 1. Verdict FDA

Note corpus FDA QMSR : **7,8/10**. Les 43 questions ont une référence, une preuve et une source FDA/eCFR. Le détecteur n'a trouvé aucune référence ancienne §820.30/50/70/75/100/198 dépourvue de contexte QMSR/ISO 13485. Le QMSR est effectif depuis le 2 février 2026 et l'inspection FDA suit désormais CP 7382.850; la terminologie produit doit refléter ce changement.

## 2. Évaluation exhaustive

Le CSV couvre les 43 lignes. Points forts : applicability, incorporation ISO 13485, MDR reporting, corrections/removals, registration/listing, 510(k), UDI, De Novo, complaint→MDR→CAPA, supplier et software/cyber. À renforcer : Part 11 et signatures électroniques; procédure for-cause; distinction record review pré/post-2026; délais et preuves de 21 CFR 803; lien Part 807; scénario de vérification d'efficacité CAPA mesurable.

## 3. QARA face aux eQMS US

Avantage : corpus prêt à l'emploi, pédagogie, CAPA assistée et rapport. Lacunes : document control, training, e-signature Part 11, validation informatique, audit trail et workflow configurables.

## 4. Top 5 FDA

1. Signature Part 11 et audit trail (P0). 2. Inspection readiness CP 7382.850 (P0). 3. Complaint/MDR decision tree (P0). 4. Design-history traçable ISO 13485/QMSR (P1). 5. Dossier réponse 483 avec échéance/efficacité (P1).

## 5. Vision US

Commercialisation US conditionnelle à la validation des workflows électroniques, au mapping officiel QMSR et à une contre-recette live complaint→MDR→CAPA→rapport.
