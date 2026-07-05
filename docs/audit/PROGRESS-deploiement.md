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
- [ ] T1. Base de test créée, migrations appliquées, corpus importé (473 en
      base).
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

## PROCHAINE ÉTAPE

Attente de la confirmation utilisateur pour lancer T1, étape 2 (création du
nouvel environnement Railway `test-qara`, duplication des deux services).
Je ne peux pas cliquer dans Railway moi-même — instructions ci-dessus
données, en attente que l'utilisateur les exécute et me confirme le
résultat de l'étape 3 (base MySQL neuve confirmée vide) avant de continuer.
