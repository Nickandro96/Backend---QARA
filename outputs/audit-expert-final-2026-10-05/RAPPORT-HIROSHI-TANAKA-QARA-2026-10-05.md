# Rapport Hiroshi Tanaka — MDSAP / ISO 14971

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

## 1. Verdict MDSAP

MDSAP **7,3/10**; ISO 14971 **7,7/10**. Corpus MDSAP : 74 questions et 10 groupes de processus. Le champ « NC Grading » existe, mais l'interface n'a pas été démontrée comme implémentant opérationnellement le grading réglementaire. Couverture fonctionnelle des grands processus : présente; profondeur pays par pays : partielle.

## 2. Analyse par processus

Management (12), Measurement/Analysis/Improvement (12), Design (15), Production/Service (8), Purchasing (7), Market authorization/facility registration (6), adverse events/advisory notices (10), linkage (1), grading (1), country-specific (2). Le prompt parle de sept chapitres, tandis que le modèle officiel actuel est process-based : conserver la terminologie officielle et versionner le modèle.

## 3. Marchés

Le corpus mentionne trois signaux multi-marchés et quatre LATAM : insuffisant pour démontrer une couverture opérationnelle PMDA, TGA, ANVISA, Health Canada. Ajouter matrices pays, formulaires, délais, langue, responsables locaux et preuves de soumission.

## 4. Vision multi-marchés

Un « regulatory graph » exigence commune ↔ variante pays ↔ preuve unique éviterait la ressaisie tout en conservant la traçabilité juridictionnelle.
