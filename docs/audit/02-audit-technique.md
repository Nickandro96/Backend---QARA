# Phase 2 — Audit technique

Méthode : lecture exhaustive du code des deux dépôts + vérification active sur une instance locale (MySQL local peuplé via les migrations SQL versionnées, backend lancé, requêtes `curl` réelles, `npm audit`, `npm test`). Chaque anomalie est documentée avec sévérité, localisation exacte, impact, correction proposée et effort estimé.

Échelle de sévérité : **Critique** (compromission totale / fuite de données / faille exploitable immédiatement) · **Majeure** (risque réel, à corriger en priorité) · **Mineure** (hygiène / bonne pratique).

> **Mise à jour** : trois anomalies supplémentaires (C-06, C-07, M-12) ont été découvertes après la rédaction initiale de ce document, en faisant réellement fonctionner l'application en local (MySQL local + backend + frontend démarrés, tests Playwright réels — voir Phase 3). Elles n'étaient pas détectables par une lecture statique du code seule. **C-07 en particulier est probablement l'anomalie fonctionnelle la plus grave de tout l'audit** : elle empêche l'application de reconnaître un utilisateur comme connecté dans la quasi-totalité de l'interface, alors que la session est parfaitement valide côté serveur.

---

## 2.1 Qualité du code

### C-01 [Critique] — Le schéma de base n'est pas reconstituable depuis le code versionné
**Localisation** : `drizzle/schema.ts` vs `drizzle/migrations/*.sql` (19 fichiers) ; `drizzle.config.ts`.
**Constat** : `npx drizzle-kit push --force` échoue (`ER_TOO_LONG_IDENT` sur une contrainte FK générée pour `fda_qualification_answers`) car le nom de contrainte auto-généré par Drizzle Kit dépasse la limite MySQL de 64 caractères — alors que la migration réellement appliquée (`0017_fda_foundation.sql`) utilise un nom raccourci à la main. Plus grave : **aucune migration versionnée ne contient de `CREATE TABLE` pour `users`, `audits`, `sites`, `organisations`, `findings`, `actions`, `resultats`, `audit_responses`, `questions`** — seules `referentiels`, `processus`, `iso_qualifications`, les tables `watch_*`/`regulatory_*` et `fda_qualification_*` ont un `CREATE TABLE` traçable. Le schéma de base a donc été créé directement en base (probablement sur Railway) hors du contrôle de version.
**Impact** : impossible de recréer l'environnement de façon fiable à partir du dépôt seul (j'ai dû migrer, puis créer manuellement la ligne `referentiels` MDR id=1 pour pouvoir tester) ; en cas de perte de la base Railway, **la reconstruction du schéma serait un travail de reverse-engineering**, pas une simple relecture des migrations.
**Correction proposée** : générer un dump `CREATE TABLE` complet de la base Railway actuelle et le committer comme migration `0000_baseline.sql` (ou équivalent `drizzle-kit introspect`), puis interdire toute modification de schéma hors migration versionnée.
**Effort** : 0,5 jour.

### M-01 [Majeure] — `npm run import:questions` (script d'import MDR) est cassé de façon reproductible, à deux niveaux
**Localisation** : `scripts/import-mdr-questions.js` (référencé par `package.json:12`).
**Constat reproduit en local** :
1. Le script utilise `require(...)` (CommonJS) alors que `package.json` déclare `"type": "module"` → `ReferenceError: require is not defined in ES module scope` à l'exécution, systématique.
2. Une fois ce problème contourné, le script échoue ensuite avec `Unknown column 'risks' in 'INSERT INTO'` — il référence une colonne `risks` supprimée par la migration `0015_questions_unify_risk_drop_risks.sql`. Le script est donc désynchronisé du schéma actuel.
**Impact** : **le seul script destiné à réimporter/rafraîchir les questions MDR depuis l'Excel source ne peut pas s'exécuter tel quel.**
**Correction proposée** : renommer en `.cjs` ou convertir en import ESM ; retirer la colonne `risks` de l'INSERT.
**Effort** : 1 heure.

