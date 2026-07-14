# DIAGNOSTIC FINAL — Topologie des branches backend QARA

*Rédigé le 2026-07-10. Aucune action exécutée contre une base de données ou contre Railway dans le cadre de ce document — diagnostic + requêtes de lecture + recommandation uniquement, conformément à la règle absolue posée par l'utilisateur.*

---

## A. Fait confirmé (preuve Railway, fournie par l'utilisateur)

Le déploiement **actif** du service `backend-qara-new-claude` — celui que l'application réelle utilise — est :

- Branche : `claude/qara-compliance-audit-qitbxl`
- Commit : `ba779bb5` (à noter : le dernier commit connu sur cette branche au moment de l'exploration était `bfc88cf7` ; `ba779bb5` est soit un commit plus récent poussé entre-temps, soit une divergence de hash à réconcilier — **à vérifier** via `git log origin/claude/qara-compliance-audit-qitbxl --oneline -5` avant toute action future, ne pas supposer que `bfc88cf7` est encore le tip)
- Déployé le 8 juillet 2026, statut Active

**Conséquence directe** : tout le travail des deux derniers jours sur `main` (Lot 1 sécurité scrypt/JWT `SESSION_JWT_SECRET`, Lot 2 `onboarding_profiles`/migration 0019, corpus 826 questions MDR) a été mergé et est potentiellement déployé sur `backend-qara-production` — **un environnement Railway distinct que l'application réelle n'utilise pas**. Rien de ce travail n'est actuellement vivant côté utilisateur final.

---

## B. Les 4 requêtes de corroboration (lecture seule — à exécuter par l'utilisateur contre `new-claude`)

```sql
-- A. Format du hash de mot de passe : bcrypt (qitbxl) vs scrypt (main) vs autre
--    Inclut explicitement le compte admin pour trancher la question du §C.
SELECT id, email, LEFT(passwordHash, 12) AS hash_prefix, lastSignedIn
FROM users
ORDER BY (email = 'nickandroklauss@gmail.com') DESC, id
LIMIT 10;
-- bcrypt (qitbxl)  -> commence par $2a$, $2b$ ou $2y$
-- scrypt (main)    -> commence par "scrypt:"
-- ni l'un ni l'autre -> aucun des deux correctifs sécurité déployé (probable legacy plaintext)

-- B. Colonnes "rich fields" du corpus 473 (migration 0018_rich_question_fields.sql, qitbxl)
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'questions'
  AND COLUMN_NAME IN (
    'auditVerifies','relances','explanationSimple','concreteExample',
    'conformityCriteria','typicalNc','mappings','referenceStatus','officialSource'
  );
-- 9 lignes -> qitbxl déployé ; 0 ligne -> qitbxl absent

-- C. Table onboarding_profiles (Lot 2, ma branche main) — présente ou non
SHOW TABLES LIKE 'onboarding_profiles';

-- D. Colonnes du scope engine onboarding (qitbxl, commit 4a30bcae)
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'questions' AND COLUMN_NAME IN ('roleReglementaire','situationTags'))
    OR (TABLE_NAME = 'audits' AND COLUMN_NAME IN ('economicRoles','markets','situationTags'))
  );
```

### Grille de lecture

| A (hash) | B (9 col.) | C (onboarding_profiles) | D (scope engine) | Conclusion |
|---|---|---|---|---|
| bcrypt | 9/9 | absente | présentes | `new-claude` = qitbxl pur, aucune trace de `main` |
| scrypt | 0/9 | présente | absentes | `new-claude` = main pur (mais alors le corpus 473 viendrait d'ailleurs — hypothèse peu probable vu la preuve Railway du §A) |
| bcrypt | 9/9 | présente | présentes | hybride — les deux lignées ont déjà été mélangées sur cette base, quelqu'un a fait un merge ou une migration croisée |
| autre | — | — | — | ni l'un ni l'autre déployé, hypothèse à rouvrir entièrement |

---

## C. Résolution de l'énigme du login admin (scrypt stocké, login qui fonctionne quand même)

**Ne pas conclure avant le résultat de la requête A ci-dessus** — mais voici le mécanisme exact en cause, lu directement dans le code déployé (`server/_core/passwordUtils.ts` sur `qitbxl`) :

```ts
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  // Legacy plaintext hash, pre-dating this fix.
  return password === hash;
};
```

Le code qitbxl ne connaît que deux cas : hash bcrypt (`$2a$`/`$2b$`/`$2y$`), ou tout le reste traité comme **mot de passe en clair** (comparaison stricte `password === hash`). Un hash au format `scrypt:<sel>:<dérivé>` (produit par le script de la lignée `main`) tombe dans la seconde branche.

**Conséquence logique** : si votre compte admin sur `new-claude` a réellement été écrasé par un hash `scrypt:...`, une connexion avec votre vrai mot de passe devrait **échouer** — `verifyPassword` comparerait littéralement `"VotreMotDePasse" === "scrypt:abc123:def456"`, ce qui est faux sauf coïncidence extraordinaire.

Puisque vous rapportez que le login fonctionne, trois hypothèses restent ouvertes (la requête A tranchera, aucune n'est retenue par défaut) :

1. **Le script de changement de mot de passe a été exécuté contre la mauvaise base** (`backend-qara-production`, ids 1-7, au lieu de `new-claude`) — cohérent avec toute la confusion de topologie de cette session. Dans ce cas, `new-claude` n'a jamais reçu le hash scrypt, et le login qitbxl fonctionne normalement sur le hash qu'il connaît déjà (bcrypt ou legacy-plaintext).
2. **Le "login qui fonctionne" est en réalité une session déjà active** (cookie JWT posé avant le changement de mot de passe, jamais invalidé) plutôt qu'une nouvelle tentative de connexion réussie — auquel cas aucune vérification de mot de passe n'a réellement eu lieu récemment.
3. **Le script d'UPDATE a échoué silencieusement ou a ciblé la mauvaise ligne/table** sur `new-claude` (mauvais `openId`, mauvaise casse d'email, transaction non commitée, etc.).

La requête A donne la réponse : si `hash_prefix` pour votre ligne commence par `scrypt:`, l'hypothèse 2 ou 3 est la bonne (le hash est bien là mais le login ne l'a pas vérifié) ; si elle montre `$2a$`/`$2b$`/`$2y$` ou autre chose que `scrypt:`, l'hypothèse 1 est la bonne (l'UPDATE n'a jamais atteint cette base).

**Aucune conclusion n'est retenue tant que vous n'avez pas exécuté la requête A.**

---

## D. Comparaison fonctionnalité par fonctionnalité

| Domaine | `qitbxl` (déployé, prod réelle) | `main` (notre travail, 2 derniers jours) | Statut |
|---|---|---|---|
| **Session / auth token** | JWT signé via `jose`, secret `JWT_SECRET`, réf. doc "C-04" | JWT signé via `jose`, secret `SESSION_JWT_SECRET`, réf. Lot 1 | **Doublon** — même solution, nom de variable d'env différent. Si réconciliation, il faudra choisir UN nom de secret et vérifier lequel est réellement positionné dans les variables Railway de `new-claude`. |
| **Hash de mot de passe** | bcryptjs, 12 rounds, fallback legacy = comparaison **plaintext** stricte, réf. "C-03" | scrypt (`node:crypto`), fallback legacy via `isLegacyHash()` | **Doublon** — bcrypt et scrypt sont tous deux des choix valides et modernes. Pas de faille béante des deux côtés, mais les formats sont incompatibles entre eux (voir §C) : une bascule entre les deux lignées sans script de ré-encodage casserait le login de tous les comptes existants. |
| **Backdoor de login codée en dur** | Supprimée (`docs/audit/06-lot0-implementation.md` : "C-05 — Suppression du backdoor codé en dur et de `system.devLogin`") | Supprimée par mes soins lors du Lot 1 (elle existait sur l'ancien `main`, avant mon intervention) | **Doublon, réglé des deux côtés indépendamment.** Confirmé par lecture du code : `systemRouter.ts` sur `qitbxl` ne contient plus aucun email/mot de passe hardcodé, `login` fait un vrai `getUserByEmail` + `verifyPassword`. |
| **`devLogin` (admin-grant sans mot de passe)** | **Confirmé supprimé.** `git grep devLogin` sur le code source de `qitbxl` ne retourne plus aucune occurrence dans `server/`, seulement des mentions historiques dans `docs/audit/`. Remplacé par `scripts/promote-admin.ts`, un CLI one-shot **jamais exposé en HTTP** (`DATABASE_URL=... npx tsx scripts/promote-admin.ts email@example.com`), qui exige que le compte existe déjà. | Corrigé (bloqué hors `NODE_ENV !== "production"`) | **Doublon, réglé des deux côtés** — approche de `qitbxl` (suppression + CLI hors-HTTP) plus stricte que la mienne (garde conditionnelle par env). |
| **`auth.me` fuite de `passwordHash`** | **Confirmé présent — faille réelle, non corrigée sur `qitbxl`.** `auth.me` fait `publicProcedure.query((opts) => opts.ctx.user)` (`server/routers.ts:70`). `ctx.user` est peuplé par `createContext` (`server/_core/trpc.ts`) via `db.getUserByOpenId(openId)`, qui fait `db.select().from(users).where(...)` **sans exclure aucune colonne** (`server/db.ts:701-706`) — donc `passwordHash` (le hash bcrypt) est inclus dans `ctx.user` et renvoyé tel quel par `auth.me` à tout client authentifié qui l'appelle. | Corrigé (destructuration avant retour) | **Apport unique de `main` — faille réelle et vérifiée, absente de `qitbxl`.** Un hash bcrypt qui fuit n'expose pas le mot de passe en clair, mais permet une attaque hors-ligne (brute-force/dictionnaire) sur le hash sans même toucher au serveur. À corriger avant toute autre chose si vous confirmez que le gating des plans doit aussi être porté (Option 1 du §F). |
| **Bug `upsertUser` sans email (login cassait tout)** | Déjà corrigé sur `qitbxl` (commit référencé "C-06" dans le code lu au §C) | Corrigé indépendamment sur `main` (même bug, même fix) | **Doublon** — bug réel préexistant, trouvé et corrigé des deux côtés indépendamment. |
| **Gating serveur des plans (classification/FDA/veille/export)** | **Confirmé absent.** `git grep` sur `requireCapability`, `maxReferentiels`, `canUseClassification`, `canUseFDA`, `PAID_PLAN`, `FREE_PLAN`, `isPaidTier` dans `server/` sur `qitbxl` : **zéro résultat**. | Construit de A à Z (Lot 1 : `server/lib/plans.ts`, middleware `requireCapability`) | **Apport unique de `main`, confirmé manquant sur `qitbxl`.** La production réelle laisse actuellement tout compte authentifié (Free ou Pro) accéder aux endpoints classification/FDA/veille/export côté serveur — le frontend peut gater visuellement, mais rien ne bloque un appel API direct. |
| **Rate limiting sur `login`/`register`** | **Confirmé absent** (`git grep` sur `rate-limit`/`rateLimit`/`express-rate-limit` dans `server/` et `package.json` : zéro résultat). Documenté par `qitbxl` lui-même comme dette dans `docs/audit/02-audit-technique.md` (C-05, recommandation non appliquée). | **Également absent** — mon Lot 3 (hygiène) a documenté cette même absence comme dette prioritaire dans `PROGRESS-backend.md` ("Rate limiting absent sur login/register... Priorité haute"), sans l'implémenter, conformément à la consigne de ce lot. | **Dette partagée, présente des deux côtés, ni l'un ni l'autre ne l'a résolue.** Pas un différenciateur entre les lignées — un vrai manque commun à traiter, indépendamment du choix de lignée. |
| **Bug `auditType`/`type` sur `audits.create`/`update` (routeur générique `routers.ts`)** | **Confirmé également présent sur `qitbxl`** — `server/routers.ts` (commun aux deux lignées) fait `db.createAudit({ ..., auditType: input.auditType, ... })`, et `db.createAudit` (`server/db.ts:515-526`) fait `db.insert(audits).values({...input})` sans jamais mapper `auditType` → la colonne réelle `type`. Ce chemin échouerait à l'exécution sur les deux lignées si un client l'appelait. | Même bug, documenté comme dette non corrigée dans `PROGRESS-backend.md` (reproduit en local, Pro et Free). | **Bug partagé, préexistant aux deux lignées, non corrigé nulle part.** Semble néanmoins **sans impact réel constaté** : le flux d'onboarding réel crée les audits via `mdr-router.ts` (`createOrUpdateAuditDraft`), qui gère `type`/`auditType` correctement des deux côtés — c'est probablement pourquoi le test de bout en bout documenté par `qitbxl` (§E.2) a pu réussir malgré ce bug latent dans le routeur générique. **À vérifier avant de conclure que le chemin `routers.ts`.`audits.create` est vraiment mort côté frontend**, plutôt que de l'assumer. |
| **Persistance profil onboarding (référentiels/rôle/marchés)** | A son propre mécanisme, plus riche : `questions.roleReglementaire/situationTags` + `audits.economicRoles/markets/situationTags` (pluriel) + moteur `scopeEngine` pur et testé + routeur `getScopeOptions/previewCount/saveProgress/getMyScope/complete` (commit `4a30bcae`) | Table simple `onboarding_profiles` (referentiels/economicRole singulier/markets) + validation `maxReferentiels` | **`qitbxl` est fonctionnellement supérieur et déjà en prod** — c'est un système de scope plus fin (rôles multiples, tags de situation, compteur live anti-drift) que ma table plate. Mon Lot 2 serait une régression fonctionnelle s'il remplaçait celui de `qitbxl`. |
| **Corpus de questions** | 473 questions (MDR 80/IVDR 72/FDA_QMSR 43/MDSAP 74/ISO13485 93/ISO14971 67/ISO9001 44), remplace un ancien corpus 826-MDR + 2 référentiels FDA distincts, décision documentée validée 04/07/2026 | Corrigeait les scripts d'import de l'**ancien** corpus (826 MDR + FDA_QSR_21CFR820/FDA_US_MARKET_ACCESS) | **Obsolète côté `main`** — mes correctifs corpus (idempotence, upsert, encodage, alias process, rôle dans la clé) sont de bonne qualité technique mais ciblent un corpus déjà remplacé intentionnellement. Ne pas les réappliquer contre `new-claude`. |
| **Granularité `processus`** | ~240 lignes, sous-processus fins par référentiel, design voulu (doc `07-import-corpus.md`) | Ma correction traitait un excès de processus comme un bug potentiel à surveiller | **Non-problème côté `qitbxl`** — mon inquiétude initiale (sur l'ancienne base 1-7) ne s'applique pas ici. |
| **CAPA / plans d'action** | Lot dédié déjà livré (commit `174a5bf6`, "Lot 3: CAPA action plan engine and router") | Non traité dans mon périmètre | **Apport unique de `qitbxl`**, absent de `main`. |
| **Rôle réglementaire — bug de filtre 338/473 questions exclues** | Trouvé ET corrigé par `qitbxl` lui-même (commit `4a30bcae`, décrit en détail dans son propre message de commit) | N/A (bug spécifique au moteur de scope de `qitbxl`, n'existe pas dans mon modèle `onboarding_profiles`) | **Propre à `qitbxl`, déjà réglé.** |

---

## E. État de santé réel de la production (`new-claude`)

**Sous réserve des résultats des requêtes du §B (état réel de la base) — le reste ci-dessous est confirmé par lecture directe du code de `qitbxl`, plus aucun point n'est en attente côté code source :**

1. **Sécurité session/mot de passe** : `qitbxl` a un JWT signé et un hachage bcrypt — les deux failles les plus critiques que j'avais trouvées sur l'ancien `main` (tokens forgeables, mots de passe en clair, backdoor codée en dur, `devLogin` public) sont **confirmées fermées** côté `qitbxl`, indépendamment et même plus strictement que sur `main` (CLI hors-HTTP `promote-admin.ts` plutôt qu'une simple garde d'environnement). **Un point reste une faille réelle et confirmée, non corrigée sur `qitbxl`** : `auth.me` renvoie `passwordHash` (le hash bcrypt) à tout client authentifié qui l'appelle (voir §D) — exposition à une attaque hors-ligne sur le hash, pas une compromission triviale mais un vrai défaut à corriger.

2. **Corpus** : le test de bout en bout documenté dans `docs/audit/CR-etat-actuel-et-passation-refonte-UX.md` (inscription → audit MDR → 62 questions → 59 répondues → score 76% → export réussi) est présenté comme validé par l'équipe qitbxl elle-même, daté du même cycle que le reste de leur audit. Je le rapporte tel que documenté — **je ne l'ai pas ré-exécuté moi-même contre `new-claude`** (conforme à la règle : rien exécuté contre la prod réelle). Si vous voulez une preuve fraîche, ce serait une action en lecture seule (un audit de test, sans toucher aux données existantes) que vous pourriez lancer ou que je pourrais préparer en environnement local seulement.

3. **Ce qui manque confirmé à la production et qui serait important** :
   - **Le gating serveur des plans (Lot 1 de `main`)** — confirmé absent de `qitbxl` par recherche exhaustive dans le code (§D). C'est le manque le plus sérieux : un compte Free peut actuellement appeler directement les endpoints classification/FDA/veille/export via l'API (en contournant le frontend) sans blocage serveur.
   - **La fuite `passwordHash` via `auth.me`** (point 1 ci-dessus) — confirmée, à corriger.
   - **Le rate limiting sur `login`/`register`** — confirmé absent des deux côtés (dette partagée, pas un écart entre lignées, voir §D).
   - **Le bug `auditType`/`type` sur le routeur générique `audits.create`/`update`** — confirmé présent des deux côtés dans `server/routers.ts`, mais vraisemblablement sans impact réel car le flux d'onboarding utilise un autre chemin (`mdr-router.ts`) qui gère ce champ correctement. À vérifier que le frontend n'appelle jamais ce chemin générique avant de le classer totalement inoffensif.

---

## F. Options de réconciliation

### Option 1 — Adopter `qitbxl` comme référence, porter par-dessus uniquement ce qui manque

**Ce que ça implique** : prendre `qitbxl` comme nouvelle base de travail, puis porter dessus *seulement* le gating serveur des plans (Lot 1 de `main`), après vérification que `qitbxl` ne l'a vraiment pas. Abandonner mon Lot 2 (`onboarding_profiles`) au profit du scope engine déjà supérieur de `qitbxl`. Abandonner entièrement le lot corpus (826 questions) qui ciblait un corpus déjà remplacé.

**Risques** : faible — on ajoute une fonctionnalité manquante sur du code déjà en production, sans toucher à ce qui marche. Le seul risque technique est que le gating de `main` référence des tables/colonnes (ex. `maxReferentiels`, capacités liées aux référentiels) qui doivent être adaptées au modèle de scope de `qitbxl` (économicRoles pluriel, etc.) plutôt que copiées telles quelles.

**Effort** : modéré — réécrire le middleware `requireCapability` et son branchement sur les routeurs classification/FDA/veille/export en tenant compte du modèle de plans de `qitbxl` (à vérifier s'il existe déjà partiellement).

**Impact production** : minimal si fait avec précaution (nouveau code additif, testé en local d'abord, jamais de migration destructive).

### Option 2 — Réconcilier les deux lignées (merge complet `main` ↔ `qitbxl`)

**Ce que ça implique** : un vrai travail de merge/rebase entre les 36+ commits divergents de chaque côté, résolution des doublons (JWT secret name, password hash format, upsertUser bug — déjà réglé des deux côtés donc juste choisir une version), arbitrage entre `onboarding_profiles` et le scope engine, décision sur le corpus (garder le 473 de `qitbxl`, jeter le 826 de `main`).

**Risques** : élevé — un merge de deux lignées aussi divergentes (deux migrations "0018" différentes, deux systèmes de hash de mot de passe incompatibles entre eux) est un terrain à conflits nombreux et à erreurs de bascule (ex. si mal fait, un déploiement pourrait invalider tous les mots de passe existants en forçant un format sur l'autre sans script de transition).

**Effort** : élevé — plusieurs jours de travail rigoureux, tests de non-régression complets requis avant tout déploiement.

**Impact production** : potentiellement significatif si mal exécuté — c'est l'option la plus susceptible de casser ce qui fonctionne actuellement, précisément ce que la règle absolue interdit de risquer sans extrême précaution.

### Option 3 — Ne rien toucher à la lignée `qitbxl`, traiter `main` comme un brouillon de recherche archivé

**Ce que ça implique** : accepter que le travail de sécurité/persistance/corpus des deux derniers jours a servi de diagnostic et de preuve de concept, mais ne sera jamais déployé tel quel. On documente les apports (bugs trouvés, comme `upsertUser`) pour mémoire, et on repart du diagnostic ci-dessus pour décider, au cas par cas et un par un, quoi porter sur `qitbxl` — sans jamais viser un "merge global".

**Risques** : très faible — aucune action large, tout se fait petit à petit et vérifié.

**Effort** : faible à court terme, mais remet à plus tard la décision sur chaque brique individuellement.

**Impact production** : nul tant qu'aucun portage individuel n'est fait.

---

## G. Recommandation (proposition à valider — pas une décision prise)

Je recommande une **combinaison de l'Option 1 et de l'Option 3** : ne pas tenter un merge global (Option 2) — le risque de casser la production en forçant la réconciliation de deux systèmes de hash de mot de passe incompatibles ou de deux migrations "0018" homonymes est disproportionné par rapport au bénéfice. `qitbxl` est déjà en production, fonctionnel, et fonctionnellement plus riche que `main` sur la persistance onboarding et le corpus — l'écraser ou le fusionner de force serait le contraire de l'objectif "ne pas casser ce qui tourne".

À la place, par ordre de priorité :
1. **Corriger la fuite `passwordHash` dans `auth.me`** sur `qitbxl` — confirmée par lecture de code (§D), correctif trivial et isolé (destructurer `passwordHash` avant de retourner `ctx.user`, exactement comme déjà fait sur `main`), risque de régression quasi nul.
2. **Porter le gating serveur des plans** (confirmé absent, §D/§E) comme un ajout ciblé et isolé partant de `qitbxl` — pas un merge, une nouvelle branche avec ce seul lot dessus, adapté au modèle de scope de `qitbxl` (économicRoles pluriel, etc.) plutôt que copié tel quel de `main`, testé en local avant tout déploiement.
3. **Vérifier que le routeur générique `audits.create`/`update` (bug `auditType`/`type`) n'est réellement jamais appelé par le frontend** avant de le classer sans impact — sinon, à corriger également (mapping trivial, même schéma des deux côtés).
4. **Traiter le rate limiting `login`/`register`** comme une dette commune à résorber sur `qitbxl`, indépendamment du choix de lignée — les deux audits (le mien et celui de `qitbxl`) la documentent déjà comme prioritaire.
5. **Abandonner** mon Lot 2 (`onboarding_profiles`) et le lot corpus (826 questions) — les traiter comme du travail de diagnostic qui a rempli son rôle (ils ont notamment mis en évidence le bug `upsertUser`, déjà réglé indépendamment côté `qitbxl`) mais qui ne doit pas être déployé.
6. **Renommer/documenter** clairement dans le dépôt que `claude/qara-compliance-audit-qitbxl` est la lignée de référence pour tout travail futur ciblant `backend-qara-new-claude`, pour éviter qu'un futur agent (moi ou un autre) reparte encore une fois de `main` par erreur.

Cette proposition n'est pas actée — elle attend votre validation avant toute branche, tout commit de code (au-delà de ce diagnostic), ou toute vérification supplémentaire.
