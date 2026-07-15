# RECONCILIATION — Journal (frontend bo77ju ↔ backend qitbxl)

*Branche backend : `claude/qara-backend-assainissement-qitbxl` (issue de `qitbxl`, jamais poussée sur `qitbxl`). Branche frontend : à créer à partir de `bo77ju` pour l'Étape 3. Un commit par étape.*

## Étape 1 — Compte admin bcrypt

Déjà livrée avant ce prompt (commit `54aa7f21`) : `scripts/generate-bcrypt-admin-hash.ts` (testé bout en bout) + `PROCEDURE-reparation-admin.md`. Rien de nouveau ici — en attente que l'utilisateur exécute la procédure.

## Étape 2 — Backend : endpoints d'audit manquants

### Environnement de test local

Base MariaDB locale dédiée (`qara_qitbxl_local`), montée avec la **séquence réelle de production** (le `release` de `package.json`) : `scripts/apply-sql-migrations.ts` (copie locale avec SSL désactivé pour MariaDB, logique intacte) puis `scripts/import-corpus.mjs` tel quel. Résultat : 473 questions réelles, comptages identiques à la production (MDR 80, IVDR 72, FDA_QMSR 43, MDSAP 74, ISO13485 93, ISO14971 67, ISO9001 44). Les IDs locaux (MDR=6, IVDR=7, FDA_QMSR=8, MDSAP=9, ISO14971=10) diffèrent des IDs de production (3-9) — normal et sans importance : ça confirme que plus rien ne doit dépendre d'un ID figé, seulement du `code`.

Serveur qitbxl lancé en local (`tsx server/_core/index.ts`), utilisateur de test inscrit, audit MDR réel créé via `mdr.createOrUpdateAuditDraft` avec `referentialIds` **résolu dynamiquement par `SELECT id FROM referentiels WHERE code='MDR'`** (jamais en dur), 62 réponses réelles enregistrées via `mdr.saveResponse` (47 `compliant`, 15 `non_compliant` — le sous-ensemble de 62 questions correspond exactement au chiffre documenté par qitbxl pour le rôle fabricant).

### Endpoints ajoutés à `server/audit-router.ts` (namespace `audit`, singulier)

Réutilisent `getAuditContextInternal`/`fetchAuditScopedQuestions` (exportées depuis `server/mdr-router.ts`, ajout du mot-clé `export` uniquement — aucun changement de comportement pour les appelants existants) pour le scoping (rôle économique, onboarding multi-rôles, filtrage processus) — jamais de logique dupliquée pour cette partie. Le calcul de score (barème `compliant=100/partial=60/non_compliant=20/not_applicable=100/in_progress=50`) reprend exactement celui déjà utilisé par `mdr.getAuditDashboard`/`iso-router.ts`.

| Procédure | Statut | Preuve (test réel, audit id=1, 62 réponses réelles) |
|---|---|---|
| `audit.list` | ✅ ajoutée, testée | Retourne l'audit id=1 avec ses champs complets |
| `audit.listAudits` | ✅ ajoutée (alias, deux noms frontend différents pour le même besoin) | Idem |
| `audit.getById` | ✅ ajoutée, testée | Retourne l'audit id=1 ; testé aussi sur id inexistant → 404 propre |
| `audit.delete` | ✅ ajoutée, testée | Créé un audit jetable id=2, supprimé avec succès, confirmé absent ensuite (404) ; testé aussi sur id=999 (inexistant) → 404, pas de crash |
| `audit.get` | ✅ ajoutée, testée | `{"score":80.6,"stats":{"totalQuestions":62,"answered":62,"compliant":47,"non_compliant":15,...}}` — 47×100+15×20)/62 = 80.6, calcul vérifié |
| `audit.getStats` | ✅ ajoutée, testée | Même résultat que `get`, sans les champs audit |
| `audit.getScore` | ✅ ajoutée, testée | `{"score":80.6,"totalQuestions":62,"answered":62}` |
| `audit.generatePDF` | ❌ **non implémentée ce tour-ci** | Voir "Découverte bloquante" ci-dessous |

