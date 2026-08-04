# QARA — Procédure de mise en production du corpus validé

**Statut : préparation uniquement. Point de contrôle B obligatoire.**  
Base autorisée : Railway **new-claude**, base `railway`, hôte attendu
`turntable.proxy.rlwy.net:32678`. Ne jamais utiliser l'environnement `production` / metro.

## Préconditions bloquantes

1. Confirmer que `DATABASE_URL` de **new-claude** cible bien turntable/railway.
2. Confirmer que `IMPORT_CORPUS_ON_RELEASE` est absent ou différent de `1`.
3. Prendre une sauvegarde récupérable de la base, au minimum de `questions` et des tables
   `audit_responses` liées.
4. Noter l'heure, la taille et l'emplacement de la sauvegarde.
5. Exécuter les contrôles en lecture seule :

```sql
SELECT DATABASE() AS base_active;
SELECT COUNT(*) AS total, COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;
SELECT COUNT(*) AS tronquees_question FROM questions WHERE questionText LIKE '%…%';
SELECT COUNT(*) AS titres_250 FROM questions WHERE CHAR_LENGTH(title) = 250;
SELECT COUNT(*) AS sources_presentes FROM questions WHERE questionTextSource IS NOT NULL;
SELECT questionKey, COUNT(*) AS n FROM questions GROUP BY questionKey HAVING COUNT(*) > 1;
```

Valeurs attendues avant correction : 473 lignes, 473 clés distinctes, probablement 45 questions
tronquées et 24 titres de longueur 250. Les chiffres réels priment ; arrêter si le total ou les
clés ne correspondent pas.

## Ordre obligatoire

### 1. Déployer le garde-fou technique

Fusionner la PR #5 uniquement après la sauvegarde. Vérifier dans les logs Railway :

- release terminé ;
- message `Corpus import skipped (explicit approval flag not set)` ;
- aucune exécution de `import-corpus.mjs` ;
- service sain et `/trpc/iso.getStandards` répond.

Arrêter immédiatement si l'import du corpus apparaît dans les logs.

### 2. Déployer les sources validées sans import

Rebaser/actualiser la PR #6 après #5, vérifier que sa comparaison ne réintroduit pas l'ancien
`package.json`, puis la fusionner. Vérifier de nouveau le message de corpus ignoré et la santé du
service. Cette étape place le JSON validé dans le code sans écrire les 45/24 en base.

### 3. Exécuter les SQL séparés, un bloc à la fois

Dans l'éditeur Railway de **new-claude**, dans cet ordre :

1. `scripts/output/backfill-question-text-source.sql` — archive les 171 originaux si la source est NULL ;
2. `scripts/output/editorial-pass.sql` — archive l'ancien texte si nécessaire puis applique les 45 questions ;
3. `scripts/output/title-fixes.sql` — applique les 24 titres validés.

Ne pas exécuter `final-pass.sql`, conservé uniquement comme artefact consolidé historique.

## Vérifications finales

```sql
SELECT COUNT(*) AS total, COUNT(DISTINCT questionKey) AS cles_distinctes FROM questions;
SELECT COUNT(*) AS tronquees_question FROM questions WHERE questionText LIKE '%…%';
SELECT COUNT(*) AS titres_250 FROM questions WHERE CHAR_LENGTH(title) = 250;
SELECT COUNT(*) AS sources_presentes FROM questions WHERE questionTextSource IS NOT NULL;
SELECT questionKey, COUNT(*) AS n FROM questions GROUP BY questionKey HAVING COUNT(*) > 1;
```

Attendu : 473 / 473, 0 question tronquée, 0 titre de longueur 250, aucune clé dupliquée.
Le nombre de sources doit être documenté à partir de la valeur réelle avant/après ; ne pas écraser
une source existante.

## Retour arrière

En cas d'écart :

1. ne lancer aucun nouvel import ni déploiement ;
2. conserver les logs et résultats des requêtes ;
3. restaurer `questions` depuis la sauvegarde validée selon la procédure Railway ;
4. vérifier 473 lignes / 473 clés et un échantillon d'`audit_responses` ;
5. ne jamais modifier `questionKey`.
