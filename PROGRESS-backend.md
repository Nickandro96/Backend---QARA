# QARA Backend — Sécurité des plans, persistance, hygiène

Branche : `claude/qara-backend-securite-persistance-bo77ju`
Rédigé le 2026-07-08. Après une coupure de session, relire ce fichier suffit pour reprendre.

**Statut global : toutes les phases terminées et testées localement (contre MariaDB locale, jamais contre Railway).**

---

## Phase 0 — Cartographie (terminée)

- Environnement local monté : MariaDB installée localement, dépendances `pnpm install`, schéma poussé sur une base `qara_local` dédiée. Tous les tests ci-dessous sont exécutés contre cette base locale.
- Schéma `users` : `role` (`"user" | "admin"`), `subscriptionTier` (`"free" | "pro" | "expert" | "entreprise"`). Le frontend gate aujourd'hui par `subscriptionTier === "free" && role !== "admin"` (pas de fichier `plans.ts` dédié côté frontend — c'est inline par page). J'ai répliqué cette même règle côté serveur.
- Cartographie complète des routeurs/procédures : voir tableau dans le Lot 1 ci-dessous.

### ⚠️ Failles critiques trouvées hors périmètre du prompt, corrigées avec l'accord explicite de l'utilisateur

En cartographiant l'authentification (requis par la Phase 0), trois failles critiques ont été trouvées, puis une quatrième adjacente en testant :

1. **Session forgeable** (`server/_core/sdk.ts`) : le token était `dummy-token-<openId>`, non signé. N'importe qui pouvait forger un cookie et s'authentifier comme n'importe quel utilisateur (admin inclus).
2. **Mots de passe en clair** (`server/_core/passwordUtils.ts`) : `hashPassword`/`verifyPassword` étaient des fonctions identité.
3. **Backdoor codée en dur** (`server/_core/systemRouter.ts`, mutation `login`) : l'email `nickandroklauss@gmail.com` + mot de passe `Admin2026!` créait/promouvait automatiquement un compte admin.
4. **`system.devLogin` ouvert en production** : procédure publique, sans mot de passe, qui accorde le rôle admin à n'importe quel email. Trouvée en creusant le même cluster de failles.

**Décision utilisateur (explicite) : corriger maintenant, dans ce lot**, en acceptant que cela invalide toutes les sessions actives en production au déploiement (tout le monde devra se reconnecter).

**Corrections appliquées :**
- `server/_core/sdk.ts` : tokens de session signés JWT (HS256, librairie `jose` déjà en dépendance). Nécessite la variable d'environnement `SESSION_JWT_SECRET` (≥16 caractères) — **le serveur refuse de démarrer en production sans elle** (fail-fast volontaire). En développement, un secret par défaut non sécurisé est utilisé avec un avertissement console.
- `server/_core/passwordUtils.ts` : hashing scrypt (`node:crypto`, aucune dépendance ajoutée), format `scrypt:<salt>:<clé>`. Les hashs legacy en clair restent vérifiables (fallback `isLegacyHash`) et sont **transparemment migrés vers scrypt au prochain login réussi** — aucun utilisateur existant n'est bloqué.
- `server/_core/systemRouter.ts` : suppression complète du bloc backdoor ; `devLogin` retourne désormais `FORBIDDEN` si `NODE_ENV === "production"`.
- `server/routers.ts` (`auth.me`) : ne renvoie plus `passwordHash` au client (trouvé pendant les tests, corrigé dans la foulée — même cluster, risque nul de régression).

**Testé en local** : forger un cookie `dummy-token-...` renvoie désormais un utilisateur `null` (session invalide). Login normal, re-login avec le hash migré, et `auth.me` fonctionnent correctement pour les 3 profils de test (Free/Pro/Admin).

**⚠️ Point d'attention avant déploiement** : si le compte admin `nickandroklauss@gmail.com` n'existe pas encore dans la base Railway de production (c'est-à-dire s'il n'a jamais été créé via l'ancienne backdoor), il n'y a plus aucun mécanisme pour créer un premier admin en production après ce fix (`devLogin` est maintenant bloqué en prod, `register` crée toujours un `role: "user"`). **Vérifier que ce compte existe déjà en base avant de déployer**, sinon prévoir un `UPDATE users SET role='admin' WHERE email=...` manuel une fois le compte inscrit normalement.

---

## Lot 1 — Vérification du plan côté serveur (terminé)

- **Matrice serveur** : `server/lib/plans.ts` — miroir de la logique frontend (`isAdmin → tout accordé`, sinon `subscriptionTier !== "free" → capacités payantes`). Commenté comme source de vérité à synchroniser manuellement avec le frontend jusqu'au Lot 2 historique de partage de types.
- **Middleware** : `requireCapability(capability)` dans `server/_core/trpc.ts` — session + capacité, sinon `TRPCError({ code: "FORBIDDEN" })` avec message propre (jamais une 500).