### Dashboard : `getSummary`/`getFunnel`/`getHeatmap` câblés

Les fonctions existaient déjà dans `server/db-dashboard-v2.ts` (`getDashboardSummary`, `getDashboardFunnel`, `getDashboardHeatmap`) mais n'étaient jamais exposées dans le routeur tRPC — code mort côté serveur. Ajoutées dans `server/routers.ts` en suivant exactement le même pattern que `getStats`/`getTimeseries` déjà existants (mêmes filtres `period`/`siteId`). Testées : répondent sans crash ni 404 (`getSummary` retourne `totalAudits:1`, `getFunnel` retourne les 5 étapes de l'entonnoir, `getHeatmap` retourne un tableau vide faute de constats). **Mais voir la découverte ci-dessous : leurs champs de score restent à 0, pour une raison différente du problème d'origine.**

### 🔴 Découverte bloquante (nouvelle, confirmée par lecture de code — pas une hypothèse)

**La table `audits` n'a AUCUNE colonne `score` ni `conformityRate`** (vérifié dans `drizzle/schema.ts`, définition complète de la table `audits` lignes 185-219 — ces deux colonnes n'existent nulle part). Or `getDashboardSummary` (qui alimente `getDashboardStats`, qui alimente lui-même `dashboard.getKPIs` — **l'endpoint réellement utilisé par la page `/dashboard` de production**) fait :

```js
const scoresAndRates = userAudits
  .filter(a => a.score && a.conformityRate)   // toujours undefined && undefined → toujours faux
  .map(a => ({ score: parseFloat(a.score!), conformityRate: parseFloat(a.conformityRate!) }));

const averageAuditScore = scoresAndRates.length > 0 ? ... : 0;   // → TOUJOURS 0
```

**Conséquence : `dashboard.getKPIs` renverra un score global à 0% pour TOUT utilisateur, TOUT audit, quel que soit le référentiel, même une fois le problème `referentialIds:[1]` corrigé.** Ce n'est pas un problème de mauvais ID — c'est que la colonne lue n'existe tout simplement pas. Seul `fda-router.ts` écrit quelque chose qui ressemble à un score (`resultats.score`/`conformityRate`, une table SÉPARÉE), et même ça n'est jamais lu par `getDashboardSummary` (qui ne lit que la table `audits` directement, pas de jointure vers `resultats`). MDR et ISO n'écrivent de score nulle part : `mdr.completeAudit` se contente de `status: "completed"`, sans jamais calculer ni stocker de score.

**Impact concret sur l'Étape 4** : re-tagger l'audit de production (userId 2) avec le bon `referentialId` (3 au lieu de 1) ne suffira PAS à faire réapparaître le ~76% sur le dashboard `/dashboard` (page réelle utilisée en production), à cause de ce bug séparé et plus profond. Les endpoints par-audit que je viens de livrer (`audit.get`/`getStats`/`getScore`, utilisés par `AuditResults.tsx`/`Reports.tsx`) calculent le score **à la volée** et ne dépendent PAS de ces colonnes manquantes — donc ceux-là fonctionneront correctement après l'Étape 3/4. Mais la vue d'ensemble du dashboard (`/dashboard`, `getKPIs`) restera à 0% tant que ce second problème n'est pas traité séparément.

**Je n'ai rien corrigé de ce second problème** — corriger `getDashboardSummary` pour calculer le score à la volée (comme je l'ai fait pour `audit.getScore`) au lieu de lire des colonnes inexistantes serait la solution la plus proche de "réutiliser sans réécrire", mais c'est un changement plus large que ce que Étape 2 demandait explicitlement, et ça touche une fonction partagée par plusieurs vues. **Je le signale avant d'agir, comme prévu par les règles.**

### 🔴 Découverte bloquante n°2 (indépendante) — `reports.generate`/`generateAuditReport` plante

