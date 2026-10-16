# Rapport Amara Diallo — MDR / IVDR

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

## 1. Verdict BSI simulé

| Domaine | Note | Verdict |
|---|---:|---|
| MDR | 7,6/10 | Couverture réglementaire large; spécificité classe III encore insuffisamment explicite. |
| IVDR | 7,5/10 | Bon socle, mais EQA, bases de référence et PMPF doivent devenir des sous-parcours visibles. |
| Outil | 6,8/10 | Conditionnel avant usage de préparation ON : analytique non probante et essais CAPA/PDF live non exécutés. |

Recommandation fabricant classe III : **CONDITIONNELLE**.

## 2. Évaluation exhaustive MDR (80 lignes)

Le détail question par question est dans le CSV. Points forts : Art. 10/UDI/PRRC/PMS/vigilance/GSPR/documentation technique couverts, références et preuves présentes. Points à reformuler : remplacer les canevas génériques par des questions ciblées classe III demandant CEAP, CER, PMCF, PSUR annuel, SSCP, communication ON et traçabilité implant. Ajouter un critère explicite : NC majeure si absence systémique ou impact patient/réglementaire non maîtrisé; mineure si dossier ponctuellement incomplet avec impact maîtrisé.

## 3. Évaluation exhaustive IVDR (72 lignes)

Performance evaluation, études, PMS, PSUR, vigilance et classification existent. Rendre explicites PSP/PSR, performance analytique et clinique, PMPF, EQA, représentativité des bases et RSP. Éviter les formulations transposées du MDR sans terminologie IVD.

## 4. Fonctionnalités manquantes BSI — Top 10

1. Dossier de preuves par exigence (8 h/audit, P0). 2. Mode classe III (6 h, P0). 3. Chaîne CER–PMCF–PSUR–risques (8 h, P0). 4. Grille NC NBOG (3 h, P1). 5. Échantillonnage documenté (2 h, P1). 6. Calendrier obligations classe/acteur (4 h, P1). 7. Revue ON avec verrouillage (3 h, P1). 8. Matrice GSPR (6 h, P1). 9. Exports de preuves (4 h, P1). 10. Historique opposable et signatures (5 h, P0).

## 5. Vision

QARA deviendrait indispensable s'il reliait chaque réponse à une preuve, une exigence exacte, un risque, une action et une décision de clôture, avec un mode de préparation ON spécifique à la classe du dispositif et sans métriques de démonstration présentées comme réelles.
