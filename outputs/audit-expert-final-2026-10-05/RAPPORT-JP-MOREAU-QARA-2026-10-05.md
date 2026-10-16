# Rapport Jean-Pierre Moreau — ISO 9001 / PME

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

## 1. Verdict PME

ISO 9001 **7,8/10**; double certification **5,9/10**; utilisable pour une PME après ajout d'un audit combiné et d'un accompagnement.

## 2. ISO 9001 exhaustif

44 questions, 35 processus; contexte §4, leadership §5, risques/opportunités §6 et amélioration sont présents. 41 formulations génériques doivent être adaptées au vocabulaire PME. Les références sont 2015/Amd.1:2024, sans signal 2008 détecté par l'inventaire.

## 3. Cohérence inter-référentiels

Les champs `mappings` existent dans le corpus, mais aucun parcours UI combiné ISO 9001↔ISO 13485 n'a été démontré. Risque actuel : doubler questions et preuves au lieu de mutualiser.

## 4. Valeur PME

Proposer un diagnostic initial de 60 minutes, un audit combiné, une bibliothèque de preuves, un CAPA guidé « objectifs qualité §6.2 », un plan 90 jours et un rapport direction en langage simple.
