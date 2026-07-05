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

## Questions en attente (accès dashboard requis, je ne peux pas les vérifier moi-même)

1. **Railway** : le projet a-t-il actuellement un seul service (backend) ou
   plusieurs (ex. backend + MySQL managé séparé) ? Combien
   d'environnements Railway existent déjà (Production seul, ou déjà
   Staging/autre) ?
2. **Railway** : quelles variables d'environnement existent déjà sur le
   service de production actuellement (juste les **noms**, pas les
   valeurs) ? Cela permet de savoir lesquelles dupliquer/recréer pour
   l'environnement de test.
3. **Vercel** : le dépôt frontend est-il connecté à Vercel via l'intégration
   GitHub (déploiements automatiques par branche) ? As-tu déjà vu apparaître
   un déploiement de preview pour `claude/qara-compliance-audit-qitbxl` dans
   l'onglet "Deployments" du projet Vercel (la branche a déjà été poussée
   plusieurs fois durant les lots précédents) ?
4. Préférence : dupliquer le service Railway existant dans un **nouvel
   environnement Railway** (fonctionnalité native "Environments", recommandé
   — garde tout dans le même projet, isolation propre), ou créer un
   **nouveau projet Railway** entièrement séparé ?

## PROCHAINE ÉTAPE

T0 fait à partir du code. Question posée à l'utilisateur (voir
§Questions en attente) avant de proposer le plan concret T1-T5, faute
d'accès aux dashboards Vercel/Railway.
