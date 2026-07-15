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