Testé en conditions réelles (`curl` contre le serveur local, audit id=1) : `reports.generate` lève une exception à chaque appel, **avant même d'atteindre l'upload S3**. Trace exacte :
```
TypeError: Cannot read properties of undefined (reading 'length')
    at generateContextSection (server/report-generator.ts:377:17)
    at generateCompleteReport (server/report-generator.ts:240:3)
    at generateAuditReport (server/report-generator.ts:73:14)
```
Bug préexistant, indépendant de tout ce que j'ai touché, dans la génération du contenu du rapport (pas le stockage — `server/storage.ts` est lui-même un stub vide `export const storagePut = async () => {}`, un second problème latent qui causerait un crash différent si le premier était corrigé). **`audit.generatePDF` n'a donc pas été implémenté ce tour-ci** : le proxifier vers `reports.generate` aurait juste transporté un crash existant sous un nouveau nom, ce qui ne serait pas honnête à présenter comme "corrigé". À trianger séparément.

### Ce qui est prêt à livrer

Commit à venir sur `claude/qara-backend-assainissement-qitbxl` : `list`, `listAudits`, `getById`, `delete`, `get`, `getStats`, `getScore` (tous testés avec des données réelles), `dashboard.getSummary`/`getFunnel`/`getHeatmap` câblés (testés, ne crashent plus, mais champs de score à 0 pour la raison ci-dessus). **Non déployé, non mergé.**

### Extension validée par l'utilisateur : correction de `getDashboardSummary`/`getKPIs`

Suite à validation explicite ("oui"), la découverte bloquante n°1 ci-dessus a été corrigée, pas seulement documentée.

**Refactor** : extrait `computeGenericAuditStats` (qui était dans `audit-router.ts`) vers un module partagé `server/audit-scoring.ts`, plus une variante `computeGenericAuditScoreSafe` (retourne `null` plutôt que de lever une erreur, pour ne pas faire planter tout un dashboard à cause d'un seul audit sans scope résolvable). `audit-router.ts` importe désormais depuis ce module au lieu de dupliquer la logique.

**`server/db-dashboard-v2.ts` — `getDashboardSummary`** : remplace la lecture des colonnes inexistantes `a.score`/`a.conformityRate` (toujours `undefined`) par un calcul à la volée via `computeGenericAuditScoreSafe`, un par audit de l'utilisateur, moyenné. `averageAuditScore` et `globalConformityRate` utilisent désormais la même valeur calculée (le modèle ne distingue pas les deux, contrairement à l'ancien design qui ne les alimentait de toute façon jamais).

**`server/routers.ts` — `getKPIs`** : découverte d'un second problème en testant — même après la correction ci-dessus, `getKPIs` mappait vers des noms de champs qui n'ont jamais existé (`stats?.globalScore`, `stats?.completionRate`, `stats?.okCount`...) alors que `getDashboardSummary` renvoie `averageAuditScore`, `auditsByStatus`, `findingsByType`. Corrigé pour lire les bons champs. **Ajout de `frameworkScores`** (score par référentiel, ex. `{"mdr": 80.6}`) — absent de `getKPIs` jusqu'ici ; le frontend (`client/src/pages/Dashboard.tsx`) l'attendait déjà avec un commentaire explicite `// TODO(data): pas d'endpoint backend de score par référentiel pour le moment.` — donc une lacune déjà documentée côté frontend, pas une invention de ma part. Résolution du référentiel vers la clé frontend (`mdr`, `ivdr`, `fda-qmsr`, `mdsap`, `iso-13485`, `iso-14971`, `iso-9001`) par **`code`** (table `referentiels`), jamais par ID en dur — mapping code→clé fixe (ce sont des codes stables, pas des IDs auto-increment fragiles).

**Bug trouvé et corrigé en cours de route** : ma première version de `getFrameworkScores` utilisait `Array.isArray(audit.referentialIds)` — faux, car ce champ est renvoyé comme chaîne JSON (`"[6]"`), pas comme tableau natif. Corrigé en réutilisant `safeParseArray` (déjà exportée depuis `mdr-router.ts` pour cette Étape 2) au lieu de dupliquer une logique de parsing défensive.