### Procédures désormais protégées par plan

| Procédure | Capacité | Comportement Free | Comportement Pro/Admin |
|---|---|---|---|
| `classification.classify` | `canUseClassification` | `FORBIDDEN` | OK |
| `fda.getQualificationQuestions` | `canUseFDA` | `FORBIDDEN` | OK |
| `fda.getQualification` | `canUseFDA` | `FORBIDDEN` | OK |
| `fda.saveQualification` | `canUseFDA` | `FORBIDDEN` | OK |
| `watch.updates` | `canUseVeille` | `FORBIDDEN` | OK |
| `watch.latest` | `canUseVeille` | `FORBIDDEN` | OK |
| `watch.critical` | `canUseVeille` | `FORBIDDEN` | OK |
| `reports.generate` | `canExportReports` | `FORBIDDEN` | OK (bug préexistant en aval, voir Dettes) |
| `audits.create` (referentialIds) | `maxReferentiels` | `FORBIDDEN` si > 1 réf. | OK jusqu'à 7 |
| `audits.update` (referentialIds) | `maxReferentiels` | idem | idem |
| `audits.updateMetadata` (referentialIds) | `maxReferentiels` | idem | idem |

**Explicitement NON gatées (comportement inchangé)** :
- `fda.getFrameworks`, `fda.createAudit`, `fda.getQuestions`, `fda.saveResponse`, `fda.getAuditDashboard`, `fda.getReports`, `fda.getDocuments` — l'audit FDA QMSR reste accessible à tous ; seule la détermination de voie (`getQualification*`/`saveQualification`) est Pro.
- `watch.companyProfile.get/upsert` — hors périmètre (module Veille dynamique séparé).
- `reports.list/get/delete/compare` — lecture reste libre.
- `mdr.*`, `iso.*` — hors périmètre listé, inchangés.
- Aucune procédure IA trouvée dans le code (pas de gating nécessaire pour l'instant).

### Tests exécutés (contre la base locale, comptes Free/Pro/Admin réels créés en base)

Tous testés via `curl` + cookies de session réels (login normal), procédure par procédure :

| Procédure | Free | Pro | Admin |
|---|---|---|---|
| `classification.classify` | ✅ FORBIDDEN | ✅ passe | ✅ passe |
| `fda.getQualificationQuestions` | ✅ FORBIDDEN | ✅ passe | ✅ passe |
| `watch.updates` | ✅ FORBIDDEN | ✅ passe | ✅ passe |
| `reports.generate` | ✅ FORBIDDEN (bloqué avant la logique métier) | ✅ passe le gate (échoue ensuite sur un bug préexistant, voir Dettes) | ✅ idem |
| `audits.create` avec 2 référentiels | ✅ FORBIDDEN (max=1) | — | — |
| `audits.create` avec 3 référentiels | — | ✅ passe le gate | — |
| Régression : `fda.getFrameworks` (non gaté) | ✅ toujours accessible | — | — |
| Régression : `reports.list` (non gaté) | ✅ toujours accessible (bug préexistant en aval, voir Dettes) | — | — |
| Régression : `mdr.getSites` (non gaté) | ✅ toujours accessible | — | — |

---

## Lot 2 — Persistance du profil d'onboarding (terminé)

- **Migration additive** : `drizzle/migrations/0018_onboarding_profiles.sql` — `CREATE TABLE IF NOT EXISTS onboarding_profiles` (userId unique, referentiels JSON, economicRole enum, markets JSON, completedAt, createdAt, updatedAt). Ne touche aucune table/colonne existante. **En attente de feu vert utilisateur pour l'exécution en production.**
- **Choix de modélisation** : persistance par **utilisateur** (`userId` unique), pas par organisation — le projet n'a pas encore de notion d'organisation stable à l'onboarding (l'utilisateur peut créer une organisation après coup, `organisations.userId` existe mais rien ne garantit qu'elle existe au moment de l'onboarding).
- **Procédures** (`server/onboarding-router.ts`, montées sous `onboarding.*`) :
  - `onboarding.getProfile` (session requise) → profil ou `null`.
  - `onboarding.saveProfile` (session + validation zod : `referentiels` ∈ 7 valeurs valides `MDR/IVDR/FDA_QMSR/MDSAP/ISO_13485/ISO_14971/ISO_9001`, `economicRole` ∈ `fabricant/mandataire/importateur/distributeur`, `markets` ∈ `EU/UK/CH/US` ; **`maxReferentiels` du plan appliqué côté serveur**).
- **Compatibilité** : additif, le frontend continue de fonctionner avec `localStorage` tant que le raccord n'est pas fait.

### Tests exécutés