### C-02 [Critique] — Le même script (`import-mdr-questions.js`) fait un `TRUNCATE TABLE questions` global, qui efface aussi les questions ISO et FDA, sans restauration automatique en cas d'échec
**Localisation** : `scripts/import-mdr-questions.js:193` (`TRUNCATE TABLE \`questions\``).
**Constat reproduit en local** : le script crée une table de sauvegarde (`questions_backup_<date>`) **puis** tronque `questions` (table **partagée par MDR, ISO et FDA**) avant de réinsérer les lignes MDR. `TRUNCATE` déclenche un COMMIT implicite en MySQL/MariaDB — si l'insertion échoue après coup (ce qui arrive systématiquement à cause du bug M-01 ci-dessus), le message affiché est `❌ Import failed, rolled back`, **mais rien n'est réellement restauré automatiquement** : la table `questions` reste vide, seule une copie de sauvegarde existe (à restaurer manuellement, si l'opérateur sait qu'elle existe). Reproduit exactement lors de mes tests : après un premier essai raté, `SELECT COUNT(*) FROM questions` renvoyait **0**, malgré le log "rolled back".
**Impact** : toute exécution future de ce script (par exemple pour "rafraîchir les questions MDR après une mise à jour de l'Excel") **risque d'effacer silencieusement l'intégralité du questionnaire de la plateforme (MDR + ISO + FDA)**, avec un message de log trompeur laissant croire à une annulation propre.
**Correction proposée** : ne jamais tronquer une table partagée entre référentiels — filtrer le `DELETE`/insert par `referentialId` ; utiliser une vraie transaction avec `START TRANSACTION` (pas de `TRUNCATE`, utiliser `DELETE ... WHERE referentialId = ?` qui est transactionnel) ; ajouter une confirmation explicite avant toute purge en production.
**Effort** : 0,5 jour.

### M-02 [Majeure] — Deux lockfiles committés dans les deux dépôts
**Localisation** : `package-lock.json` + `pnpm-lock.yaml` à la racine du frontend (confirmé, versions actuellement synchronisées) ; le backend n'avait que `pnpm-lock.yaml` avant mon intervention (mon propre `npm install` local en a généré un troisième, supprimé avant commit — voir note ci-dessous).
**Impact** : selon l'outil utilisé par un contributeur ou par Vercel/Railway au moment du build, l'un ou l'autre lockfile peut être régénéré et diverger silencieusement de l'autre → builds non reproductibles.
**Correction proposée** : choisir `pnpm` comme gestionnaire unique (déjà le plus utilisé dans le projet), supprimer `package-lock.json`, ajouter un hook CI qui échoue si un second lockfile réapparaît.
**Effort** : 1 heure.
**Note** : durant cet audit, j'ai exécuté `npm install` dans le backend pour pouvoir lancer les tests locaux — cela a généré un `package-lock.json` local que **j'ai supprimé avant tout commit**, il n'a jamais été poussé.

