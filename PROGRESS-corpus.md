# QARA Backend - Deblocage du corpus de questions

Branche : `claude/qara-backend-corpus`
Base : `main` au commit `8330bd4a05fe53d5fb454ddbf78a9f5159a235cd`
Date : 2026-07-09

Objectif : debloquer le corpus de questions de la plateforme QARA sans toucher a la production sans feu vert explicite.

## Regles de ce lot

- Production Railway : aucune ecriture executee par Codex.
- Migrations : additives uniquement si necessaires.
- Distinction stricte : `importe` signifie `verifie en base`, jamais suppose.
- Frontend : hors perimetre.
- Correction metier hors corpus : hors perimetre sauf blocage direct du test bout-en-bout.

## Phase 0 - Diagnostic initial

Statut : en cours, diagnostic code realise, preuve DB locale non executee dans cet environnement.

### 0.1 Alignement Git

- Depot cible confirme : `Nickandro96/Backend---QARA`.
- Branche par defaut : `main`.
- `main` pointe sur le commit `8330bd4a05fe53d5fb454ddbf78a9f5159a235cd`, merge du lot securite/persistance recent.
- Branche creee depuis `main` : `claude/qara-backend-corpus`.
- Comparaison `main..claude/qara-backend-corpus` avant ce journal : identique, 0 commit d'ecart.
- Pas de force-push.
- Note environnement : le clone Git local echoue avec `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`. Le travail Phase 0 a donc ete fait via le connecteur GitHub Codex. Ce commit cree uniquement ce journal.

### 0.2 Etat du schema `questions` courant

Source lue : `drizzle/schema.ts` + migration `drizzle/migrations/0015_questions_unify_risk_drop_risks.sql`.

Colonnes actuelles pertinentes de `questions` :

- `referentialId`
- `processId`
- `questionKey`
- `article`
- `annexe`
- `title`
- `economicRole`
- `applicableProcesses`
- `questionType`
- `questionText`
- `expectedEvidence`
- `criticality`
- `risk`
- `interviewFunctions`
- `actionPlan`
- `aiPrompt`
- `displayOrder`
- `createdAt`

Constat demontre : la colonne `risks` n'existe plus dans le schema courant. La migration `0015_questions_unify_risk_drop_risks.sql` backfill `risk` depuis `risks` quand `risk` est vide, puis supprime `risks`. Le schema courant fait donc foi : la cible legitime est `risk`.

La migration `0009_dedupe_and_unique_questionKey.sql` ajoute une contrainte unique `uq_questions_questionKey` apres deduplication. Les imports doivent donc etre rejouables via `questionKey`, pas par doublonnage.

### 0.3 Etat du corpus local

Non execute dans cet environnement.

Raison : aucun client/serveur MySQL ou MariaDB et aucun Docker disponible dans le workspace courant (`mysql`, `mysqld`, `mariadb`, `docker` introuvables). Le depot complet n'a pas pu etre clone localement a cause de l'erreur d'authentification Windows ci-dessus. Aucune base Railway/prod n'a ete touchee.

A faire des qu'un environnement DB local est disponible : appliquer les migrations `0000` a `0018`, puis executer les requetes de comptage ci-dessous. Tant que ce n'est pas fait, l'etat DB local reste `non demontre`.

### 0.4 Requetes lecture seule a executer sur production Railway

Ces requetes ne modifient rien. Elles servent a etablir l'etat reel du corpus en production.

```sql
SELECT
  COALESCE(r.code, CONCAT('referentialId:', q.referentialId)) AS referential_code,
  COALESCE(r.name, '') AS referential_name,
  COUNT(*) AS question_count,
  SUM(CASE WHEN q.questionKey IS NULL OR q.questionKey = '' THEN 1 ELSE 0 END) AS missing_question_key,
  SUM(CASE WHEN q.questionText IS NULL OR q.questionText = '' THEN 1 ELSE 0 END) AS missing_question_text,
  SUM(CASE WHEN q.risk IS NULL OR q.risk = '' THEN 1 ELSE 0 END) AS missing_risk,
  SUM(CASE WHEN q.processId IS NULL THEN 1 ELSE 0 END) AS missing_process_id
FROM questions q
LEFT JOIN referentiels r ON r.id = q.referentialId
GROUP BY q.referentialId, r.code, r.name
ORDER BY q.referentialId;
```