**Preuve réelle** (même audit id=1, 62 réponses, 47 compliant/15 non_compliant) :
```
AVANT : {"scoreGlobal":0,"progression":0,"conforme":0,"nonConforme":0,"nonConformitiesCount":0}
APRÈS : {"scoreGlobal":80.6,"progression":0,"conforme":0,"nonConforme":0,"nonConformitiesCount":0,"frameworkScores":{"mdr":80.6}}
```
`progression`/`conforme`/`nonConforme`/`nonConformitiesCount` restent à 0 : légitime, ils dépendent de la table `findings` (fonctionnalité séparée, non alimentée par le flux de questions/réponses MDR) — pas un artefact du bug corrigé ici, hors périmètre de cette étape.

**Conséquence pour l'Étape 4** : contrairement à ce qui était anticipé avant cette extension, re-tagger l'audit de production avec le bon `referentialId` **suffira désormais** à faire réapparaître le score sur la page `/dashboard` réelle (`scoreGlobal` + `frameworkScores.mdr`), en plus des vues par-audit déjà réparées.

### Deux écarts de signature trouvés en préparant l'Étape 3 (lecture des vrais call sites frontend)

En vérifiant précisément comment chaque page frontend appelle ces endpoints (pas seulement les noms, les paramètres exacts), deux écarts supplémentaires sont apparus — non détectés par l'analyse précédente (qui ne regardait que les noms de procédures) :

1. **`AuditSelector.tsx` appelle `audit.list({ status, referentialId })`** — mon `list` n'acceptait que `status`/`siteId`. `referentialId` était silencieusement ignoré (zod sans `.strict()` ne rejette pas les clés inconnues), donc pas de crash mais un filtre inopérant : la sélection d'audit par référentiel ne filtrait rien. **Corrigé** : ajout du paramètre, filtré en mémoire sur `referentialIds` (JSON stocké en chaîne, via `safeParseArray`). Testé : `{referentialId:6}` → l'audit MDR ; `{referentialId:999}` → liste vide.

2. **`Reports.tsx` appelle `audit.getScore({}, ...)` — jamais avec `auditId`.** Ma première implémentation exigeait `auditId` obligatoire ; cet appel aurait échoué à chaque fois (erreur de validation zod). En creusant l'usage réel (`globalScore?.score`, `.conforme`, `.nok`, `.na` — Reports.tsx:95-107), cette page veut un **score global agrégé sur tous les audits**, pas le score d'un audit précis. `auditId` rendu optionnel : fourni → comportement par-audit existant ; omis → agrégation sur tous les audits de l'utilisateur, champs renommés exactement `conforme`/`nok`/`na` pour matcher cette page (pas les mêmes noms que `getStats`, qui garde `compliant`/`non_compliant`/`not_applicable`). Testé en GET sans paramètre (comme le fait réellement react-query) : `{"score":80.6,"conforme":47,"nok":15,"na":0}`.

Ces deux corrections + les précédentes sont dans le même commit à venir sur `claude/qara-backend-assainissement-qitbxl`.

## Étape 4 — Réparer l'audit existant en base (userId 2) — procédure préparée, non exécutée

**Rien exécuté par moi contre `new-claude`.** La procédure ci-dessous a été testée mécaniquement en local (base `qara_qitbxl_local`) : bug reproduit (un audit forcé à `referentialIds:[1]`), backup, pré-vérification, UPDATE, post-vérification — puis confirmation que `dashboard.getKPIs` réaffiche bien `scoreGlobal:80.6`/`frameworkScores:{"mdr":80.6}` après réparation, exactement le résultat attendu en production une fois les Étapes 2+3 déployées.

### Ordre de déploiement recommandé (avant d'exécuter cette étape)