### M-03 [Majeure] — Doublons de fichiers frontend
**Localisation** : `client/src/pages/FDAAudit.tsx` et `client/src/pages/FdaAudit.tsx` (strictement identiques, `diff` vide, 18 810 octets chacun, routées séparément sur `/us/fda-audit` et `/fda-audit`) ; `client/src/pages/MDRAudit.tsx.bak` (committé dans git, version antérieure de `MDRAudit.tsx`) ; `Home.tsx` vs `ModernHome.tsx` (l'ancienne reste routée sur `/home-old`).
**Impact** : maintenance double, risque de divergence silencieuse ; `MDRAudit.tsx.bak` est un artefact qui ne devrait jamais être versionné.
**Correction proposée** : supprimer `.bak`, choisir une seule des deux pages FDA et rediriger l'autre route, supprimer `Home.tsx` si `/home-old` n'a pas d'usage réel.
**Effort** : 0,5 jour (inclut la vérification qu'aucun lien externe/SEO ne pointe vers la route supprimée).

### M-04 [Majeure] — `AppRouter` frontend typé `any` : perte totale de la sécurité de type sur les appels API
**Localisation** : `client/src/server-types.ts:9` — `export type AppRouter = any;`.
**Constat** : c'est la cause racine de la quasi-totalité des appels tRPC "fantômes" listés en Phase 1 (`ai`, `actions`, `badges`, `contact`, `demo`, `documents`, `evidence`, `findings`, `questions`, `regulatory`, `subscription`, `fdaClassification`, `fdaRegulatoryWatch`, et la majorité de `audit.*` singulier). TypeScript ne peut détecter aucune de ces erreurs à la compilation puisque le type du routeur est `any`.
**Impact** : des pages entières (facturation, contact, documents, findings/actions/CAPA, IA réglementaire) plantent silencieusement en production au premier appel, sans qu'aucun build n'échoue.
**Correction proposée** : partager le vrai type `AppRouter` entre les deux dépôts (monorepo, package npm privé publiant le type, ou simple copie du fichier de types généré à chaque déploiement backend) pour retrouver l'auto-complétion et la vérification de type réelles.
**Effort** : 1 à 2 jours selon l'option retenue (structurel, à traiter dans la refonte — voir Phase 5).

### M-05 [Majeure] — Le build de production ignore les erreurs TypeScript et ESLint
**Localisation** : `vercel.json:9-12` — `"TSC_COMPILE_ON_ERROR": "true"`, `"ESLINT_NO_DEV_ERRORS": "true"`.
**Impact** : combiné à M-04, un appel à une route tRPC inexistante ou une erreur de type peut être déployé en production sans qu'aucun signal ne soit levé en CI/CD.
**Correction proposée** : retirer ces deux flags une fois M-04 corrigé et la dette de type existante résorbée (les retirer immédiatement ferait probablement échouer le build actuel — à faire progressivement).
**Effort** : dépend de la résorption de la dette de type existante (voir Phase 5, à chiffrer une fois M-04 traité).

### Mineures — hygiène de dépôt
- `client/public/__manus__/debug-collector.js` + `dist/__manus__/debug-collector.js` : script de télémétrie d'un ancien hébergeur, non chargé mais toujours servi. **Mineure**, 0,5 h (suppression).
- `dist/` committé dans le frontend malgré `.gitignore:3` qui l'exclut. **Mineure**, 0,5 h (`git rm -r --cached dist`).
- `client/src/pages/ComponentShowcase.tsx` (1437 lignes), `Audit.tsx`, `ISOAudit.tsx`, `LoginPassword.tsx`, `client/src/mdrRoutes.tsx`, composants `ManusDialog.tsx`, `AuditSelector.tsx`, `AuditCreationDialog.tsx`, `AuditHeaderPanel.tsx`, `UpgradePrompt.tsx`, `Map.tsx` (référence un domaine tiers `forge.butterfly-effect.dev` sans rapport avec le produit) : code mort, jamais importé. **Mineure**, 0,5 j de nettoyage global.
- Backend : routeur `server/site-router.ts` (singulier, 140 lignes) entièrement doublonné par le routeur `sites` (pluriel) inline dans `routers.ts` — jamais appelé par le frontend. **Mineure**, 1 h.
- `server/report-generator.ts:779,914` : deux TODO explicites, la génération de "rapport comparatif" se rabat silencieusement sur un rapport exécutif standard. **Mineure/Majeure** selon l'usage commercial attendu de cette fonctionnalité.
- Dépendances totalement inutilisées mais installées : `jose`, `jsonwebtoken`, `dotenv` (jamais importés nulle part dans `server/`), `stripe` (installé mais jamais instancié). **Mineure**, mais `jose`/`jsonwebtoken` sont justement les briques attendues pour corriger C-05 ci-dessous — à garder, pas à supprimer.

### Couverture de tests — quasi nulle hors veille réglementaire
**Constat** : `npm test` (`node --test --import tsx`) exécute exactement **5 tests**, tous dans `server/services/watch/tests/` (dédoublonnage, scoring d'impact, forme de la réponse `watch.updates`). Les 5 passent. **Aucun test** n'existe pour : l'authentification, le hachage de mot de passe, les 90 procédures tRPC (MDR/ISO/FDA/classification/audits/rapports/facturation), le modèle de données, ou un quelconque scénario d'IDOR — soit environ **83% des modules serveur substantiels à 0% de couverture**, y compris 100% du code d'authentification/autorisation. Côté frontend, aucun test (unitaire ou E2E) n'a été trouvé avant cet audit.
**Sévérité** : **Majeure** structurelle (aucune régression ne peut être détectée automatiquement sur les parcours métier critiques).
**Effort** : voir Phase 5, roadmap.

---

## 2.2 Sécurité

> ⚠️ Les 5 constats suivants (C-03 à C-07) ont été **vérifiés activement** (pas seulement lus dans le code) sur une instance locale : inscription réelle, lecture directe de la base, lecture du code d'authentification ligne à ligne. Aucune donnée de production n'a été touchée.

### C-03 [Critique] — Mots de passe stockés et comparés en clair
**Localisation** : `server/_core/passwordUtils.ts:1-2`.
```ts
export const hashPassword = (password: string) => password;
export const verifyPassword = (password: string, hash: string) => password === hash;
```
**Vérifié en direct** : après `POST /trpc/system.register` avec le mot de passe `Test1234!`, la colonne `users.passwordHash` contenait littéralement `Test1234!`.
**Impact** : toute fuite de la base de données (sauvegarde mal protégée, accès DBA compromis, injection) expose l'intégralité des mots de passe en clair. Incompatible avec le RGPD (obligation de mesures de sécurité appropriées, art. 32) et rédhibitoire pour vendre à des clients réglementés.
**Correction** : `bcrypt` ou `argon2`, avec migration forcée des mots de passe existants (marquage `passwordNeedsRehash`, ou réinitialisation forcée au prochain login).
**Effort** : 0,5 à 1 jour.

### C-04 [Critique] — Token de session forgeable
**Localisation** : `server/_core/sdk.ts:15-30`.
```ts
const TOKEN_PREFIX = "dummy-token-";
createSessionToken: async (openId) => `${TOKEN_PREFIX}${openId}`,
verifySessionToken: async (token) => token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null,
```
**Constat** : aucune signature, aucun chiffrement. `openId` pour un compte email/mot de passe est déterministe (`local_<email>`, cf. `systemRouter.ts:38,92,146`). **Un attaquant qui connaît simplement l'email d'une victime peut forger le cookie `session=dummy-token-local_<email>` et l'envoyer pour usurper ce compte intégralement**, admin compris, sans jamais avoir besoin du mot de passe.
**Impact** : contournement total de l'authentification pour n'importe quel compte dont l'email est connu (ce qui, pour un SaaS B2B, est souvent trivial à deviner : `prenom.nom@domaine-entreprise.com`).
**Correction** : JWT signés avec `jose` (déjà installé, jamais utilisé) ou session store serveur (Redis) avec identifiant opaque aléatoire.
**Effort** : 1 jour.

### C-05 [Critique] — Deux mécanismes de contournement total de l'authentification, codés en dur
**Localisation** : `server/_core/systemRouter.ts:26-61` (`system.devLogin`) et `:142-175` (`system.login`).

**(a) `system.devLogin`** : procédure `publicProcedure` (aucune authentification requise). Prend juste `{email, name}` en entrée, crée un utilisateur avec `role: "admin"` forcé (ligne 46), et retourne immédiatement un cookie de session valide. Le commentaire dans le code indique qu'elle est censée ne servir qu'à la création du tout premier compte admin, mais **aucun contrôle ne vérifie qu'il s'agit bien du premier compte** — elle est appelable à volonté, pour n'importe quel email.

**(b) Backdoor identifiants en dur dans `system.login`** :
```ts
const isBackdoorAccess =
  input.email === "nickandroklauss@gmail.com" && input.password === "Admin2026!";
```
Si ce couple est soumis : le code **réécrase le mot de passe existant** de ce compte avec la valeur soumise (`storePasswordHash`, ligne 173) et **force le rôle à `admin`** (ligne 174) — sans jamais valider l'ancien mot de passe. C'est un identifiant réel, codé en dur dans le code source versionné, correspondant à l'adresse email du commanditaire de cet audit.

**Découverte signalée immédiatement au commanditaire dès son identification, avant la poursuite des autres travaux, conformément aux règles de travail définies.**

**Impact** : accès administrateur complet à la plateforme pour quiconque a accès au code source (contributeur, dépôt s'il devient public, fuite de code) ou devine simplement l'existence de `system.devLogin`.
**Correction** : suppression pure et simple des deux mécanismes ; remplacer la création du premier compte admin par une procédure explicite (script one-shot exécuté manuellement en CLI côté serveur, jamais exposée en HTTP).
**Effort** : 2 heures (suppression) — **à traiter en priorité absolue, avant tout le reste, indépendamment du scénario retenu en Phase 5.**

### C-06 [Critique] — La reconnexion d'un utilisateur déjà enregistré échoue systématiquement (violation de contrainte SQL)
**Localisation** : `server/_core/systemRouter.ts:177` (dans `login`, appelé après le branchement `isBackdoorAccess`/mot de passe normal) : `await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });` ; `server/db.ts` (`upsertUser`, qui construit `email: data.email ?? null`) ; `drizzle/schema.ts:22` (`email: varchar(...).notNull()`).
**Constat vérifié en direct, à deux reprises indépendamment (curl puis Playwright)** : cet appel `upsertUser` est effectué **sans** `email`, donc `payload.email` vaut `null`. Comme `users.email` est `NOT NULL` (déclaré ainsi dans `drizzle/schema.ts`, confirmé identique dans `SHOW CREATE TABLE users` de l'instance locale), MySQL rejette l'`INSERT` sous-jacent de l'`ON DUPLICATE KEY UPDATE` avec `ER_BAD_NULL_ERROR: Column 'email' cannot be null`, **avant même que la résolution de la clé dupliquée n'ait lieu** — donc y compris pour un utilisateur qui existe déjà. Résultat : `system.login` renvoie une erreur 500 (`"Login backend error: ..."`) pour **toute tentative de connexion d'un compte déjà enregistré**, qu'il s'agisse du chemin normal (mot de passe) ou du chemin backdoor (C-05) — les deux passent par cette même ligne.
**Ce qui fonctionne malgré ce bug** : `system.register` (login automatique après inscription, car son propre appel à `upsertUser` inclut bien `email`) et `system.devLogin` (idem) ne sont pas affectés. C'est pourquoi un utilisateur peut sembler "fonctionner" tant qu'il reste sur la session ouverte à l'inscription — mais **ne peut plus jamais se reconnecter après une déconnexion, l'expiration du cookie, ou depuis un autre appareil/navigateur**.
**Impact** : fonctionnalité de connexion normale non opérationnelle pour tout utilisateur récurrent. C'est un bug bloquant pour tout usage réel au-delà d'une session unique.
**Correction proposée** : faire porter `email` (et idéalement ne modifier que `lastSignedIn`) dans cet appel, ou remplacer ce pattern "upsert" par une requête `UPDATE users SET lastSignedIn = ? WHERE openId = ?` dédiée qui ne touche pas aux colonnes non concernées.
**Effort** : 1 heure. **Priorité maximale** — plus urgent encore que certains correctifs de sécurité, puisqu'il rend l'usage normal du produit impossible au-delà d'une session.

### C-07 [Critique] — Une session serveur valide n'est jamais reconnue par l'interface (incompatibilité du transformer tRPC client/serveur)
**Localisation** : `client/src/lib/trpc.ts:30` (`transformer: superjson` sur le lien tRPC du frontend) vs `server/_core/trpc.ts:16` (commentaire explicite : *"We DO NOT use superjson transformer here to avoid 'expected object, received undefined'"* — le serveur n'applique effectivement aucun transformer).
**Constat vérifié en direct** (test Playwright dédié conservé dans `e2e/transformer-bug.spec.ts`) : après une inscription réussie via le vrai formulaire `/register`, un appel `fetch()` brut (hors client tRPC) vers `/trpc/auth.me` avec les cookies du navigateur retourne bien l'utilisateur complet et correct — **la session est valide**. Mais le composant React qui affiche l'état de connexion (`useAuth()` → `trpc.auth.me.useQuery()`, `client/src/_core/hooks/useAuth.ts`) continue d'indiquer `isAuthenticated: false`, et aucune trace de l'utilisateur (email, menu de profil) n'apparaît jamais dans l'interface, y compris après plusieurs secondes d'attente.
**Cause racine confirmée** : `superjson.deserialize()` attend une enveloppe `{ json: ..., meta: ... }`. Appelé sur un objet JSON brut sans cette enveloppe (ce que le serveur renvoie, puisqu'il n'utilise pas superjson), il **retourne silencieusement `undefined`, sans lever d'erreur** — vérifié indépendamment (`node -e "require('superjson').default.deserialize({id:1,email:'x'})"` → `undefined`). Le client tRPC applique ce déchiffrement à **chaque réponse** de chaque procédure (query ou mutation) transitant par `client/src/lib/trpc.ts`, pas seulement `auth.me`.
**Impact** : c'est probablement le bug fonctionnel le plus grave de toute la plateforme. Toute page qui dépend de `useAuth()` pour son affichage (à peu près toutes les pages protégées : dashboards, audits MDR/ISO/FDA, classification, paramètres...) risque de considérer l'utilisateur comme non connecté en permanence, indépendamment de la validité réelle de sa session. Plus généralement, **toute donnée renvoyée par une query/mutation tRPC risque d'être silencieusement perdue (`undefined`) côté client**, ce qui peut expliquer une bonne partie des anomalies "page qui ne charge rien" ou "données manquantes" qui seraient autrement attribuées à d'autres causes. Ce point mérite d'être élevé en tout premier de la liste des correctifs Lot 0 — avant même C-05/C-06 en termes d'impact sur l'utilisabilité réelle du produit (mais évidemment pas avant en termes de risque de sécurité).
**Correction proposée** : retirer `transformer: superjson` du client (`client/src/lib/trpc.ts`) pour qu'il corresponde exactement à l'absence de transformer côté serveur ; si un transformer est réellement souhaité (utile pour sérialiser `Date`/`Map`/`Set`/`undefined` correctement), l'activer symétriquement des deux côtés (`initTRPC.create({ transformer: superjson })` côté serveur ET client) plutôt que d'un seul.
**Effort** : 1 heure pour le correctif technique — mais son impact fonctionnel est tel qu'il faut ensuite **revalider l'intégralité des parcours utilisateurs** une fois corrigé (beaucoup de comportements observés "cassés" ailleurs dans cet audit pourraient en réalité n'être que des symptômes de ce bug).

### M-12 [Majeure] — Le flag `secure: true` du cookie de session est codé en dur, indépendamment de l'environnement
**Localisation** : `server/_core/systemRouter.ts` (dans `register`, `login`, `devLogin`) — chaque appel à `ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, secure: true, sameSite: "none", ... })` écrase explicitement le résultat de `getSessionCookieOptions(req)` (`server/_core/cookies.ts`), qui avait pourtant correctement calculé `secure: isProd` (donc `false` hors production).
**Impact** : le calcul environnement-dépendant de `getSessionCookieOptions` est en réalité mort (jamais respecté). Pour le développement local sur une adresse autre que `localhost`/`127.0.0.1` (ex. IP de LAN, nom d'hôte Docker, domaine de preview auto-hébergé), le cookie `Secure` ne peut pas être posé/renvoyé par le navigateur en HTTP simple, ce qui bloque toute authentification. (Sur `127.0.0.1`/`localhost` spécifiquement, Chrome traite ces hôtes comme "contextes potentiellement fiables" et autorise quand même les cookies `Secure` en HTTP — c'est ce qui a permis de continuer les tests locaux malgré ce bug, mais ce n'est pas garanti sur tous les navigateurs/environnements de dev.)
**Correction proposée** : utiliser directement le retour de `getSessionCookieOptions(req)` sans l'écraser.
**Effort** : 15 minutes.

### M-06 [Majeure] — Aucune limitation de débit (rate limiting) sur les endpoints d'authentification
**Localisation** : recherche exhaustive sur l'ensemble du dépôt backend (aucune occurrence de `rate-limit`, `express-rate-limit`, `slowDown`, etc.).
**Impact** : combiné à C-03 (mots de passe en clair, comparaison triviale) et C-05 (backdoor), `system.login`/`system.register`/`system.devLogin` sont exposés au bourrage d'identifiants (credential stuffing) et au brute-force sans aucun frein.
**Correction** : `express-rate-limit` (ou équivalent au niveau tRPC) sur `system.login`, `system.register`, `system.devLogin`, avec verrouillage progressif par IP/compte.
**Effort** : 0,5 jour.

### M-07 [Majeure] — Facturation Stripe non implémentée côté serveur
**Localisation** : `server/stripe/router.ts` — fichier entier : `export const stripeRouter = router({});`.
**Constat** : aucune instanciation du SDK Stripe, aucun endpoint webhook, donc **aucune vérification de signature webhook** puisqu'il n'y a pas de webhook du tout. Le frontend appelle `createCheckoutSession`, `createPortalSession`, `getSubscription` (`Pricing.tsx`, `Subscription*.tsx`) — toutes ces routes n'existent pas côté serveur.
**Impact** : la facturation n'est pas "buguée", elle **n'existe pas**. Toute mention commerciale d'un modèle payant actuel serait trompeuse.
**Correction** : implémenter le routeur (checkout, portail client, webhook signé) — travail de fonctionnalité, pas de simple correctif.
**Effort** : 3 à 5 jours (voir Phase 5).

### M-08 [Majeure] — Upload de preuves (evidence) non implémenté, S3 est un stub
**Localisation** : `server/storage.ts` — fichier entier : `export const storagePut = async () => {};`. `@aws-sdk/client-s3` n'est importé nulle part dans `server/` (`grep` confirmé).
**Impact** : `EvidenceUpload.tsx` appelle `trpc.evidence.*`, un namespace qui n'existe même pas côté serveur (en plus du stub S3) — **aucune preuve documentaire n'est réellement téléversée/stockée**, fonctionnalité pourtant centrale pour un outil d'audit qualité. De plus, `reports.generate` (`server/routers.ts:823`) appelle `uploadToS3(...)` et déstructure `{ url }` du résultat — comme `storagePut` retourne `undefined`, **cet appel plante systématiquement** (`TypeError: Cannot destructure property 'url' of 'undefined'`). Même corrigé, la ligne suivante (`routers.ts:846`) utilise `.returning()`, une API Drizzle propre à PostgreSQL, non supportée par le driver `mysql2` utilisé ici — **deuxième crash garanti**.
**Correction** : implémenter réellement l'upload S3 (le SDK est déjà une dépendance), créer le routeur `evidence` côté serveur, corriger `reports.generate` (retirer `.returning()`, gérer le retour réel de l'upload).
**Effort** : 2 à 3 jours.

### M-09 [Majeure] — Fonctions de suppression/mise à jour d'audit sans filtre de propriétaire intégré (défense en profondeur manquante)
**Localisation** : `server/db.ts:571-583` (`updateAudit(auditId, patch)`, `deleteAudit(auditId)`).
**Constat** : ces deux fonctions n'acceptent qu'un `auditId`, sans `userId`, contrairement à `getAuditByIdAndUserId` et la plupart des autres fonctions de `db.ts`. **Tous les points d'appel actuels** (`routers.ts:461,479,527,546,576,600`) effectuent bien une vérification de propriété juste avant l'appel — donc **aucune IDOR n'est exploitable aujourd'hui** — mais ces deux fonctions constituent un piège pour tout développeur futur qui les appellerait sans re-vérifier la propriété en amont : ce serait alors une suppression/modification cross-tenant instantanée.
**Correction** : faire porter le filtre `userId` directement dans ces deux fonctions (comme `getAuditByIdAndUserId`), pour que la protection ne dépende plus de la discipline de chaque appelant.
**Effort** : 2 heures.

### Résultat de l'audit IDOR systématique (positif)
J'ai tracé, pour chaque procédure tRPC de `fda-router.ts`, `iso-router.ts`, `mdr-router.ts`, `routers.ts`, `audit-router.ts`, `site-router.ts` acceptant un identifiant (`auditId`, `siteId`, `organisationId`, `reportId`...), la requête SQL sous-jacente. **Dans tous les cas actuellement exploitables, le filtre `userId` est bien appliqué** (soit inline via `and(eq(id), eq(userId))`, soit via l'utilitaire partagé `getAuditContextInternal` dans `mdr-router.ts`). C'est un point positif à souligner : le contournement d'authentification (C-04/C-05) rend ce filtrage inopérant en pratique (puisqu'on peut usurper n'importe quel `userId`), mais **la logique de scoping elle-même, une fois l'authentification corrigée, est globalement saine.**

### Mineures — sécurité
- CORS correctement configuré, pas de wildcard (`server/_core/index.ts:24-63`) — bonne pratique confirmée, aucune action requise.
- Validation des entrées : Zod utilisé de façon quasi systématique sur toutes les mutations (vérifié procédure par procédure) — bonne pratique. Quelques champs JSON en `z.any()` (fichiers de preuve, réponses libres) : acceptable, mais leur contenu n'est jamais validé structurellement. **Mineure.**
- `.env` n'est pas listé dans `.gitignore` du backend (bien qu'aucun `.env` réel ne soit committé actuellement). **Mineure**, à corriger défensivement.
- Gestion d'erreur incohérente : certains routeurs (`fda-router.ts`, `classification-router.ts`) utilisent `throw new Error(...)` brut au lieu de `TRPCError`, perdant le code d'erreur HTTP correct côté client. **Mineure.**

### RGPD — éléments observés
- Données personnelles stockées : email, nom, mots de passe (en clair — C-03), profils d'entreprise, réponses d'audit potentiellement sensibles (peuvent révéler des non-conformités qualité). Hébergement Railway (à vérifier : région du cluster MySQL — non déterminable depuis le code, à demander à l'hébergeur/dashboard Railway).
- **Aucune politique de suppression de compte/droit à l'oubli identifiée** dans le code (aucune procédure `deleteAccount`/`gdprExport` trouvée).
- Chiffrement en transit : HTTPS via Vercel/Railway (plateformes managées, à confirmer que les certificats sont bien forcés — `app.set("trust proxy", 1)` suggère un usage correct derrière un proxy TLS).
- Chiffrement au repos : dépend de la configuration Railway MySQL (non déterminable depuis le code).
- **Avec des mots de passe en clair (C-03) et une authentification contournable (C-04/C-05), la conformité RGPD (art. 32, mesures de sécurité appropriées) n'est aujourd'hui pas atteinte.** C'est un argument commercial majeur à retourner en positif une fois Lot 0 (Phase 5) traité.

---

## 2.3 Performance & fiabilité

- **Job de veille réglementaire intégré au process Express** (`server/jobs/watchRefreshJob.ts`, démarré dans `server/_core/index.ts:77`) plutôt qu'un worker séparé : sur Railway (non serverless), ce n'est pas bloquant en soi, mais empêche tout scaling horizontal propre du service API sans dupliquer le job (risque de double exécution si plusieurs instances tournent).
- **Pool de connexions MySQL limité à 5** (`server/db.ts:217`, commentaire explicite "Railway likes smaller pools") — raisonnable pour un plan Railway modeste, mais deviendra un goulot d'étranglement si le nombre d'utilisateurs simultanés augmente ; à surveiller/ajuster selon le plan Railway réel.
- **`reports.generate` et `reports.compare` plantent systématiquement** (voir M-08 et le TODO de comparaison) — indisponibilité totale de deux fonctionnalités de reporting, pas un problème de performance mais de fiabilité pure.
- **Aucun cache identifié** sur les données de référence quasi statiques (`referentiels`, `processus`, `questions`) — chaque chargement de page d'audit réinterroge la base ; pas critique au volume actuel mais à revoir en Phase 5 (TanStack Query côté client fait déjà un cache mémoire raisonnable).
- Frontend : `vite.config.ts:27` — `sourcemap: true` en production : les sources TypeScript originales sont exposées via les DevTools de n'importe quel visiteur. **Mineure** en soi, mais à désactiver avant une mise en production commerciale sérieuse (ou à héberger les sourcemaps séparément, non publiquement).
- Pas de test de charge réalisé (hors périmètre raisonnable de cet audit statique/fonctionnel) — à prévoir avant onboarding de clients payants.

---

## 2.4 UX / UI / accessibilité

### M-10 [Majeure] — i18n structurellement incohérente entre français et anglais
**Localisation** : `client/src/locales/fr.json` (445 clés) vs `en.json` (478 clés).
**Constat** : ce ne sont pas juste quelques clés manquantes — la structure elle-même diverge. Exemple : la home page utilise `home.features.*` en anglais mais `home.modules.*` en français (deux arborescences différentes pour la même section) ; **la totalité des 50 clés `audit.*`** (titres, labels de criticité, boutons de sauvegarde...) existe en anglais mais est **totalement absente du fichier français**. Par ailleurs, sur 159 fichiers `.tsx`, seuls 17 (11%) importent `react-i18next` — la quasi-totalité des pages d'audit (MDR, ISO, FDA) contiennent du texte français codé en dur directement dans le JSX, y compris sur les pages de connexion/inscription (`Login.tsx`, `Register.tsx`).
**Impact** : la promesse "fr_FR + en_US" affichée dans les meta tags (`client/index.html:29-30`) et le composant `HreflangTags.tsx` **n'est pas tenue** — un visiteur anglophone verrait très majoritairement du texte français codé en dur en dehors de la page d'accueil marketing.
**Correction** : unifier la structure des deux fichiers de traduction, combler les clés manquantes, généraliser `useTranslation` sur les pages d'audit avant toute communication commerciale mettant en avant le bilinguisme.
**Effort** : 3 à 5 jours (dépend du volume de texte à extraire — c'est le plus gros poste de cette section).

### M-11 [Majeure] — Design responsive absent sur les pages d'entrée/conversion les plus importantes
**Localisation** : `Login.tsx`, `Register.tsx`, `MDRAudit.tsx`, `Classification.tsx` — 0 classe Tailwind responsive (`sm:`/`md:`/`lg:`/`xl:`) détectée dans ces 4 fichiers, contre 71% des pages du site qui en utilisent au moins une.
**Impact** : les parcours de connexion, d'inscription et l'audit MDR lui-même (le référentiel phare du produit) n'ont probablement pas un rendu correct sur mobile/tablette.
**Correction** : audit visuel manuel sur breakpoints mobile/tablette + ajout des classes responsive manquantes.
**Effort** : 2 à 3 jours.

### Mineure — accessibilité de base
- Ratio `aria-*` / éléments interactifs ≈ 6,9% (64 attributs `aria-*` pour 925 éléments interactifs de type bouton/input/select/lien) — faible, mais la majorité des primitives shadcn/ui (Radix) intègrent une accessibilité par défaut correcte ; pas de blocage majeur identifié mais pas d'effort explicite non plus au niveau applicatif.
- Quasi aucune balise `<img>` dans l'app routée (l'essentiel de l'iconographie passe par Lucide, pas par des images) — le risque `alt=` manquant est donc faible en pratique.
- Pas de test au clavier réalisé (hors périmètre de cet audit statique) — à faire en Phase 3/6.
**Effort global accessibilité** : 1 à 2 jours pour une remise à niveau de base (labels ARIA sur les formulaires d'audit, focus visible, navigation clavier sur les wizards).

---

## Synthèse — tableau de priorisation

| ID | Titre | Sévérité | Effort |
|---|---|---|---|
| C-07 | Mismatch transformer tRPC client/serveur — session valide jamais reconnue par l'UI | Critique | 1h (+ revalidation large) |
| C-06 | Reconnexion d'un utilisateur existant impossible (violation NOT NULL) | Critique | 1h |
| C-05 | Backdoor + devLogin publics (contournement total auth) | Critique | 2h |
| C-04 | Token de session forgeable | Critique | 1j |
| C-03 | Mots de passe en clair | Critique | 0,5-1j |
| C-01 | Schéma DB non reconstituable depuis le code | Critique | 0,5j |
| C-02 | Script MDR tronque toutes les questions sans restauration fiable | Critique | 0,5j |
| M-12 | Cookie `secure:true` codé en dur, ignore l'environnement | Majeure | 15min |
| M-08 | Upload de preuves / S3 non implémenté, crash `reports.generate` | Majeure | 2-3j |
| M-07 | Facturation Stripe non implémentée | Majeure | 3-5j |
| M-04 | `AppRouter = any` (perte de sécurité de type) | Majeure | 1-2j |
| M-10 | i18n structurellement incohérente | Majeure | 3-5j |
| M-06 | Pas de rate limiting sur login/register | Majeure | 0,5j |
| M-11 | Responsive absent sur pages clés | Majeure | 2-3j |
| M-01 | Script import MDR cassé (require + colonne obsolète) | Majeure | 1h |
| M-02 | Deux lockfiles | Majeure | 1h |
| M-03 | Doublons de fichiers frontend | Majeure | 0,5j |
| M-05 | Build ignore erreurs TS/ESLint | Majeure | selon M-04 |
| M-09 | Fonctions DB sans filtre owner intégré | Majeure | 2h |
| — | Couverture de tests ~0% hors veille réglementaire | Majeure | Phase 5 |
| — | Nettoyage code mort / artefacts Manus / SEO domaine mort | Mineure | 1-2j cumulés |

**Total Lot 0 (Critique, à faire avant toute mise en avant commerciale, quel que soit le scénario retenu en Phase 5)** : environ **4 à 5 jours** (incluant C-06/C-07/M-12, et le temps de revalidation manuelle de l'ensemble des parcours une fois C-07 corrigé, celui-ci ayant pu masquer la gravité réelle d'autres constats de cet audit).
