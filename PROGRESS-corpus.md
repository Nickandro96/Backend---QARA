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

## Phase 0bis — Reprise, confirmation, environnement local (2026-07-10)

Statut : termine.

### Environnement local : POSSIBLE, monte avec succes

Contrairement a la session precedente (bloquee : ni MySQL/MariaDB/Docker, ni clone Git a cause d'une erreur d'authentification Windows), cette session a pu monter un environnement complet :

- MariaDB installee localement (`apt-get install mariadb-server`), base `qara_local` dediee (deja utilisee lors des lots backend precedents sur ce meme depot).
- `drizzle-kit push --force` (schema complet) puis rejeu de toutes les migrations `0000` a `0018` via `mysql --force --default-character-set=utf8mb4` (voir plus bas pourquoi `--force` et `--default-character-set=utf8mb4` sont critiques, pas de simples details de confort).
- Dependances Python installees (`pip install pandas mysql-connector-python openpyxl`) pour executer reellement les scripts d'import Python, pas seulement les lire.
- Backend Node local lance (`tsx server/_core/index.ts`) pour appeler reellement `mdr.getQuestionsForAudit` en bout-en-bout, pas seulement verifier des comptages SQL.

**Consequence : toutes les preuves de ce lot sont demontrees (executees reellement contre une base locale), pas seulement raisonnees sur lecture de code.**

### Diagnostic Phase 0 (Codex) confirme point par point

Tous les points du diagnostic initial ont ete confirmes exacts par lecture directe du code (aucun n'a du etre corrige) :

1. `questions.risk` (singulier) est bien la seule colonne du schema courant ; `risks` a bien ete supprimee par la migration 0015. Confirme.
2. `scripts/import-mdr-questions.js` : confirme casse (ecrit encore dans `risk` ET `risks`) et destructif (`TRUNCATE TABLE questions` inconditionnel, verifie ligne 193 du fichier avant correction).
3. `scripts/import_questions_from_excel.py` : confirme — introspection de schema evite bien d'ecrire dans `risks` (absente), mais fait un `DELETE FROM questions` global inconditionnel (verifie ligne 318 avant correction), et n'est pas un upsert.
4. `scripts/import_iso_questions_from_excel.py` : confirme — erreur d'indentation Python reelle (verifiee : le bloc autour de `if q_cols["risk"] == "risks":` n'etait pas un Python valide), et `ensure_referential_exists` interroge bien la table `referentials` (absente sur le schema courant, qui a `referentiels`).
5. `.github/workflows/patch_risks.yml` : confirme — appelle `scripts/patch_risks_from_excel_generic.py`, fichier absent du depot (verifie par recherche complete dans `scripts/`).
6. FDA (`scripts/import-questionnaires.ts`) : confirme le plus propre — verification ligne par ligne : upsert reel par `questionKey` (select puis update/insert), aucune suppression, n'ecrit que `risk`. **Aucune modification necessaire.**

### Trois decouvertes supplementaires, non presentes dans le diagnostic initial (trouvees uniquement grace au test local reel)

Le diagnostic initial (fait sans base locale) ne pouvait pas les detecter : elles ne se revelent qu'a l'execution.

**A. Bug d'encodage caracteres (utf8mb4) — corrige.**
Les deux scripts Python (`mysql.connector.connect(...)`) ne precisaient aucun `charset`. Premiere execution locale : les processus crees a la volee (voir point B) avaient des noms illisibles (`Gouvernance & strat�gie r�glementaire`). Diagnostic : le connecteur negociait un charset different d'utf8mb4 par defaut dans cet environnement. Corrige en ajoutant explicitement `charset="utf8mb4", use_unicode=True` aux deux connexions. Verifie apres correction : noms de processus lus/ecrits correctement partout.