Verification schema production :

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'questions'
ORDER BY ORDINAL_POSITION;
```

Verification de l'ancienne colonne supprimee :

```sql
SELECT COUNT(*) AS has_legacy_risks_column
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'questions'
  AND COLUMN_NAME = 'risks';
```

### 0.5 Inventaire scripts et workflows d'import

#### `scripts/import-mdr-questions.js`

Source de donnees : `data/MDR_questionnaire_V7_CORRIGE.xlsx`.

Constats :

- Ecrit explicitement dans `risk` et `risks`.
- Met `risk: null` et met le contenu Excel `Risque en cas de NC` dans `risks`.
- Depuis la migration `0015`, `risks` n'existe plus : ce script echoue sur schema courant.
- `TRUNCATE TABLE questions` : supprime tout le corpus, tous referentiels confondus. Dangereux pour FDA/ISO si rejoue apres d'autres imports.
- Hardcode `referentialId: 1` pour MDR.
- Pas idempotent au sens attendu : il remplace toute la table au lieu d'upsert par `questionKey`.

Diagnostic : script legacy casse et destructif. Ne doit pas etre utilise en production tel quel.

#### `scripts/import_questions_from_excel.py`

Source de donnees : `data/MDR_questionnaire_V7_CORRIGE.xlsx`.
Workflow : `.github/workflows/import-questions-from-excel.yml`.

Constats :

- Introspecte les colonnes de `questions` et evite d'inserer une colonne absente.
- Ecrit dans `risk` si `risk` existe ; ecrit aussi dans `risks` seulement si `risks` existe. Donc il ne casse pas directement sur la suppression de `risks`.
- Supprime toutes les questions via `DELETE FROM questions`, sans limiter a MDR. Cela peut effacer FDA/ISO.
- Ne fait pas d'upsert par `questionKey`; il recharge apres suppression.
- Cree des processus manquants par nom, ce qui peut deriver des 15 processus canoniques si les libelles Excel different.
- Le workflow renseigne `REFERENTIAL_ID=1`, mais le script lit `DEFAULT_REFERENTIAL_ID` et tombe par defaut sur `1`; cela fonctionne par chance pour MDR mais reste incoherent.

Diagnostic : script MDR moins casse que le JS sur `risks`, mais destructif et non conforme a l'exigence idempotente.

#### `scripts/import-questionnaires.ts`

Source de donnees : `data/Questionnaires audits FDA - tous les ref.xlsx`.
Workflow : `.github/workflows/import-fda-questions.yml`.

Constats :

- Utilise le schema Drizzle courant et n'ecrit que `risk`, pas `risks`.
- Upsert logique par `questionKey` : `select existing`, puis update ou insert.
- Ne purge pas toute la table.
- Depend des codes `referentiels.code` : `FDA_QSR_21CFR820` et `FDA_US_MARKET_ACCESS`.
- La migration `0017_fda_foundation.sql` insere ces deux codes dans `referentiels` si absents.

Diagnostic : chemin FDA globalement aligne avec le schema courant et le plus proche de l'idempotence demandee. A tester localement.

#### `scripts/import_iso_questions_from_excel.py`

Sources de donnees :

- `data/Questionnaires audits iso 9001.xlsx`
- `data/Questionnaires audits iso 13485.xlsx`

Workflows :

- `.github/workflows/import-iso9001-questions.yml`
- `.github/workflows/import-iso13485-questions.yml`

Constats :

- Erreur de syntaxe demontree dans le bloc `if "risk" in q_cols:` : indentation invalide autour du commentaire et du `if q_cols["risk"] == "risks"`. Les workflows ISO ne peuvent pas executer ce script en l'etat.
- Le script cherche une table `referentials`, alors que le schema courant definit `referentiels`. Il echouera donc aussi sur schema courant si `referentials` n'existe pas.
- La detection de colonne risque accepte `risk` ou `risks`; apres correction syntaxe/table, la cible devrait etre `risk`.
- La purge est limitee au referentiel (`DELETE FROM questions WHERE referentialId = %s`), ce qui est moins dangereux que la purge globale MDR.
- Pas encore idempotent par upsert : il supprime le referentiel puis insere.

Diagnostic : chemin ISO actuellement casse avant import. A corriger en Phase 1.

#### `scripts/import_iso_update.py`

Workflow : `.github/workflows/import_iso.yml`.

Constats :

- Ce n'est pas un import complet : il met a jour les champs manquants (`risk`, `expectedEvidence`) sur des questions ISO deja presentes.
- Utilise `questionKey` et `referentialId` pour retrouver les lignes.
- Ne peut pas remplir une table vide.

Diagnostic : outil de patch utile apres import, mais ne resout pas le corpus vide.

#### `scripts/patch_iso_risks_from_excel.py` et `scripts/patch_iso_risks_from_excel_v2.py`

Workflow principal : `.github/workflows/patch-iso-risks.yml`.

Constats :

- UPDATE only, pas d'insert.
- Detecte `risk` et/ou `risks`. Sur schema courant, il mettra a jour `risk`.
- Ne peut pas remplir une table vide.

Diagnostic : patch secondaire, pas import principal.

#### `.github/workflows/patch_risks.yml`

Constat : reference `scripts/patch_risks_from_excel_generic.py`, mais ce fichier est introuvable dans le depot (`404` via GitHub Contents API).

Diagnostic : workflow casse.

### 0.6 Routeurs de lecture des questions

#### MDR

Point d'entree lu : `server/mdr-router.ts`, `getQuestionsForAudit`.

Constats :

- Charge d'abord depuis DB (`questions`).
- Filtre par `referentialIds`, role economique, puis processus via logique OR : `processId` OU `applicableProcesses` vide/null OU `JSON_CONTAINS(applicableProcesses, candidate)`.
- Si le filtre role retourne 0, fallback sans filtre role.
- Retourne `risk` et normalise aussi un payload `risks` pour compatibilite front.

Diagnostic : si MDR est importe avec `referentialId=1`, `questionKey`, `questionText`, `risk`, `applicableProcesses` coherents, le routeur devrait renvoyer des questions. Le blocage actuel est prioritairement cote import/corpus.

#### ISO

Point d'entree lu : `server/iso-router.ts`, `getQuestionsForAudit`.

Constats :

- Filtre par `referentialId`, puis processus via `processId` et `applicableProcesses`.
- Retourne `risk` et normalise un payload compatible `risks`.

Diagnostic : le routeur peut fonctionner, mais le chemin d'import ISO principal est casse.

#### FDA

Point d'entree lu : `server/fda-router.ts`, `getQuestions`.

Constats :

- Lit les questions par `referentialId` resolu depuis `referentiels.code`.
- Filtre le role economique seulement si fourni et different de `all`.
- Les referentiels FDA sont seedes par `0017_fda_foundation.sql`.

Diagnostic : le chemin FDA est le plus sain a premiere lecture, sous reserve de test local.

## Diagnostic annonce avant correctif

Synthese Phase 0 :

1. Le diagnostic `risks` est confirme pour au moins le script legacy MDR JS : il ecrit dans une colonne supprimee.
2. Le schema courant impose `risk`, pas `risks`.
3. Le workflow MDR actif utilise plutot le script Python, qui contourne `risks`, mais il purge toute la table `questions` et n'est pas idempotent.
4. Les workflows ISO 9001/13485 sont bloques par une erreur de syntaxe dans `scripts/import_iso_questions_from_excel.py` et par un nom de table incorrect (`referentials` au lieu de `referentiels`).
5. Le workflow `patch_risks.yml` est casse car il appelle un fichier absent.
6. Les routeurs de lecture MDR/ISO/FDA semblent capables de renvoyer des questions si le corpus est charge avec des `referentialId`, `questionKey`, `processId`/`applicableProcesses` coherents.
7. Les comptes reels en base restent a prouver : aucun comptage local n'a ete execute dans cet environnement faute de MySQL/MariaDB/Docker, et aucune lecture production n'a ete effectuee par Codex.

## Plan Phase 1 propose

Avant toute ecriture production :

1. Corriger les scripts pour cibler uniquement `risk`.
2. Rendre MDR idempotent et non destructif pour FDA/ISO : upsert par `questionKey`, purge limitee MDR uniquement si necessaire et documentee.
3. Corriger ISO : indentation, `referentiels`, upsert par `questionKey`, rattachement aux processus existants.
4. Supprimer ou reparer le workflow casse `patch_risks.yml`.
5. Ajouter des checks locaux/CI de type dry-run + comptage par referentiel.
6. Tester en local des qu'une base MySQL/MariaDB est disponible : import puis appel equivalent `getQuestionsForAudit`.
