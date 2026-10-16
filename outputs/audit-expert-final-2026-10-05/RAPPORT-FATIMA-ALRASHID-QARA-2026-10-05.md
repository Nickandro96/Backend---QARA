# Rapport Fatima Al-Rashid — ISO 13485 / multi-marchés

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

## 1. Verdict

ISO 13485 **7,9/10**; ergonomie internationale **5,8/10**; recommandation multi-marchés **conditionnelle**.

## 2. ISO 13485 exhaustif

93 questions, 59 processus, références/preuves/pédagogie/gradation renseignées à 100 %. §5.6, §7 et §8 sont présents. Les 87 formulations génériques détectées réduisent toutefois le pouvoir discriminant métier. Les sources reposent légitimement sur un texte normatif fourni, mais le produit doit afficher version, licence et date de vérification.

## 3. Marchés émergents

CCG/SFDA/DOH/Inde/Afrique ne sont pas couverts de manière démontrable par le corpus. Ajouter packs juridictionnels maintenus, mappings et échéanciers.

## 4. Top 10 multi-marchés

Interface/rapport anglais, packs pays, mapping entre référentiels, profils importateur/distributeur/mandataire, calendrier réglementaire, traduction contrôlée, preuves réutilisables, tableaux consolidés réels, revue locale, export bilingue.

## 5. Vision

La valeur mondiale vient d'une même preuve réutilisée avec des écarts locaux explicites, pas d'une juxtaposition de questionnaires.