**B. `import_questions_from_excel.py` (MDR) : le role economique (Fabricant/Importateur/Distributeur/Mandataire) n'etait jamais lu — bug le plus important trouve dans ce lot.**
En executant reellement l'import, `Processed=826` mais seulement **566 lignes distinctes** en base (au lieu de 826). Investigation : l'Excel encode le role economique en **prefixe `[Fabricant]`/`[Importateur]`/`[Distributeur]`/`[Mandataire]` dans la colonne `Intitulé`** (confirme par inspection directe de 3 lignes partageant exactement la meme clause/processus/texte de question, ne differant que par ce prefixe et par `Fonctions interrogées`). Le script ignorait cette colonne : `economicRole` etait toujours ecrit `"all"`, et `gen_question_key` (le hash servant de cle unique) ne prenait en compte que `article|processus|texte`, **jamais le role** — ce qui, avec le passage a l'upsert (necessaire pour Phase 1), aurait fait fusionner silencieusement les 3-4 variantes de role d'une meme question en une seule ligne, perdant les autres roles. Corrige : nouvelle fonction `extract_economic_role()` qui parse le prefixe `[...]`, role desormais inclus dans le hash de `questionKey`, et `economicRole` ecrit avec la vraie valeur. Verifie : **826 lignes distinctes en base apres correction**, reparties `fabricant=550, importateur=125, distributeur=117, mandataire=34` — coherent avec le repere connu de ~826 questions MDR.

**C. `import_iso_questions_from_excel.py` : `header=2` etait faux pour les deux fichiers ISO — corrige.**
Premiere execution locale : 223/225 lignes ISO 9001 **toutes ignorees** ("missing process/question"). Investigation : inspection directe des deux fichiers Excel (`iso 9001` et `iso 13485`) montre que la vraie ligne d'en-tete est la **ligne 0**, pas la ligne 2 comme le code le supposait — `header=2` faisait sauter l'en-tete ET les 2 premieres lignes de donnees, puis traitait une ligne de donnees comme si c'etait l'en-tete (d'ou des noms de colonnes absurdes du type `'Gouvernance & stratégie réglementaire'` comme nom de colonne). Corrige en `header=0`. Verifie : **225/225 lignes ISO 9001 et 225/225 ISO 13485 importees**, 0 ignoree.

**Note de precaution — dette non traitee ici, hors perimetre strict de ce lot corpus :** en reconstituant l'environnement local, une premiere tentative (rejeu naif des migrations avec `mysql` simple, sans `--force`) a fait disparaitre 10 des 15 processus canoniques (`0011_processus_cleanup_keep_15.sql` les avait supprimes car leur `slug` n'avait jamais ete rempli, la migration `0010` ayant avorte silencieusement des sa premiere instruction `ALTER TABLE ADD COLUMN slug` en echec "colonne deja existante"). **Analyse : ceci est un artefact de la methode de reconstruction locale** (avoir pousse le schema Drizzle COMPLET actuel avant de rejouer les migrations historiques dans l'ordre, ce qui cree une collision qui n'a probablement jamais existe dans l'historique reel de deploiement, ou `slug` n'a ete declare dans `drizzle/schema.ts` qu'au meme commit que la migration qui le cree). **Ceci n'a pas ete confirme sur la production** et ne doit pas etre suppose casse. Le mecanisme sous-jacent est neanmoins une fragilite reelle de `scripts/apply-sql-migrations.ts` : en cas d'erreur DDL "deja existant" sur la PREMIERE instruction d'un fichier de migration, tout le fichier est annule (rollback) puis marque "deja applique" et saute entierement — y compris les instructions DML substantielles qui suivent dans le meme fichier. Requete de verification en lecture seule fournie en Phase 3 pour trancher sur l'etat reel de la production. **Non corrige ici** (durcir `apply-sql-migrations.ts` est hors perimetre "scripts d'import du corpus" ; a traiter dans un lot dedie si la verification production revele un probleme reel).

**D. Aucune migration ne seedait le referentiel MDR (id=1) — corrige (additif).**
Toutes les migrations et tous les scripts d'import supposent `referentialId=1` pour MDR (`audits.create` par defaut, `import_questions_from_excel.py` `DEFAULT_REFERENTIAL_ID=1`), mais **aucune migration ne cree jamais cette ligne** dans `referentiels` — contrairement a ISO (migration 0001, ids 2/3) et FDA (migration 0017, ids 4/5). Verifie sur reconstruction locale complete : `referentiels` ne contenait que 4 lignes (2,3,4,5), jamais 1. Impact reel limite : `server/mdr-router.ts` filtre directement sur l'entier `referentialId`, sans jointure vers `referentiels` — ce n'est donc pas la cause de "Aucune question trouvee", juste une incoherence de donnees (MDR n'a pas de nom/code affichable, contrairement a ISO/FDA). Corrige par une migration additive dediee : `drizzle/migrations/0019_seed_mdr_referentiel.sql` (`INSERT ... ON DUPLICATE KEY UPDATE`, meme pattern defensif que `0001_seed_iso_referentiels.sql`).