1. **Backend (Étape 2)** en premier, ou en même temps que le frontend — jamais après. Un backend à jour avec un ancien frontend est sans risque (l'ancien frontend continue d'envoyer `referentialIds:[1]`, les nouveaux endpoints répondent, juste avec un score à 0 pour ce référentiel tant que l'Étape 3 n'est pas là — pas pire qu'avant, pas de crash).
2. **Frontend (Étape 3)** — un frontend corrigé qui appelle des endpoints pas encore déployés échouerait (404) : ne jamais déployer le frontend seul en premier.
3. **Cette Étape 4 (réparation de la ligne en base) en dernier**, une fois 1 et 2 en production — sinon la ligne réparée ne sert à rien tant que l'ancien code du dashboard (colonnes inexistantes) tourne encore.

### Étape 0 — Résoudre l'ID MDR réel sur `new-claude` (ne jamais assumer 3)

```sql
SELECT id, code, name FROM referentiels WHERE code = 'MDR';
```
Utilisez l'`id` retourné ici dans les requêtes suivantes — ne réutilisez pas le chiffre 3 du prompt sans l'avoir revérifié à cet instant précis (l'historique de cette mission a déjà montré des offsets différents entre environnements).

### Étape A — Sauvegarde (obligatoire avant toute écriture)

```sql
CREATE TABLE IF NOT EXISTS audits_backup_20260715 LIKE audits;
INSERT INTO audits_backup_20260715 SELECT * FROM audits;

CREATE TABLE IF NOT EXISTS audit_responses_backup_20260715 LIKE audit_responses;
INSERT INTO audit_responses_backup_20260715 SELECT * FROM audit_responses;

SELECT COUNT(*) AS audits_backed_up FROM audits_backup_20260715;
SELECT COUNT(*) AS responses_backed_up FROM audit_responses_backup_20260715;
```

### Étape B — Pré-vérification : identifier précisément le(s) audit(s) mal-tagué(s)

```sql
SELECT a.id, a.userId, a.name, a.status, a.referentialIds,
       (SELECT COUNT(*) FROM audit_responses ar WHERE ar.auditId = a.id) AS nb_reponses
FROM audits a
WHERE a.userId = 2
  AND JSON_CONTAINS(a.referentialIds, '1');
```
**Vérifiez avant de continuer** : cette requête doit retourner exactement la ou les lignes attendues (l'audit MDR à 59 réponses documenté). Si elle retourne autre chose (0 ligne, ou plusieurs lignes inattendues), **ne pas continuer** — revenir vers moi avec le résultat.

### Étape C — La réparation (scoped, jamais un UPDATE non filtré)

```sql
UPDATE audits
SET referentialIds = JSON_ARRAY((SELECT id FROM referentiels WHERE code = 'MDR'))
WHERE userId = 2
  AND JSON_CONTAINS(referentialIds, '1');
```
Le `WHERE` combine `userId = 2` et la présence de `1` dans le tableau — ne touche que la/les lignes identifiées à l'étape B, aucun autre audit ni aucun autre utilisateur.

### Étape D — Post-vérification

```sql
-- Le référentiel doit maintenant être le bon ID (celui de l'Étape 0)
SELECT id, userId, name, status, referentialIds FROM audits WHERE userId = 2;

-- Les réponses de cet audit doivent être exactement les mêmes qu'avant (même nombre)
SELECT COUNT(*) AS nb_reponses FROM audit_responses WHERE auditId = <id_trouvé_étape_B>;

-- Confirmation d'innocuité : ces comptages doivent être identiques avant/après
SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM sites) AS sites,
  (SELECT COUNT(*) FROM organisations) AS organisations;
```

Puis, dans l'application (une fois Étapes 2+3 déployées) : le dashboard doit réafficher le score MDR réel (~76% documenté, ou la valeur réellement calculée par `audit.getScore`/`dashboard.getKPIs` sur les 59 réponses de production — je ne peux pas garantir le chiffre exact à l'avance, seulement que le calcul se fera correctement une fois la ligne bien taguée).

### Preuve que cette procédure fonctionne mécaniquement (test local, bug reproduit puis réparé)

```
AVANT réparation : referentialIds=[1]  → dashboard.getKPIs : {"scoreGlobal":0, "frameworkScores":{}}
APRÈS réparation : referentialIds=[6]  → dashboard.getKPIs : {"scoreGlobal":80.6, "frameworkScores":{"mdr":80.6}}
```
(6 = ID local de MDR dans mon environnement de test ; sur `new-claude`, utilisez l'ID retourné par l'Étape 0.) `audit_responses` et les comptages `users`/`sites`/`organisations` confirmés inchangés après la réparation.

## Étape 5 — Sécurité sur qitbxl

### Fuite `passwordHash` — corrigée à la racine, pas juste sur `auth.me`

Corrigée dans `server/_core/trpc.ts` (`createContext`) : `passwordHash` est retiré de `ctx.user` dès sa construction, avant qu'aucun routeur ne puisse le lire ou le spreader. `auth.me` (`publicProcedure.query((opts) => opts.ctx.user)`) en hérite automatiquement.

En creusant, **`profile.get` avait la même fuite indépendamment** (`db.getUserProfile` fait sa propre requête `select().from(users)`, pas via `ctx.user`) — corrigée séparément dans `server/db.ts`. Et **`system.listUsers` (endpoint admin) aussi** — même correction appliquée à `listAllUsers`/`listAllUserProfiles`. Trois endroits distincts, même faille, corrigés ensemble puisque le correctif est identique (destructurer `passwordHash` avant de retourner).

Vérifié : aucun code du repo ne lit `ctx.user.passwordHash` ni n'appelle `getUserProfile`/`listAllUsers`/`listAllUserProfiles` en attendant ce champ — aucune régression possible par construction.

**Testé en local** (compte promu admin temporairement pour le test, puis repassé `user`) :
```
auth.me          -> pas de passwordHash (rôle, email, etc. présents)
profile.get      -> pas de passwordHash
system.listUsers -> pas de passwordHash (testé avec un compte admin réel)
```
Non-régression confirmée sur `audit.getScore`/`dashboard.getKPIs` (Étapes 2/3) après ce changement.

### Gating serveur des plans — nouveau, réimplémenté dans le style qitbxl

`server/plans/capabilities.ts` (nouveau) : matrice de capacités (`canUseClassification`/`canUseFDA`/`canUseVeille`/`canExportReports`), mêmes tiers et mêmes noms que le frontend déjà déployé (`client/src/lib/plans.ts`, bo77ju) pour rester cohérent avec le modèle de plans réellement en production — pas repris du lot sécurité de `main` (abandonné), juste aligné sur ce que le client attend déjà. `requireCapability(capability)` ajouté dans `server/_core/trpc.ts`, suivant exactement le même style que `protectedProcedure`/`adminProcedure` déjà en place (`t.procedure.use(...)`) — un admin passe toujours.

Appliqué à :
- `classification.classify` (`canUseClassification`)
- `fda.saveQualification`, `fda.createAudit` (`canUseFDA`)
- `watch.updates` (`canUseVeille`) — `watch.refresh` reste `adminProcedure`, déjà correctement restreint, pas un gating de plan à ajouter
- `reports.generate` (`canExportReports`)

**Découverte séparée, non traitée** : `FdaClassification.tsx` et `RegulatoryWatch.tsx`/`AlertPreferencesDialog.tsx` (frontend, tous deux réellement routés dans `App.tsx`, pas du code mort) appellent `trpc.fdaClassification.save` et `trpc.regulatory.getStats`/`getAlertPreferences`/`updateAlertPreferences` — **recherche exhaustive confirmée : ces noms n'existent nulle part côté qitbxl**. Différent du gating (on ne peut pas gater un endpoint qui n'existe pas) — plus proche du problème de l'Étape 2 (endpoints manquants), mais sur un périmètre de fonctionnalités différent (FDA classification spécifique, alertes de veille), jamais mentionné dans le plan de réconciliation initial. Signalé ici pour mémoire, pas corrigé — hors périmètre déclaré de cette étape, nécessiterait son propre lot si vous voulez le traiter.

**Testé en local** : compte Free (`subscriptionTier=NULL`) → `FORBIDDEN` sur les 4 endpoints ; même compte passé `pro` → passe (réponse réelle de `classification.classify`, `watch.updates`) ; repassé `NULL` après test. Non-régression confirmée sur `audit.getScore`/`dashboard.getKPIs`/`auth.me` (toujours sans `passwordHash`) après ce changement.