- `getProfile` sans données → `null` ✅
- `saveProfile` Free avec 2 référentiels → `FORBIDDEN` (max=1) ✅
- `saveProfile` Free avec 1 référentiel → succès ✅, relu correctement ensuite ✅
- `saveProfile` Pro avec 3 référentiels → succès ✅
- `saveProfile` avec référentiel invalide → `BAD_REQUEST` (zod) ✅
- `saveProfile` avec rôle économique invalide → `BAD_REQUEST` (zod) ✅
- `getProfile` sans session → `UNAUTHORIZED` ✅

---

## Lot 3 — Hygiène (terminé)

1. **CORS** (`server/_core/index.ts`) : déjà piloté par variable d'environnement (`ALLOWED_ORIGINS`, CSV), avec une liste par défaut + un pattern pour les previews Vercel (`*.vercel.app` contenant `frontend-qara`). **Jamais `*`** (credentials: true). Rien à corriger — vérifié, pas modifié.
2. **Fuite de détails internes en erreur** : le formateur d'erreur par défaut de tRPC n'inclut `error.stack` que si `config.isDev` est vrai, lui-même dérivé de `NODE_ENV !== "production"`. Le script `start` du `package.json` fixe explicitement `NODE_ENV=production`. **Vérifié en local** (mode dev) que le stack apparaît bien dans la réponse — confirmant qu'il disparaît en production. Rien à corriger.
3. **Rate limiting sur l'authentification** : **aucun trouvé** (pas de dépendance `express-rate-limit` ou équivalent, aucun code de throttling sur `login`/`register`). Non implémenté ici conformément à la consigne — **consigné comme dette prioritaire ci-dessous**.

---

## Dettes restantes (trouvées pendant l'audit/les tests, hors périmètre de ce lot)

1. **Rate limiting absent sur `login`/`register`** — recommandation : `express-rate-limit` par IP + par email, ou un compteur en base avec verrouillage progressif. Priorité haute (force brute possible sur les mots de passe, même hashés).
2. **`audits.create`/`audits.update` envoient un champ `auditType` à `db.createAudit`, mais la colonne réelle du schéma est `type`** (`drizzle/schema.ts`, table `audits`). Résultat : `INSERT` qui échoue avec « Field 'type' doesn't have a default value » — reproduit en local avec un compte Pro ET un compte Free (après avoir passé le nouveau contrôle de plan, donc bug indépendant de ce lot). **Je n'ai pas touché à ce code** (hors périmètre « ne pas réécrire la logique métier existante », et je n'ai pas de visibilité sur un éventuel drift de schéma en production qui masquerait ce bug côté Railway). À vérifier en priorité : si la création d'audit est aussi cassée en production, c'est un bug bloquant pour tous les utilisateurs, indépendant de la sécurité des plans.
3. **`reports.generate`/`reports.list`** échouent également en aval (schéma `audit_reports` désynchronisé du code — colonnes `reportType`, `generatedAt`, etc. utilisées par `routers.ts` mais absentes de `drizzle/schema.ts`). Même remarque : pré-existant, non corrigé, à vérifier en production.
4. **Lot 2 historique (partage de types `AppRouter` entre dépôts)** — toujours hors périmètre, non traité ici.
5. **Bootstrap admin en production** — voir l'encadré Phase 0 : vérifier que `nickandroklauss@gmail.com` existe déjà en base avant de déployer, la backdoor qui le créait automatiquement a été supprimée.

---

## E. Livrables pour l'utilisateur

### 1. Migrations à exécuter en production (en attente de feu vert)

- `drizzle/migrations/0018_onboarding_profiles.sql` — `CREATE TABLE IF NOT EXISTS onboarding_profiles (...)`. Additive uniquement, aucun impact sur les tables existantes. Commande : `mysql <connexion Railway> < drizzle/migrations/0018_onboarding_profiles.sql` (ou via un client SQL équivalent).

### 2. Variables d'environnement à créer/modifier dans Railway

- **`SESSION_JWT_SECRET`** (nouvelle, **obligatoire**) — chaîne aléatoire ≥32 caractères, sert à signer les cookies de session (JWT HS256). **Le serveur refuse de démarrer en production sans elle.** À générer une seule fois et ne jamais la faire tourner sans invalider toutes les sessions actives.
- `ALLOWED_ORIGINS` — déjà existante, aucune action requise (vérifiée, correctement utilisée).

### 3. Procédures désormais protégées par plan (pour le futur lot de raccord frontend)

Voir tableau complet dans la section Lot 1 ci-dessus. Résumé : `classification.classify`, `fda.getQualificationQuestions/getQualification/saveQualification`, `watch.updates/latest/critical`, `reports.generate`, et `audits.create/update/updateMetadata` (limite `maxReferentiels`).

### 4. Dettes restantes

Voir section « Dettes restantes » ci-dessus (rate limiting, bug `auditType`/`type`, bug schéma `audit_reports`, Lot 2 historique, bootstrap admin production).