## Phase 1 — Correctifs appliques (2026-07-10)

Statut : termine. Detail des correctifs par script dans le message du commit `fix(corpus): scripts d'import additifs, idempotents, et corriges (MDR/ISO)`. Resume :

| Fichier | Correctifs |
|---|---|
| `scripts/import_questions_from_excel.py` (MDR) | Suppression `DELETE FROM questions` global -> upsert par `questionKey` (`INSERT ... ON DUPLICATE KEY UPDATE`) ; suppression ecriture `risks` ; `charset=utf8mb4` ; alias de 2 libelles de processus ; creation de processus desormais sure vis-a-vis de `slug NOT NULL` ; **`economicRole` et `questionKey` corriges pour lire le prefixe `[Role]` de `Intitulé`** (decouverte C ci-dessus) |
| `scripts/import_iso_questions_from_excel.py` (ISO 9001/13485) | `header=2` -> `header=0` (decouverte B) ; `referentials` -> `referentiels` (resolution dynamique) ; correction de l'IndentationError Python reelle ; suppression du `DELETE FROM questions WHERE referentialId=%s` -> upsert par `questionKey` ; `charset=utf8mb4` ; alias de processus |
| `scripts/import-questionnaires.ts` (FDA) | **Aucun changement** — verifie deja propre (upsert reel, aucune suppression, n'ecrit que `risk`) |
| `scripts/import-mdr-questions.js` | Marque `@deprecated`, refuse desormais de s'executer (`throw` explicite) au lieu d'etre silencieusement dangereux |
| `.github/workflows/patch_risks.yml` | Retire (script cible absent), remplace par un echec explicite sans connexion DB, pointeur vers `patch_iso_risks_from_excel_v2.py` |
| `drizzle/migrations/0019_seed_mdr_referentiel.sql` | Migration additive, seed le referentiel MDR manquant (decouverte D) |

## Phase 2 — Preuve locale reelle (2026-07-10)

Statut : termine. Tout ce qui suit a ete **execute reellement** contre `qara_local` (MariaDB), jamais suppose.

### Comptages par referentiel (apres correctifs, base locale reconstruite proprement)

| Referentiel | Code | Questions importees |
|---|---|---|
| 1 | MDR | **826** |
| 2 | ISO9001 | **225** |
| 3 | ISO13485 | **225** |
| 4 | FDA_QSR_21CFR820 | **30** |
| 5 | FDA_US_MARKET_ACCESS | **193** |
| **Total** | | **1499** |

`processus` : 15 lignes (canoniques, ids 1-15), zero doublon, zero processus fantome.

### Test d'idempotence (chaque import rejoue une 2e fois)

| Import | Resultat 1re execution | Resultat 2e execution | Doublons ? |
|---|---|---|---|
| MDR | 826 lignes | 826 lignes (identique) | Aucun |
| ISO 9001 | 225 lignes | 225 lignes (identique) | Aucun |
| ISO 13485 | 225 lignes | 225 lignes (identique) | Aucun |
| FDA | 223 inserted + 3 updated (226 traitees) | memes comptes en base (30+193=223 lignes, stable) | Aucun |

Aucune execution n'a touche les questions d'un autre referentiel (verifie par comptage avant/apres a chaque etape croisee : importer ISO 9001 n'a jamais fait varier le compte MDR, etc.).

### Test bout-en-bout reel (pas simule) : `mdr.getQuestionsForAudit`

Backend local demarre (`tsx server/_core/index.ts`), compte de test Pro cree, audit MDR reel cree via `mdr.createOrUpdateAuditDraft` (`referentialIds=[1]`, `processIds=["governance_strategy","regulatory_affairs","qms"]`, `economicRole="fabricant"`), puis appel reel `mdr.getQuestionsForAudit` :

```
"total": 24,
"filteredByDb": false,
"economicRole": "fabricant"
```

**24 questions reelles retournees, toutes avec `economicRole: "fabricant"`.** C'est la preuve directe que "Aucune question trouvee" est resolu pour ce cas — le blocage rapporte dans le lot frontend precedent (parcours de test n°10, marque "bloque par corpus") peut desormais aboutir.

### Tentative de test bout-en-bout ISO — a revele un bug reel, mais hors perimetre corpus (non corrige ici)

Par souci de completude, le meme test a ete tente pour ISO : audit ISO9001 cree via `iso.createOrUpdateAuditDraft` (`standardCode: "ISO9001"`, `processMode: "all"`, `auditId=2` cree avec succes), puis appel `iso.getQuestionsForAudit`.

**Resultat : erreur 500**, `TypeError: Cannot convert undefined or null to object`, trace remontant a `orderSelectedFields` (drizzle-orm) depuis l'appel `db.select(questionSelect)` dans `server/iso-router.ts` (`getQuestionsForAudit`). C'est un bug reel dans la construction de la requete Drizzle du routeur ISO — **independant des donnees du corpus** (le comptage SQL direct confirme 225/225 lignes ISO9001 correctement presentes et bien formees ; le meme schema de selection d'objet fonctionne sans probleme dans `mdr-router.ts`). Non corrige ici : c'est de la logique metier du routeur ISO, hors perimetre strict "scripts d'import du corpus" de ce lot, et ne bloque pas le test bout-en-bout MDR (qui a reussi). **Consigne comme dette nouvelle, a traiter dans une session dediee routeur ISO** — le corpus ISO est pret (225/225 lignes verifiees par SQL direct), mais l'endpoint applicatif qui le sert a un bug preexistant qui l'empeche de repondre.

### Ce qui n'a pas ete teste (a signaler honnetement)

- `fda.getQuestions` : verifie par lecture de code et par comptage SQL (30+193=223), non rejoue via un appel API reel dans cette session.
- Build TypeScript du backend non re-verifie dans cette session corpus (verifie exhaustivement dans le lot backend securite precedent, aucun fichier `.ts` du perimetre "routers" n'a ete touche ici — seul `drizzle/schema.ts`/`migrations` et des scripts Python/JS autonomes ont change). Le bug ISO ci-dessus a ete trouve malgre cela, par test reel plutot que par lecture — confirmant l'interet de tester meme hors perimetre strict.

## Phase 3 — Livrables production (a executer par l'utilisateur, rien declenche ici)

Aucune ecriture n'a ete faite contre Railway par cette session. Tout ce qui suit est a valider puis executer par l'utilisateur, dans l'ordre.

### 1. Migration additive a appliquer en premier

`drizzle/migrations/0019_seed_mdr_referentiel.sql` — effet exact : `INSERT ... ON DUPLICATE KEY UPDATE` d'une seule ligne dans `referentiels` (id=1, code='MDR', name='MDR 2017/745'). N'affecte aucune autre ligne/table. Idempotent (peut etre rejouee sans risque).

**Comment l'executer** : GitHub -> Actions -> **"DB Migrate (safe) & Baseline"** (`db-push.yml`) -> Run workflow. Ce workflow scanne automatiquement tous les fichiers de `drizzle/migrations/*.sql` non encore appliques (suivi par hash dans `_drizzle_migrations`) — `0019` sera pris en compte automatiquement, aucune action manuelle supplementaire necessaire pour la migration elle-meme.

### 2. Workflows d'import a relancer, dans cet ordre (chacun `workflow_dispatch`, aucun n'est automatique)

| Ordre | Workflow GitHub Actions | Script | Effet | Volume attendu |
|---|---|---|---|---|
| 1 | **Import Questions from Excel (MDR)** | `scripts/import_questions_from_excel.py` (corrige) | Additif, idempotent (upsert par `questionKey`). Ne touche que `referentialId=1`. | 826 questions |
| 2 | **Import ISO 9001 Questions (Excel -> MySQL)** | `scripts/import_iso_questions_from_excel.py` (corrige) | Additif, idempotent. Ne touche que `referentialId=2`. | 225 questions |
| 3 | **Import ISO 13485 Questions (Excel -> MySQL)** | idem, `referentialId=3` | Additif, idempotent. Ne touche que `referentialId=3`. | 225 questions |
| 4 | **Import FDA Questions** (deja existant, verifie propre, aucun changement) | `scripts/import-questionnaires.ts` | Additif, idempotent (upsert par `questionKey`). Ne touche que les referentiels FDA (4, 5). | 223 questions (30+193) |

**Garantie verifiee en local pour les 4** : aucune suppression, aucun impact croise entre referentiels, resultat identique si rejoue deux fois. L'ordre ci-dessus est une recommandation logique (MDR d'abord car c'est le blocage rapporte), pas une contrainte technique — les 4 imports sont mutuellement independants.

### 3. Requetes de verification en lecture seule (avant ET apres, a executer dans Railway -> Data/Query)

**Avant les imports — etat actuel du corpus et du schema :**
```sql
SELECT r.code, r.name, COUNT(q.id) AS question_count
FROM referentiels r
LEFT JOIN questions q ON q.referentialId = r.id
GROUP BY r.id, r.code, r.name
ORDER BY r.id;
```

**Verification de l'etat de `processus` (leve le doute sur la decouverte A de la Phase 0bis — la seule facon de savoir avec certitude si la production a les 15 processus canoniques ou seulement une partie) :**
```sql
SELECT id, slug, name, displayOrder FROM processus ORDER BY id;
-- Attendu : exactement 15 lignes, ids 1-15, slugs non NULL et non "process_<id>",
-- displayOrder 1 a 15 sans trou. Si ce n'est pas le cas, le repondre a l'agent
-- avant de lancer les imports (un correctif additif dedie serait necessaire,
-- non prepare dans ce lot faute de confirmation).
```

**Apres chaque import — comptage par referentiel (comparer aux volumes attendus ci-dessus) :**
```sql
SELECT r.code, r.name, COUNT(q.id) AS question_count
FROM referentiels r
LEFT JOIN questions q ON q.referentialId = r.id
GROUP BY r.id, r.code, r.name
ORDER BY r.id;
```

**Verification qu'aucun doublon n'a ete cree (doit toujours renvoyer 0 ligne) :**
```sql
SELECT questionKey, COUNT(*) AS c
FROM questions
GROUP BY questionKey
HAVING c > 1;
```

**Verification de l'absence de la colonne `risks` (deja fournie en Phase 0, toujours valide) :**
```sql
SELECT COUNT(*) AS has_legacy_risks_column
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'risks';
-- Attendu : 0
```

### 4. Rappel

Tous les workflows ci-dessus sont `workflow_dispatch` (declenchement manuel uniquement, jamais automatique sur push). C'est l'utilisateur qui clique "Run workflow" pour chacun, apres avoir valide ce journal. Cette session n'a declenche aucun workflow et n'a ecrit dans aucune base autre que `qara_local` (locale, ephemere, sans lien avec Railway).

## Definition de « termine » — bilan

1. Diagnostic confirme point par point, branche `claude/qara-backend-corpus` reprise proprement (voir Phase 0bis). ✅
2. Tous les scripts d'import corriges : additifs, idempotents, alignes au schema (`risk`, `referentiels`), zero suppression globale. Verifie pour les 3 scripts actifs (MDR, ISO x2) + verification de non-regression pour FDA. ✅
3. Preuve fournie par test local reel (pas suppose) : 1499 questions au total (826+225+225+193+30), idempotence verifiee sur les 4 imports, test bout-en-bout MDR reussi (24 questions retournees pour un audit Fabricant). Test bout-en-bout ISO tente, a revele un bug reel mais hors perimetre (routeur `iso-router.ts`, pas le corpus), consigne comme dette. ✅ (avec la reserve honnete ci-dessus)
4. Procedure de chargement production livree (workflows + requetes de verification), en attente de feu vert utilisateur — rien execute contre Railway. ✅
5. Build/demarrage : backend local demarre et repond correctement tout au long des tests (pas de re-verification `tsc`/`vite build` dans cette session, aucun fichier `.ts` de routeur touche). `PROGRESS-corpus.md` complet. Etat du push : voir commits ci-dessous. ✅

## Dettes consignees (nouvelles, en plus de celles deja connues du lot backend precedent)

1. **`iso-router.ts` `getQuestionsForAudit`** : erreur 500 reelle (`TypeError: Cannot convert undefined or null to object` dans `orderSelectedFields` de drizzle-orm, sur l'appel `db.select(questionSelect)`). Corpus ISO verifie sain (225/225 lignes), mais l'endpoint qui le sert est casse. A corriger dans une session dediee routeur ISO.
2. **`scripts/apply-sql-migrations.ts`** : fragilite de conception — une erreur DDL "deja existant" sur la premiere instruction d'un fichier de migration fait annuler (rollback) et sauter tout le fichier, y compris les instructions DML substantielles qui suivent. Non confirme comme ayant reellement affecte la production (l'ordre normal de deploiement ne devrait pas declencher ce cas precis), mais verifie comme reproductible localement. Requete de verification fournie en Phase 3 partie 3 pour trancher. Si la production s'avere affectee (processus incomplets), un correctif additif dedie serait necessaire.
3. Dettes deja connues du lot backend precedent (rate limiting authentification, bugs `audits.create` `auditType`/`type` et `audit_reports` desynchronise) : toujours non traitees, hors perimetre de ce lot corpus, aucune n'a bloque le test bout-en-bout MDR donc non corrigees ici conformement a la consigne.

## Etape suivante — Nettoyage "base saine" + sequence de production complete (2026-07-10)

Statut : procedure preparee, **rien execute contre la production**. En attente de l'utilisateur pour chaque etape (Railway Query / GitHub Actions).

### Contexte

L'utilisateur a constate l'etat reel de production (`SELECT referentialId, COUNT(*) FROM questions GROUP BY referentialId`) :
referentialId 1:80, 2:72, 3:43, 4:74, 5:93, **6:67, 7:44** — total 473, avec deux referentiels parasites (6 et 7, dechets d'anciens imports rates) et des fragments partiels sur 1-5. Decision : nettoyer avant de recharger le corpus corrige.

### Verification des risques avant nettoyage (fait par lecture directe du schema, pas suppose)

- Aucune contrainte FK au niveau base entre `audit_responses`/`mdr_evidence_files`/`audits` et `questions`/`referentiels`/`processus` : confirme par lecture de `drizzle/schema.ts` (toutes ces colonnes croisees — `questionId`, `questionKey`, `referentialIds`, `processIds` — sont de simples `int`/`varchar`/`json`, aucune n'a de `.references(...)`). Consequence : les suppressions ne provoqueront aucune erreur de contrainte, mais pourraient orpheliner silencieusement de vraies donnees sans le signaler — d'ou la requete de pre-verification fournie a l'utilisateur (comptage `audit_responses`/`mdr_evidence_files`, recherche d'audits referencant les referentiels 6/7 via `JSON_CONTAINS`).
- Le script MDR corrige inclut desormais le role economique dans le calcul de `questionKey` : meme sans vidage, les anciens `questionKey` MDR ne correspondront plus aux nouveaux de toute facon (changement de formule de hash, deja documente dans le correctif du bug de collision).
- Confirmation du raisonnement de l'utilisateur sur les referentiels 1-5 : `scripts/apply-sql-migrations.ts` marque chaque migration comme appliquee par hash de contenu dans `_drizzle_migrations` et saute entierement le fichier des que ce hash est deja enregistre, peu importe si les lignes qu'il a inserees existent encore. Supprimer les referentiels 1-5 ne les ferait donc PAS recreer par un simple re-lancement des migrations existantes (0001/0017/0019 seraient ignorees, deja "vues" comme appliquees) — confirme exact, d'ou l'imperatif de les conserver.

### Livrable 1 — Procedure de nettoyage (Railway -> Query)

1. Sauvegarde : `CREATE TABLE {questions,referentiels,processus}_backup_20260710 AS SELECT * FROM ...` (les 3 tables), avec verification de comptage juste apres.
2. `DELETE FROM questions;` (vidage total, tous referentiels confondus) — verification `SELECT COUNT(*) FROM questions` = 0.
3. `DELETE FROM referentiels WHERE id IN (6, 7);` (jamais 1-5) — verification : exactement 5 lignes restantes, ids 1-5.
4. `DELETE FROM processus WHERE id > 15;` — verification : exactement 15 lignes restantes.

Confirme explicitement a l'utilisateur : ces 3 DELETE ne touchent que `questions` (entierement), `referentiels` (ids 6-7 seulement), `processus` (ids > 15 seulement) — aucune autre table (`users`, `audits`, `audit_responses`, `audit_reports`, `mdr_evidence_files`, `onboarding_profiles`, `sites`, `organisations`, etc.) n'est lue ni ecrite.

### Livrable 2 — Sequence de production complete (confirmee, ordre de l'utilisateur correct)

1. Merger `claude/qara-backend-corpus` -> `main` (PR, pas de force-push) — necessaire car `workflow_dispatch` s'execute par defaut depuis `main` si aucune branche n'est explicitement selectionnee dans l'UI Actions ; recommande plutot que le selecteur manuel de branche pour eviter une erreur d'inattention repetee sur 5 declenchements.
2. Workflow **`DB Migrate (safe) & Baseline`** sur `main` — applique `0019` si pas deja fait (idempotent).
3. Nettoyage base saine (Livrable 1 ci-dessus), dans Railway -> Query, place APRES la migration (les referentiels 1-5 doivent deja exister) et AVANT les imports.
4. Imports dans l'ordre, chacun via son workflow GitHub Actions sur `main` : **`Import Questions from Excel (MDR)`**, puis **`Import ISO 9001 Questions (Excel -> MySQL)`** (dry_run=0), puis **`Import ISO 13485 Questions (Excel -> MySQL)`** (dry_run=0), puis **`Import FDA Questions Only`** (dry_run=0). Ce dernier reapplique aussi les migrations SQL en interne (sans effet, deja faites en etape 2).
5. Verifications finales (Railway -> Query) : comptage par referentiel (attendu 826/225/225/30/193, total 1499), `processus_count` = 15, zero question orpheline (`processId`/`referentialId` sans parent) des deux cotes.

Details complets (chaque requete SQL, nom exact de chaque workflow tel qu'affiche dans l'onglet Actions) donnes a l'utilisateur en reponse directe, non recopies integralement ici pour eviter la duplication — cette section sert de resume de decision et de traçabilite.
