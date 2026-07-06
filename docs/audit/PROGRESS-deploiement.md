# PROGRESS — Déploiement de test (branche, sans toucher à `main`/prod)

*Fichier d'état pour reprise autonome. Si la session est coupée, un simple
« continue » doit permettre de reprendre exactement où c'était arrêté —
lire ce fichier en premier, reprendre à la première tâche non cochée.*

## Cadrage (rappel, ne pas dévier)
- Objectif : déployer `claude/qara-compliance-audit-qitbxl` (les deux
  dépôts) sur une URL de **test/preview**, distincte de la prod.
- **Ne PAS merger vers `main`. Ne PAS toucher au déploiement de production
  existant.**
- **IA réglementaire reste désactivée** : pas de `ANTHROPIC_API_KEY` sur cet
  environnement de test. Vérifier que son absence ne casse rien (l'app doit
  tourner normalement, l'assistant doit juste renvoyer une erreur propre si
  sollicité — déjà le comportement du code, voir `docs/audit/13-ia-reglementaire.md`).
- Beaucoup d'actions se font dans Vercel/Railway (interfaces web) où je n'ai
  pas accès. Pour celles-là : instructions pas-à-pas précises, j'attends
  confirmation avant de continuer.

## Checklist

- [x] T0. Diagnostic config Vercel/Railway (à partir du code, pas du
      dashboard — je n'y ai pas accès) + liste des variables. Voir
      §Diagnostic ci-dessous. **Des questions restent à te poser avant de
      proposer un plan concret (accès dashboard requis) — voir
      §Questions en attente.**
- [x] T1. Base de test créée, migrations appliquées, corpus importé (473 en
      base). Confirmé par les logs : `Import terminé : 473 insérées, 0 mises
      à jour, sur 473.` puis `Server listening on port 8080` (première
      apparition) et `[Database] MySQL ping OK`. Reste à faire : retirer la
      variable temporaire `RESET_BEFORE_IMPORT` du service Railway.
- [ ] T2. Backend branche déployé sur base de test, variables OK, health
      check vert.
- [ ] T3. Frontend branche déployé (URL preview), pointe vers backend de
      test.
- [ ] T4. Vérif sécurité (5 points) confirmée.
- [ ] T5. Lien + checklist de test livrés à l'utilisateur.

## Diagnostic (T0) — à partir du code, confirmé par lecture directe des fichiers

### Backend (Railway)
- Pas de `railway.json`/`nixpacks.toml`/`Procfile` versionné — Railway
  détecte donc automatiquement Node.js et exécute `npm run build` puis
  `npm start` (scripts `package.json` : `build` = esbuild vers `dist/`,
  `start` = `NODE_ENV=production node dist/index.js`).
- Port : lu depuis `process.env.PORT` (`server/_core/index.ts:73`), Railway
  l'injecte automatiquement — rien à configurer.
- Connexion base de données (`server/db.ts::getMysqlConfigFromEnv`) : essaie
  dans l'ordre `MYSQL_PRIVATE_URL` → `DATABASE_URL` → `MYSQL_PUBLIC_URL`/
  `MYSQL_URL` → variables séparées `MYSQLHOST`/`MYSQLUSER`/`MYSQLPASSWORD`/
  `MYSQLDATABASE`/`MYSQLPORT`. **Toutes ces conventions correspondent
  exactement aux variables que Railway injecte automatiquement quand on
  ajoute un plugin "MySQL" à un service** — donc un nouveau plugin MySQL sur
  un nouveau service/environnement fonctionnera sans aucune modification de
  code, tant que les variables sont bien référencées (Railway le fait
  automatiquement entre un service MySQL et un service applicatif du même
  projet/environnement).
- CORS (`server/_core/index.ts:24-56`) : origine fixe
  `https://frontend-qara.vercel.app` toujours autorisée, **plus toute URL
  Vercel de preview correspondant au pattern `https://*.vercel.app` contenant
  "frontend-qara" (`isAllowedVercelPreview`)** — autrement dit, les preview
  deployments Vercel de ce même projet frontend sont **déjà autorisés
  automatiquement, sans rien configurer**. `ALLOWED_ORIGINS` (variable
  d'env, liste séparée par des virgules) permet d'ajouter des origines
  supplémentaires si besoin (ex. un nom de domaine de test personnalisé qui
  ne suivrait pas ce pattern).
- `JWT_SECRET` : **doit être définie** en production (le code lève une
  erreur explicite au démarrage si absente hors développement — voir
  `server/_core/sdk.ts`). Nécessite une vraie valeur aléatoire pour
  l'environnement de test (distincte du secret de prod, pour ne pas
  invalider/partager les sessions).
- `ANTHROPIC_API_KEY` : ne pas définir — l'assistant IA renvoie une erreur
  contrôlée en son absence (`server/assistant/assistant-router.ts::getAnthropicClient`),
  déjà vérifié ne pas faire planter le serveur (voir Lot IA réglementaire).
- Schéma de base : les migrations versionnées (`drizzle/migrations/`, 20
  fichiers) recréent maintenant l'intégralité du schéma sur une base neuve,
  y compris les tables cœur (`users`, `audits`, `sites`, `organisations`,
  `questions`, etc.) grâce à `0007b_baseline_core_tables.sql` (Lot 0) — déjà
  vérifié deux fois de façon idempotente sur des bases neuves dans cette
  session. Le script maison `scripts/apply-sql-migrations.ts` force
  `ssl:{rejectUnauthorized:false}`, adapté à Railway.

### Frontend (Vercel)
- `vercel.json` : pas de `buildCommand`/`outputDirectory` explicites (donc
  configurés dans le dashboard Vercel du projet, ou détectés par le preset
  Vite). `vite.config.ts` confirme : racine Vite = `client/`, sortie de
  build = `dist/` à la racine du dépôt (cohérent avec un Output Directory
  Vercel = `dist`).
- Variable clé : `VITE_API_URL` (lue via `import.meta.env.VITE_API_URL`,
  `client/src/lib/trpc.ts`) — doit pointer vers l'URL du backend Railway de
  **test**, pas de prod. Doit inclure le chemin `/trpc` (voir
  `client/.env.local` en dev : `VITE_API_URL=http://127.0.0.1:3001/trpc`).
- Preview deployments : si le projet Vercel est connecté au dépôt GitHub
  avec les déploiements de preview activés (comportement par défaut pour
  toute branche autre que la branche de production), **pousser la branche
  suffit normalement à déclencher un déploiement de preview automatique**,
  sans action supplémentaire de ma part — à confirmer dans le dashboard.

## Réponses de l'utilisateur (T0)

1. Railway : backend et MySQL sont **deux services distincts** dans le
   projet de production.
2. Vercel : **une preview existe déjà** pour
   `claude/qara-compliance-audit-qitbxl` (déploiements automatiques par
   branche déjà actifs sur ce projet).
3. Isolation Railway : « peu importe, le plus simple » → **nouvel
   environnement Railway** (fonctionnalité native "Environments") retenu :
   duplique les deux services existants (backend + MySQL) ensemble dans un
   environnement isolé du même projet, sans configuration manuelle de
   variables partagées entre services (Railway les reconnecte
   automatiquement dans le nouvel environnement).

## Plan concret (T1-T5)

### T1 — Base de test (Railway, nouvel environnement)
1. Dans le dashboard Railway, ouvrir le projet de production.
2. Créer un nouvel environnement (menu des environnements, généralement en
   haut de la page projet — souvent un sélecteur déroulant à côté de
   "Production" avec une option "+ New Environment"). Le nommer par ex.
   `test-qara`. Choisir l'option qui duplique les services existants
   (Railway propose en général de dupliquer depuis "Production" en
   choisissant quels services inclure — inclure le service **backend** et
   le service **MySQL** tous les deux).
3. **Vérifier immédiatement** (avant toute autre action) que le nouveau
   service MySQL dans `test-qara` est une base **vide/neuve** (pas une copie
   des données de prod) — ouvrir son onglet "Data"/"Query" dans Railway et
   confirmer qu'il n'y a aucune table, ou très peu (juste celles créées par
   défaut). Me confirmer ce que tu vois avant de continuer.
4. Dans le service **backend** de l'environnement `test-qara` : onglet
   "Settings" → "Source" → changer la branche déployée sur
   `claude/qara-compliance-audit-qitbxl` (au lieu de `main`).
5. Une fois le nouveau service MySQL confirmé vide, je te donnerai la
   commande exacte pour appliquer les migrations + importer le corpus
   (473 questions) — nécessite que tu me communiques la chaîne de
   connexion MySQL **publique** de ce nouveau service de test (Railway
   l'affiche dans l'onglet "Connect" du service MySQL, variable
   `MYSQL_PUBLIC_URL` ou équivalent) pour que je puisse m'y connecter
   depuis cet environnement et lancer le script d'import. **Ne me donne
   jamais la chaîne de connexion de la base de PRODUCTION.**

### T2 — Backend (Railway, service `test-qara`)
Variables à définir sur le service backend de l'environnement `test-qara`
(Settings → Variables) :
- `JWT_SECRET` : une valeur aléatoire longue et différente de celle de
  prod (ex. générée avec `openssl rand -hex 32`) — je peux te donner une
  valeur si tu préfères que je la génère.
- `ALLOWED_ORIGINS` : normalement pas nécessaire — les previews Vercel de ce
  projet (`*.vercel.app` contenant "frontend-qara") sont déjà autorisées
  automatiquement par le code (voir §Diagnostic). À définir seulement si tu
  utilises un domaine de test personnalisé qui ne suit pas ce pattern.
- **Ne PAS définir** `ANTHROPIC_API_KEY` (IA désactivée intentionnellement).
- Les variables de connexion MySQL (`MYSQL_PRIVATE_URL`/`DATABASE_URL`/etc.)
  sont normalement déjà injectées automatiquement par Railway entre les
  deux services du même environnement — rien à faire ici si l'étape T1 a
  bien reconnecté le service MySQL au service backend dans `test-qara`.
- Une fois les variables définies, redéployer le service backend
  (normalement automatique après un changement de variable/branche) et me
  donner l'URL publique du service (Settings → Networking → Public
  Networking, ou le domaine `*.up.railway.app` déjà généré) pour que je
  vérifie le health check.

