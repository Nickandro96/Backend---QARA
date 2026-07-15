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