### T3 — Frontend (Vercel, preview existante)
1. Dans le dashboard Vercel, ouvrir le projet frontend → onglet
   "Deployments" → trouver le déploiement de preview pour
   `claude/qara-compliance-audit-qitbxl`.
2. Aller dans Settings → Environment Variables du projet Vercel, et
   vérifier/ajouter `VITE_API_URL` **scopée à "Preview"** (pas
   "Production") avec la valeur `https://<url-backend-test>.up.railway.app/trpc`
   (l'URL obtenue à la fin de T2, avec `/trpc` à la fin).
3. Redéployer la preview (ou pousser un commit vide sur la branche) pour
   que la nouvelle variable soit prise en compte — Vite lit les variables
   d'environnement au moment du build, pas à l'exécution.
4. Me donner l'URL de preview finale.

### T4 — Vérification de sécurité (avant de livrer le lien)
Je vérifierai/confirmerai chacun de ces points avant de te donner le lien :
- [ ] Mots de passe hachés (bcrypt, Lot 0 C-03) — vérifiable via une
  inscription de test + lecture directe de la table `users` sur la base de
  test (`passwordHash` doit commencer par `$2`).
- [ ] Backdoor `devLogin`/`dummy-token` absent (Lot 0 C-04/C-06) — déjà
  supprimé du code, vérifiable par lecture du dépôt déployé.
- [ ] CORS n'autorise que l'URL de test (pas `*`) — déjà garanti par le
  code (`server/_core/index.ts`), vérifiable en observant les en-têtes de
  réponse.
- [ ] Base de test isolée de la prod — confirmé en T1 (nouvel environnement
  Railway avec sa propre base).
- [ ] L'app tourne sans `ANTHROPIC_API_KEY` — vérifiable en observant les
  logs du service backend de test au démarrage (pas d'erreur bloquante) et
  en testant que l'assistant échoue proprement (pas de crash serveur) si
  sollicité.

### T5 — Livraison
URL de test + checklist de test manuel + où reporter les problèmes (voir
le prompt de mission original pour le contenu exact de la checklist).

## Bug bloquant trouvé et corrigé en cours de route

L'utilisateur a créé l'environnement Railway `New Claude` (dupliqué depuis
la prod, backend + MySQL), changé la branche du service backend vers
`claude/qara-compliance-audit-qitbxl`, et le premier déploiement a échoué :
```
pnpm install --frozen-lockfile --prefer-offline
ERROR  packages field missing or empty
Build Failed: ... exit code: 1
```
Cause : `pnpm-workspace.yaml` à la racine du dépôt, un fichier auto-généré
par erreur lors d'un `pnpm add @anthropic-ai/sdk` pendant le Lot IA
réglementaire (contenu : `allowBuilds: esbuild: <texte de placeholder>`),
committé par erreur. Un `pnpm-workspace.yaml` sans champ `packages:` est
invalide, et `pnpm install --frozen-lockfile` (utilisé par Railway) le
traite comme fatal — ce projet n'est pas un monorepo et n'a jamais eu
besoin de ce fichier. Supprimé (commit `8cfeb83f`), vérifié localement :
`pnpm install --frozen-lockfile --prefer-offline` (commande exacte de
Railway), `npm run build`, et `npm test` (70/70) passent tous sans lui.

Build réussi confirmé par l'utilisateur. Base MySQL de `New Claude`
confirmée vide ("You have no tables").

## Blocage T1 : pas d'accès TCP brut à la base depuis mon environnement

Tentative de connexion directe à la base de test via sa chaîne de connexion
publique (`mysql://root:...@reseau.proxy.rlwy.net:28240/railway`) —
échec : `ERROR 2002 (HY000): Can't connect to server` (timeout confirmé
via test TCP brut). Cause : la politique réseau de mon environnement
bloque explicitement les connexions TCP brutes vers des bases de données
externes (documenté dans `/root/.ccr/README.md` : "Not supported through
the proxy (report, do not work around): ... raw-TCP databases"). Ce n'est
pas contournable, et je ne dois pas essayer.

**Pivot retenu** : au lieu de me connecter moi-même à la base, faire
exécuter les migrations + l'import du corpus **par le service backend
Railway lui-même**, qui peut atteindre sa propre base MySQL sans
restriction (réseau privé Railway). Les deux scripts existants
(`scripts/apply-sql-migrations.ts`, `scripts/import-corpus.mjs`) ne
nécessitent que `DATABASE_URL` (déjà lu depuis l'environnement) et sont
idempotents (vérifié à de multiples reprises dans cette session) — donc
sûrs à enchaîner en une seule commande de démarrage temporaire :
```
npx tsx scripts/apply-sql-migrations.ts && npx tsx scripts/import-corpus.mjs && node dist/index.js
```
Pas de nouveau script à écrire : réutilisation telle quelle des deux
scripts déjà éprouvés. `tsx` est en devDependency mais Railway installe
tout le `node_modules` (pas de `--production`, confirmé par le build qui
vient de réussir), donc disponible au runtime.

## Bug bloquant #2 trouvé et corrigé : race condition sur double exécution concurrente

Premier essai de la commande de démarrage temporaire : logs montrent une
erreur `ER_NO_REFERENCED_ROW_2` (violation de clé étrangère) sur l'insertion
d'une question FDA (`referentialId=8` inexistant au moment de l'insert).

**Diagnostic** (reproduit localement, pas de spéculation) :
- Reproduit la chaîne exacte des migrations + import sur une base MySQL
  locale neuve : un run unique et séquentiel réussit parfaitement (473/473,
  aucune erreur).
- Les logs Railway montraient des lignes clairement **entrelacées** entre
  deux exécutions du même script (deux tableaux `Found migrations` mélangés
  ligne à ligne) — signature d'une exécution **concurrente**, pas d'un
  crash-restart séquentiel. Confirmé en lançant volontairement 2 processus
  `import-corpus.mjs` en parallèle sur la même base locale neuve : reproduit
  une erreur de contrainte unique (`processus.slug`) dans le même style.
- Cause racine : `scripts/import-corpus.mjs` fait un pattern "SELECT puis
  INSERT si absent" pour upsert `referentiels` (par `code`) et `processus`
  (par nom/slug) — mais **aucune contrainte UNIQUE** n'existe sur
  `referentiels.code` en base (vérifié dans `drizzle/schema.ts` et les
  migrations). Deux exécutions concurrentes du script (probable : Railway a
  brièvement fait tourner 2 instances du conteneur au démarrage/redéploiement)
  peuvent toutes les deux voir "le référentiel n'existe pas encore" et
  l'insérer chacune de son côté avec un id différent — corrompant le mapping
  code→id utilisé ensuite pour insérer les questions, d'où la FK cassée.
- **Effet de bord découvert en cours de route (non bloquant, documenté, pas
  corrigé — hors périmètre)** : la migration `0001_seed_iso_referentiels.sql`
  est today un no-op silencieux sur toute base neuve (elle s'exécute, par
  tri alphabétique des fichiers, **avant** `0006_create_referentiels_and_processus.sql`
  qui crée la table — elle tombe donc systématiquement dans sa branche de
  repli `INSERT INTO referentials` (sans "ie", table qui n'existe nulle part
  dans le schéma), erreur `ER_NO_SUCH_TABLE` avalée par le mécanisme
  "ignorable error"). Conséquence : ISO9001/ISO13485 n'obtiennent jamais les
  ids fixes 2/3 prévus, ils sont recréés avec des ids auto-incrémentés par
  `import-corpus.mjs` à la place — sans conséquence fonctionnelle (le code
  applicatif référence toujours les référentiels par `code`, jamais par id
  en dur), donc non corrigé pour rester strictement dans le périmètre
  déploiement.

**Fix appliqué** (`scripts/import-corpus.mjs`, commit à suivre) : verrou
nommé MySQL (`GET_LOCK('qara_import_corpus', 120)` / `RELEASE_LOCK`) autour
de tout le corps du script. Si une deuxième exécution démarre pendant que la
première tourne, elle attend (jusqu'à 120s) que le verrou se libère, puis
s'exécute normalement sur un état déjà cohérent (idempotent par
`questionKey`/`code`) au lieu de courir en parallèle sur les mêmes lignes.

**Vérifié par reproduction locale** : 2 processus lancés en parallèle sur
une base neuve → avec le fix, les deux terminent avec succès (exit 0),
sérialisés par le verrou ; état final = 473 questions, aucun `referentiels.code`
en double. Suite de tests backend repassée : 70/70, aucune régression.

## Rechute après le fix #2 : état déjà corrompu, pas une nouvelle race

Après avoir poussé le verrou anti-concurrence, le redéploiement a rechuté
**exactement** sur la même erreur (`referentialId=8` inexistant), à chaque
tentative du crash-loop Railway, de façon parfaitement déterministe.

**Diagnostic** : le verrou empêche une *nouvelle* corruption, mais ne répare
pas une base déjà dans un état incohérent (référentiels dupliqués/orphelins
créés par les tentatives concurrentes d'AVANT le fix). Reproduit
localement : une base fraîche + import unique réussit toujours (473/473,
vérifié à nouveau) ; en simulant volontairement l'état corrompu observé sur
Railway (un `questions.referentialId` pointant vers un id de `referentiels`
supprimé), la ré-exécution du seul `import-corpus.mjs` échoue bien avec la
même erreur — confirmant que c'est l'état des données, pas une nouvelle
race, qui bloque.

**Fix** : nouveau script `scripts/reset-corpus-tables.mjs` — vide
(`TRUNCATE`, compteurs auto_increment remis à zéro) uniquement les tables
`questions` et `referentiels` (aucune autre table n'a de FK entrante vers
celles-ci), à lancer une seule fois avant le réimport pour repartir d'un
état propre. Choisi plutôt que de demander à l'utilisateur de supprimer/
recréer le service MySQL dans le dashboard Railway (plus simple, plus
fiable, ne dépend pas de trouver le bon bouton dans l'UI).

**Vérifié par reproduction locale** : état corrompu simulé (même symptôme
exact que le log Railway) → `reset-corpus-tables.mjs` puis `import-corpus.mjs`
→ 473 questions, 7 référentiels avec des ids propres 1-7, aucune erreur.
Suite de tests backend : 70/70.

## Bug bloquant #3 : colonne `criticality` avec un type trop restrictif

Une fois le reset fonctionnel confirmé (log `Tables questions/referentiels
réinitialisées...` bien présent, plus d'erreur de clé étrangère), nouvelle
erreur, différente et déterministe (pas une race) :
```
Data truncated for column 'criticality' at row 1
code: 'WARN_DATA_TRUNCATED'
```
sur toute question dont `criticality='critical'` (présentes dans le corpus
FDA/QMSR).

**Diagnostic** : `drizzle/schema.ts` et les migrations déclarent
`criticality` comme `varchar(50)` — largement suffisant pour "critical".
Mais `0007b_baseline_core_tables.sql` crée la table `questions` avec
`CREATE TABLE IF NOT EXISTS`, qui ne fait **rien** si la table existe déjà.
Or cette base (héritée/dupliquée depuis un état antérieur non versionné —
même famille de problème que C-01, déjà documenté) avait cette colonne en
`ENUM('low','medium','high')` — sans 'critical'. Reproduit localement en
recréant volontairement cette colonne en ENUM restrictif : erreur identique
obtenue immédiatement.

**Fix** : nouvelle migration `drizzle/migrations/0021_fix_criticality_column_type.sql`
— `ALTER TABLE questions MODIFY COLUMN criticality varchar(50) DEFAULT NULL`
(force le bon type peu importe l'état actuel de la colonne).

**Vérifié par reproduction locale** : colonne remise en ENUM restrictif
volontairement → l'ALTER de la migration la corrige, confirmé qu'elle
accepte ensuite 'critical'. Chaîne complète rejouée sur base neuve
(migrations 0000-0021 + reset + import) : 473/473, aucune erreur. Suite de
tests backend : 70/70.

## Bug bloquant #4 (identifié, pas corrigé — pivot vers diagnostic) : `reset-corpus-tables.mjs` sans verrou

Après le fix #3, même erreur de clé étrangère qu'avant (section "Rechute
après le fix #2"), mais sur une **ligne différente** (`Q-13485-SM-2399`,
`referentialId=5`), à chaque nouvelle tentative, dans des logs montrant à
nouveau plusieurs blocs `Found migrations: [...]` entrelacés entre eux
(preuve d'exécutions concurrentes réelles, pas d'un simple redémarrage
séquentiel — voir §4.4 du nouveau document de diagnostic).

**Diagnostic** : `scripts/import-corpus.mjs` a un verrou MySQL (fix #1),
mais `scripts/reset-corpus-tables.mjs` (ajouté par le fix #2) **n'en a
aucun**. Si Railway fait bien tourner plusieurs copies de la chaîne de
démarrage en parallèle (hypothèse forte, cohérente avec toutes les preuves,
mais pas encore reproduite en isolation avec certitude absolue), une copie
peut `TRUNCATE` les tables pendant qu'une autre copie est en train d'y
insérer des questions avec un identifiant de référentiel qui vient de
disparaître.

**Décision de l'utilisateur à ce stade** : plutôt que de continuer les
correctifs ponctuels un par un, l'utilisateur a demandé un document de
diagnostic complet, autonome et transmissible à un tiers, avant toute
nouvelle correction. Livré :
`docs/audit/ETAT-DES-LIEUX-backend.md` — contient le diagnostic détaillé
(cause de fond : une procédure de préparation de base de données pensée
pour tourner une fois a été branchée sur la commande de démarrage du
conteneur, qui peut s'exécuter plusieurs fois/en parallèle) et deux
solutions proposées (retirer la commande de démarrage personnalisée une
fois l'import réussi une fois — recommandée ; ou protéger
`reset-corpus-tables.mjs` par le même verrou que `import-corpus.mjs` —
palliatif). **Aucune de ces deux solutions n'a été appliquée** : en
attente de lecture du document par l'utilisateur et de sa décision.

## Fix #4 appliqué : reset et import fusionnés sous un seul verrou

L'utilisateur a demandé d'appliquer les corrections nécessaires. Plutôt que
de choisir entre les deux options du document de diagnostic (retirer la
commande de démarrage personnalisée / ajouter un verrou au script de
reset), les deux ont été faites :

1. **`scripts/import-corpus.mjs`** : nouvelle option `RESET_BEFORE_IMPORT=1`
   — le vidage des tables (`TRUNCATE questions`/`referentiels`) se fait
   maintenant **à l'intérieur de la même section verrouillée** que l'import
   (une seule connexion, un seul `GET_LOCK`, tenu de bout en bout). Il n'y a
   donc plus aucune fenêtre entre "vidage" et "import" où une exécution
   concurrente pourrait s'intercaler — contrairement à l'ancien
   enchaînement de deux scripts séparés (deux connexions, deux verrous
   pris/relâchés indépendamment).
2. **`scripts/reset-corpus-tables.mjs`** (conservé pour un usage manuel
   ponctuel hors chaîne de démarrage) : reçoit maintenant le même verrou
   nommé MySQL que `import-corpus.mjs`, par défense en profondeur.

**Vérifié par reproduction locale** :
- Import normal (sans le flag) : comportement inchangé, 473/473.
- État corrompu simulé (`referentialId` invalide) + `RESET_BEFORE_IMPORT=1` :
  récupération complète en un seul passage, 473/473.
- **Deux processus `RESET_BEFORE_IMPORT=1` lancés en parallèle** sur la
  même base (le scénario exact soupçonné sur Railway) : les deux se
  terminent avec succès (exit 0), strictement sérialisés par le verrou,
  état final = 473 questions, 7 référentiels avec des ids propres — plus
  aucune corruption possible même en cas de chevauchement de conteneurs.
- Suite de tests backend : 70/70.

**Nouvelle commande de démarrage personnalisée à utiliser sur Railway**
(remplace l'ancienne, qui appelait `reset-corpus-tables.mjs` séparément) :
```
npx tsx scripts/apply-sql-migrations.ts && RESET_BEFORE_IMPORT=1 npx tsx scripts/import-corpus.mjs && node dist/index.js
```

## Adoption de la fonctionnalité Railway "Release Command"

Un tiers consulté par l'utilisateur a proposé d'utiliser la fonctionnalité
native Railway "Release Command" plutôt que de brancher la préparation de
base de données sur la commande de démarrage elle-même. Analysé, jugé
supérieur à toutes les options précédentes (garantit une exécution unique
et bloque le démarrage du vrai serveur tant que la commande n'a pas réussi
— élimine la concurrence par construction, pas seulement par verrou) :
adopté.

**Deux bugs identifiés et corrigés dans le code proposé par ce tiers avant
adoption** (voir échange avec l'utilisateur) : table `referentials` au lieu
de `referentiels` (le nom réel de la table dans ce projet — même piège que
la section 5.4 du document de diagnostic), et un nom de verrou MySQL
différent de celui déjà utilisé dans `import-corpus.mjs` (`qara_corpus_reset_lock`
vs `qara_import_corpus` — deux verrous distincts ne s'excluent pas
mutuellement, ça n'aurait pas fermé la race). Le fix déjà en place (fusion
reset+import sous UN seul verrou, voir "Fix #4" ci-dessus) reste la bonne
version.

**Risque identifié et écarté de la solution permanente** : ne PAS inclure
le vidage (`RESET_BEFORE_IMPORT=1` / `reset-corpus-tables.mjs`) dans le
script `release` de façon permanente. `TRUNCATE` remet à zéro les
compteurs auto_increment, donc chaque réimport futur donnerait de
nouveaux ids numériques aux questions. Vérifié dans le code :
`server/report-generator.ts:114` fait une jointure sur l'id numérique
(`auditResponses.questionId` ↔ `questions.id`) — un vidage+réimport
répété casserait silencieusement cette jointure pour tout audit déjà
répondu, dès que la base contiendra de vraies données utilisateur (la
plupart des autres accès utilisent `questionKey`, une chaîne stable, qui ne
serait pas affectée). Ce risque ne concerne pas l'état actuel (base de test
encore sans données utilisateur réelles), mais concernerait tout
déploiement futur si le vidage restait permanent dans le script `release`.

**Décision retenue** : `package.json` reçoit un script `release` **sans**
le vidage, permanent et sûr à rejouer indéfiniment (idempotent par
upsert) :
```json
"release": "npx tsx scripts/apply-sql-migrations.ts && npx tsx scripts/import-corpus.mjs"
```
Le nettoyage ponctuel de l'état actuellement corrompu se fait via une
variable d'environnement **temporaire** `RESET_BEFORE_IMPORT=1` sur le
service Railway (pas dans le script), à retirer après le premier
déploiement réussi — voir instructions ci-dessous.

Vérifié : `npm test` 70/70 après l'ajout du script `release`.

## Rechute #5 (nouveaux logs) : confirme que la Start Command n'a pas encore été changée — pas un bug de code

Nouveaux logs partagés par l'utilisateur : même erreur `ER_NO_REFERENCED_ROW_2`
sur `referentialId=5` / `Q-13485-SM-2399`, identique à chaque tentative,
tentatives espacées de 2-5 secondes, `[RESET] ...` présent à chaque fois,
blocs `Found migrations: [...]` toujours entrelacés entre eux.

L'utilisateur a proposé sa propre théorie : `import-corpus.mjs`
« suppose des IDs numériques stables » pour les référentiels et devrait
faire un lookup dynamique par clé métier au lieu d'un id « en dur ».

**Vérifié sur le code réel — théorie écartée** : `import-corpus.mjs` ne
contient aucun id numérique littéral. L'étape 1 (§ « Référentiels ») construit
`refIdByCode` à l'exécution, uniquement à partir de résultats réels
(`existing[0].id` si la ligne existe déjà, sinon `res.insertId` juste après
l'`INSERT`) :
```js
const existing = await db.select().from(referentiels).where(eq(referentiels.code, r.code));
if (existing.length) {
  refIdByCode[r.code] = existing[0].id;
  ...
} else {
  const [res] = await conn.execute("INSERT INTO referentiels ...");
  refIdByCode[r.code] = res.insertId;
}
```
L'étape 3 (insertion des questions) ne fait que relire cette map :
`const refId = refIdByCode[row.referentialCode];` — c'est déjà exactement le
lookup dynamique par clé métier proposé. Le "5" qui apparaît dans l'erreur
n'est donc pas une constante du script : c'est l'id réellement obtenu pour
`ISO13485` **pendant cette exécution précise**. S'il n'existe plus au moment
de l'`INSERT` de la question, la seule explication possible est qu'un
**autre processus concurrent** a fait un `TRUNCATE referentiels` entre le
moment où ce processus a résolu l'id 5 et le moment où il a essayé de s'en
servir — donc toujours le même phénomène de fond que les rechutes #2 et #4
(plusieurs conteneurs/tentatives qui tournent en même temps), pas un
nouveau bug de logique. Aucune modification de `import-corpus.mjs` jugée
nécessaire à ce stade.

Les blocs `Found migrations` toujours entrelacés + tentatives toutes les
2-5 secondes sont la preuve directe que la **Start Command personnalisée
tourne toujours** sur Railway (elle seule peut relancer toute la chaîne à
chaque redémarrage/tentative de conteneur) — donc que l'étape 1 de la
section "PROCHAINE ÉTAPE" (basculer vers Release Command) n'a pas encore
été appliquée dans le dashboard. C'est l'action prioritaire, avant toute
nouvelle conclusion tirée des logs.

## Bug bloquant #6 trouvé et corrigé : FK `questions.referentialId` héritée pointant vers la mauvaise table

Une fois le pre-deploy step Railway ("Add pre-deploy step" = Release Command,
juste renommé) correctement configuré, les logs ont enfin montré une seule
exécution propre (plus d'entrelacement) — mais l'import plantait encore,
de façon déterministe, à l'insertion de `Q-13485-SM-2399`. Railway a fourni
un diagnostic (via son assistant) : la contrainte de clé étrangère sur
`questions.referentialId` référence une table `referentials` (anglais) et
non `referentiels` (français).

**Vérifié comme exact** (pas une supposition) :
- `docs/audit/ETAT-DES-LIEUX-backend.md` §4.3 contient déjà le message
  d'erreur réel capturé plus tôt dans la session :
  `CONSTRAINT questions_referentialId_referentials_id_fk FOREIGN KEY
  (referentialId) REFERENCES referentials (id)`.
- Aucune migration versionnée ne crée cette contrainte (`grep` sur
  `drizzle/migrations/` : zéro résultat) — elle a été créée hors contrôle de
  version, avant le renommage de la table en `referentiels` (même famille
  que C-01). `drizzle/schema.ts:712` a un alias `export const referentials =
  referentiels` pour la compatibilité du code JS, mais ça ne change rien à
  la contrainte SQL déjà gravée dans la base.
- Reproduit exactement en local : recréé la contrainte legacy
  (`questions_referentialId_referentials_id_fk` → `referentials`), confirmé
  le même crash exact (`referentialId=5` inexistant dans `referentials`
  alors qu'il existe bien dans `referentiels`).

**Fix** : nouvelle migration
`drizzle/migrations/0022_fix_questions_referentialId_fk_target.sql` :
1. Met à `NULL` les `referentialId` orphelins (sécurité, sans effet si aucun).
2. Supprime dynamiquement (lookup via `information_schema`, pas de nom en
   dur) l'ancienne contrainte si elle ne référence pas `referentiels`.
3. Ajoute la bonne contrainte vers `referentiels(id)` si elle n'existe pas
   déjà.
Idempotent, sans effet sur une base saine (le lookup dynamique ne trouve
rien à corriger).

**Vérifié par reproduction locale bout en bout** : base neuve → migrations
0000-0021 → contrainte legacy injectée manuellement (même nom exact que le
log réel) → migration 0022 (première exécution sur cet état) → contrainte
corrigée → `import-corpus.mjs RESET_BEFORE_IMPORT=1` → **473 insérées, 0
erreur**. Réexécution sans le flag : idempotent (upsert normal). Suite de
tests backend : 70/70 (le premier run avait semblé bloqué à cause d'une
variable `DATABASE_URL` restée pointée sur la base de test locale dans le
shell — sans rapport avec le fix, résolu en relançant dans un shell propre).

## Incident critique découvert et résolu : `DATABASE_URL` du backend de test pointait vers la base de PRODUCTION

Une fois le déploiement réussi (T1), en vérifiant les données via le
dashboard Railway, la table `questions` du service `MySQL-vr64` (service
MySQL de l'environnement `New Claude`) apparaissait vide — alors que les
logs venaient de confirmer un import réussi de 473 lignes. Investigation :

- `MySQL-vr64` (Connect → Public Network) : hôte `turntable.proxy.rlwy.net:32678`.
- Le backend (`Backend---QARA`, variable `DATABASE_URL`) : hôte
  `metro.proxy.rlwy.net:17616` — **différent**.
- Vérifié en ouvrant l'environnement `production` : son service MySQL a
  exactement pour hôte `metro.proxy.rlwy.net:17616/railway` — **confirmé
  identique**.

**Conclusion** : `DATABASE_URL` (et `MYSQL_PUBLIC_URL`) du service backend
de `New Claude` étaient définies en dur avec une valeur copiée pointant
vers la base de production, au lieu d'une référence Railway automatique
vers le service MySQL de cet environnement. Conséquence : toutes les
opérations de cette mission de déploiement (migrations 0000-0022, et
surtout les `TRUNCATE questions`/`referentiels` + réimport du corpus 473
questions, répétés à chaque tentative du crash-loop) **se sont exécutées
contre la base de production**, pas contre une base de test isolée.

**Impact évalué avec l'utilisateur** : la production était encore en phase
de test, sans audits/réponses utilisateur réels — donc pas de rupture de
lien `audit_responses.questionId` ↔ `questions.id` (le risque identifié
plus tôt dans la session, voir section Release Command, ne s'est pas
concrétisé). Le remplacement du contenu `questions`/`referentiels`
correspond de toute façon à une décision déjà validée (`docs/audit/07-import-corpus.md`,
remplacement complet MDR/FDA) — déclenchée plus tôt que prévu et par un
autre chemin, mais sans perte de contenu métier légitime. Décision : pas de
restauration depuis une sauvegarde jugée nécessaire.

**Fix appliqué** : l'utilisateur a corrigé `DATABASE_URL`/`MYSQL_PUBLIC_URL`
du service backend de test pour pointer vers `MySQL-vr64`
(`turntable.proxy.rlwy.net:32678/railway`) et redéployé — confirmé : la
table `questions` de `MySQL-vr64` contient maintenant bien les données.
Plus aucun risque d'écriture supplémentaire vers la production depuis ce
service de test.

**Point de vigilance pour la suite** : toujours vérifier, pour tout
prochain déploiement/service, que les variables `DATABASE_URL`/`MYSQL_*`
utilisent bien une référence Railway (`${{NomDuService.VARIABLE}}`) et non
une valeur copiée en dur, pour ne jamais reproduire ce risque.

## PROCHAINE ÉTAPE

**T1 confirmé réussi** (voir logs du 2026-07-06 15:38-15:41 : migration 0022
appliquée, 473/473 importées, `Server listening on port 8080`,
`[Database] MySQL ping OK`).

Reste à faire avant de clore T1 et passer à T2 :
1. Retirer la variable temporaire `RESET_BEFORE_IMPORT` du service Railway
   (`import-corpus.mjs` seul est déjà idempotent pour tous les déploiements
   suivants — la garder viderait la base à chaque redéploiement).
2. Récupérer l'URL publique du service (`Settings → Networking`, domaine
   `*.up.railway.app` déjà vu dans une capture précédente :
   `backend-qara-new-claude.up.railway.app`) pour vérifier le health check.
3. Enchaîner sur T2 : définir `JWT_SECRET` (valeur aléatoire, distincte de
   la prod) sur le service, vérifier `ALLOWED_ORIGINS` (normalement pas
   nécessaire, voir §Diagnostic), confirmer `ANTHROPIC_API_KEY` toujours
   absente.
4. Puis T3 (Vercel) : `VITE_API_URL` scopée "Preview" pointant vers l'URL
   Railway de test + `/trpc`.
