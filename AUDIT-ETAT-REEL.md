# AUDIT-ETAT-REEL — État factuel de la mission QARA

*Rédigé le 2026-07-16. Lecture seule stricte — aucune modification de code, aucun commit fonctionnel, aucune écriture en base pendant cet audit. Chaque affirmation est marquée **[PROUVÉ]** (vérifié directement) ou **[SUPPOSÉ]** (déduit, à confirmer). Les sections marquées **[EN ATTENTE]** nécessitent une information que seul l'utilisateur peut fournir (dashboard Railway/Vercel, requête SQL production).*

---

## 1. État Git réel

### Backend — `Nickandro96/Backend---QARA`

| Branche | Dernier commit | Date | Auteur | Rôle |
|---|---|---|---|---|
| `master` | `f54210a2` | 2026-02-10 | Nickandro96 | **[PROUVÉ]** Historique totalement déconnecté (aucun ancêtre commun avec `main`/`qitbxl` — `git merge-base` échoue). Scaffold abandonné. |
| `main` | `8330bd4a` | 2026-07-09 | Nickandro96 (merge) | **[PROUVÉ]** Diverge de `qitbxl` au commit `4f37beb2` (2026-03-10). Contient le lot sécurité scrypt/`SESSION_JWT_SECRET` + `onboarding_profiles` + tentative corpus 826 questions — **abandonné par décision explicite** (qitbxl a ses propres équivalents, déjà en prod). |
| `claude/qara-backend-securite-persistance-bo77ju` | `0f875fbf` | 2026-07-08 | Claude | **[PROUVÉ]** Mergée dans `main` (PR #1, 2026-07-09T07:14:00Z). Obsolète, contenu absorbé. |
| `claude/qara-backend-corpus` | `2e133c48` | 2026-07-14 | Claude | **[PROUVÉ]** Branchée sur `main` post-merge. Corpus 826 questions (superflu, remplacé par le corpus 473 déjà en prod) + `DIAGNOSTIC-topologie-branches.md`. Jamais mergée nulle part. |
| `claude/qara-backend-assainissement-qitbxl` | `f0d920df` | 2026-07-15 12:03 | Claude | **[PROUVÉ]** Branche de travail des Étapes 1-5 de la réconciliation. **Mergée dans `qitbxl` via PR #2** (voir §2). |
| `claude/qara-compliance-audit-qitbxl` | `469608da` | 2026-07-15 14:54 | Nickandro96 (merge) | **[PROUVÉ]** C'est la branche déployée sur `backend-qara-new-claude`. Tip = le commit de merge de PR #2 — **contient désormais tout le travail des Étapes 1, 2, (préparation) 4, 5**. |

**Commits locaux non poussés / branches divergentes** : **[PROUVÉ]** aucun — `git status` sur le clone local de travail est propre (`nothing to commit`), toutes les branches locales sont synchronisées avec `origin`.

### Frontend — `Nickandro96/Frontend---QARA`

| Branche | Dernier commit | Date | Auteur | Rôle |
|---|---|---|---|---|
| `main` | `6210cd7` | 2026-03-06 | Nickandro96 | **[PROUVÉ]** Ancêtre direct de `bo77ju` (pas de divergence) — lignée normale, juste un point plus ancien. |
| `claude/qara-compliance-audit-qitbxl` | `192c145` | 2026-07-07 | Claude | **[PROUVÉ]** 60 commits, lignée **séparée** (pas un ancêtre de `bo77ju`, jamais mergée). Contient un travail de refonte "dashboard premium" (`feat(dashboard): étapes 1-6 — nouveau dashboard d'accueil premium`) — probablement l'équivalent frontend du travail backend qitbxl, fait par un autre agent/session. **Jamais localisé** : les fichiers `PROMPT-REFONTE-PREMIUM.md`/le commit `ba779bb5` mentionnés par vous dans une session précédente restent introuvables sur cette branche ni ailleurs dans les deux dépôts (recherche exhaustive via l'API GitHub) — incohérence non résolue, voir §6. |
| `claude/qara-routes-auth-stages-xk5awz` | `d29ef27` | 2026-07-08 | Claude | **[PROUVÉ]** Travail antérieur "routes/auth", base d'une reprise. |
| `qara-design-passation` | `d0a8e51` | 2026-07-09 | **Nickandro96** (pas "Claude") | **[SUPPOSÉ]** Commits attribués directement à l'identité Git de l'utilisateur, pas à "Claude <noreply@anthropic.com>" — cohérent avec un outil tiers (Codex/GPT, mentionné par vous) committant sous votre identité, ou une intervention manuelle. Impossible à trancher avec certitude par la seule métadonnée Git. |
| `claude/qara-frontend-reprise-routes-auth` | `63ac6cb` | 2026-07-09 | Claude | **[PROUVÉ]** Point de départ de `bo77ju` (voir ci-dessous) — c'est la branche que j'ai dupliquée sous ce nom lors d'une session précédente. |
| `claude/qara-frontend-assainissement-bo77ju` | `5100b75` | 2026-07-15 11:16 | Claude | **[PROUVÉ]** Branche de travail de l'Étape 3 (correction `referentialIds` dans `MDRAudit.tsx`). **Mergée dans `bo77ju` via PR #1** (voir §2). |
| `claude/qara-backend-securite-persistance-bo77ju` | `91b6f84` | 2026-07-15 15:40 | Nickandro96 (merge) | **[PROUVÉ]** C'est la branche que Vercel déploie pour l'app réelle (confirmé par vous via le dashboard Vercel, session précédente). Tip = le commit de merge de PR #1 — **contient désormais la correction de l'Étape 3**. |

**Commits locaux non poussés / branches divergentes** : **[PROUVÉ]** aucun.

**Une branche `verify-fe-branch` a été supprimée entre deux fetch** (constaté, pas fait par moi) — **[PROUVÉ]** son existence passée, **[SUPPOSÉ]** son contenu (jamais examiné avant suppression, aucune trace disponible).

---

## 2. État de ce qui est mergé sur les branches déployées (Git) vs déployé en production (Railway/Vercel)

### Ce qui est PROUVÉ par Git + API GitHub (indépendant de moi)

- **PR #2** sur `Backend---QARA` : `claude/qara-backend-assainissement-qitbxl` → `claude/qara-compliance-audit-qitbxl`. Créée 2026-07-15T12:53:55Z, **mergée 2026-07-15T12:54:12Z par `Nickandro96`** (`merged_by` confirmé via l'API GitHub, pas une déduction). 8 commits, 996 insertions / 39 suppressions, 15 fichiers.
- **PR #1** sur `Frontend---QARA` : `claude/qara-frontend-assainissement-bo77ju` → `claude/qara-backend-securite-persistance-bo77ju`. Créée 2026-07-15T13:40:05Z, **mergée 2026-07-15T13:40:20Z par `Nickandro96`**. 1 commit, 60 insertions / 4 suppressions, 2 fichiers.
- Un commentaire du bot Vercel sur la PR #1 confirme un **déploiement de preview** réussi pour la branche `claude/qara-frontend-assainissement-bo77ju` (statut "Ready"/"DEPLOYED", 2026-07-15T13:40:11Z) — **ceci prouve que le build de la PR a réussi, PAS que le déploiement de production (post-merge, sur la branche `bo77ju` elle-même) a eu lieu.**
- Aucun statut de check GitHub (`get_status`) ni commentaire de bot sur la PR #2 (backend) — Railway ne semble pas configuré pour poster de statut sur ce dépôt. **Aucune preuve GitHub-visible du déploiement Railway.**

### Ce qui reste **[EN ATTENTE]** — je ne peux pas le vérifier moi-même

1. **Quel commit tourne réellement sur `backend-qara-new-claude` MAINTENANT** (après le merge du 15 juillet 12:54 UTC) ? Railway auto-déploie généralement sur push vers la branche suivie, mais je n'ai aucune preuve directe que le build a réussi et est live.
2. **Quel commit tourne réellement sur le Vercel de production** (pas la preview de la PR) pour `frontend-qara` ?

**→ Merci de vérifier dans les deux dashboards (Deployments → dernier déploiement actif → SHA affiché) et de me confirmer si le SHA correspond à `469608da` (backend) et `91b6f84` (frontend), ou à autre chose.**

---

## 3. État fonctionnel — ce qui est PROUVÉ, ce qui est CASSÉ, ce qui est NON TESTÉ

| Élément | Statut | Preuve |
|---|---|---|
| Login (bcrypt vs scrypt, compte admin) | **[EN ATTENTE]** | Étape 1 (procédure de régénération bcrypt) a été **livrée** (`scripts/generate-bcrypt-admin-hash.ts`, testé en local) mais je n'ai **aucune preuve que vous l'avez exécutée contre `new-claude`**. Requête à lancer : voir §D, requête 1. |
| Endpoints d'audit (`getScore`/`getStats`/`get`/`list`/`generatePDF`) | **FONCTIONNE en local, [EN ATTENTE] en production** | **[PROUVÉ]** Testés bout en bout contre une base locale reproduisant fidèlement la séquence de production (473 questions réelles, migrations rejouées à l'identique) : `audit.getScore` renvoie `{"score":80.6,"conforme":47,"nok":15,"na":0}` sur un audit réel de 62 réponses. **[EN ATTENTE]** Ces endpoints sont mergés dans `qitbxl` (§2) mais je ne peux pas confirmer qu'ils tournent sur `new-claude` sans le SHA Railway. `generatePDF` **n'a jamais été implémenté** (le `reports.generate` sous-jacent plante indépendamment, bug préexistant confirmé par test réel, non lié à mon travail). |
| ID référentiel de l'audit réel (userId 2) : `[1]` ou `[3]` ? | **[EN ATTENTE]** | Étape 4 (réparation) a été **préparée** (requêtes prêtes dans `RECONCILIATION.md`) mais **jamais exécutée par moi ni, à ma connaissance, par vous** — aucune confirmation reçue. Requête à lancer : voir §D, requête 2. |
| Dashboard : 0% ou vrai score ? | **[EN ATTENTE]** | Dépend directement des deux lignes précédentes + du déploiement réel. Confirmation visuelle nécessaire. |
| Type JSON de `referentialIds` : nombre `[3]` ou chaîne `["3"]` ? | **[SUPPOSÉ, fortement]** | Tous les schémas Zod des points d'entrée (`mdr.createOrUpdateAuditDraft`, `audit.create`, etc.) déclarent `referentialIds: z.array(z.number())` — **[PROUVÉ par lecture de code]** qu'aucun chemin applicatif actuel n'insère de chaînes. Mais la ligne de production existante a pu être écrite par un code plus ancien ou une manipulation manuelle. **Ne pas supposer** — requête à lancer : voir §D, requête 2 (même requête que ci-dessus, `JSON_TYPE(referentialIds, '$[0]')` le confirme). |

---

## 4. Qui a fait quoi (reconstitution, best effort — [SUPPOSÉ] sauf mention contraire)

- **Une session Claude antérieure** (36 commits sur `qitbxl`, jusqu'à `bfc88cf7`) : audit technique complet (`docs/audit/00-13*.md`), correctifs sécurité indépendants (JWT via `JWT_SECRET`, bcrypt), import du corpus 473 questions, moteur de scope onboarding, CAPA, assistant IA. **[PROUVÉ]** par le contenu et les messages de commit ; auteur Git générique "Claude", session distincte de la mienne d'après le contexte (styles de nommage différents, ex. `JWT_SECRET` vs mon `SESSION_JWT_SECRET`).
- **Une session Claude antérieure (frontend)**, possiblement différente encore : `claude/qara-compliance-audit-qitbxl` (frontend, 60 commits, refonte "dashboard premium"), jamais mergée.
- **Un outil tiers (probablement Codex/GPT, sur votre indication)** : commits attribués directement à votre identité Git (`Nickandro96 <nickandroklauss@gmail.com>`) sur `qara-design-passation` (frontend) et un commit isolé sur `qara-backend-corpus` — **[SUPPOSÉ]**, la métadonnée Git seule ne permet pas de distinguer "un autre outil committant sous votre nom" d'une intervention manuelle de votre part.
- **Moi (cette conversation)** : diagnostic topologie (`DIAGNOSTIC-topologie-branches.md`), cartographie assainissement, Étapes 1/2/3/4(préparation)/5 de la réconciliation — **[PROUVÉ]**, je peux en rendre compte précisément car c'est le contenu de cette conversation.
- **Vous (Nickandro96)** : merges des PR #1 et #2 (les deux dépôts), décisions de branche (qitbxl comme lignée officielle), exécution (ou non, à confirmer) des procédures que j'ai livrées.

---

## 5. Écart entre "prévu" (séquence en 6 étapes) et "réel"

| Étape | Statut | Preuve |
|---|---|---|
| 1. Compte admin bcrypt | **FAIT (préparé), [EN ATTENTE] (exécuté ?)** | Script + procédure livrés et testés en local (commit `54aa7f21`, mergé dans `qitbxl`). Aucune confirmation d'exécution contre `new-claude`. |
| 2. Endpoints backend | **FAIT ET MERGÉ dans qitbxl, [EN ATTENTE] déployé** | Commits `555ef0f8`/`8e618c6c`/`abac53c3` mergés (§2). Testés en local avec preuve chiffrée. Déploiement réel non confirmé. |
| 3. Correction ID frontend | **FAIT ET MERGÉ dans bo77ju, [EN ATTENTE] déployé** | Commit `5100b75` mergé (§2). Testé en navigateur réel (Playwright) en local. Déploiement de production (pas juste preview) non confirmé. |
| 4. Réparation audit en base | **PRÉPARÉ, PAS EXÉCUTÉ** | Procédure complète dans `RECONCILIATION.md` (commit `4cb41ecf`, mergé — mais c'est de la documentation, pas une action). Aucune preuve que les requêtes ont été lancées contre `new-claude`. |
| 5. Sécurité (auth.me + gating plans) | **FAIT ET MERGÉ dans qitbxl, [EN ATTENTE] déployé** | Commits `4f0d7ad9`/`f0d920df` mergés (§2). Testés en local (FORBIDDEN/passage confirmés). Déploiement réel non confirmé. |
| 6. Rangement | **PAS COMMENCÉ** | Explicitement mis en attente de votre feu vert avant même la fin de l'Étape 5. |

---

## 6. Risques et incohérences détectés

1. **Commits mélangeant code et documentation** sur `claude/qara-backend-assainissement-qitbxl` : 6 des 8 commits mergés combinent des changements de code serveur ET une mise à jour de `RECONCILIATION.md` dans le même commit (`555ef0f8`, `8e618c6c`, `abac53c3`, `54aa7f21`, `4f0d7ad9`, `f0d920df`). Pratique délibérée (documenter la preuve à côté du code prouvé) mais rend l'historique moins facile à auditer commit par commit — un futur `git revert` isolé d'un correctif de code emporterait aussi la doc associée.
2. **`PROMPT-REFONTE-PREMIUM.md` et le commit `ba779bb5`** que vous aviez mentionnés dans une session précédente restent **introuvables** dans les deux dépôts, malgré une recherche exhaustive (API GitHub, toutes branches). Incohérence non résolue — soit une référence à un troisième dépôt hors du périmètre de cette session, soit une confusion d'onglet de votre côté à l'époque.
3. **Déploiement non confirmé** : tout le travail des Étapes 1/2/3/5 est mergé dans les branches suivies par Railway/Vercel, mais rien ne prouve ici qu'un nouveau build a réellement été déclenché et terminé avec succès depuis ces merges (15 juillet, 12h54 et 13h40 UTC).
4. **Étape 4 non exécutée** : sans elle, même si tout le reste est déployé, l'audit réel de production reste tagué avec le mauvais référentiel — le dashboard resterait à 0% pour cet audit spécifiquement (les nouveaux endpoints fonctionneraient, mais chercheraient le score du bon référentiel sur une ligne encore mal taguée).
5. **Une branche frontend `claude/qara-compliance-audit-qitbxl`** (60 commits, refonte dashboard) existe en parallèle de `bo77ju`, jamais réconciliée ni évaluée pour du travail unique potentiellement utile — à examiner avant tout rangement de branches (Étape 6).
6. **`master` (backend) et `qara-design-passation`/`xk5awz` (frontend)** restent des lignées non nettoyées, mentionnées comme "à ranger" mais jamais formellement validées comme sans travail unique (le fichier `server/mdr-validator.ts` sur `master`, signalé dans `ASSAINISSEMENT-topologie.md`, n'a toujours pas été vérifié manuellement).

---

## 7. Recommandation de reprise (priorisée, sur la base de l'état réel)

1. **D'abord, combler les inconnues** — sans ça, toute action serait spéculative :
   a. Confirmer les SHA Railway/Vercel actuellement déployés (§2).
   b. Lancer les 2 requêtes SQL en lecture seule ci-dessous (§D) pour trancher l'état réel du compte admin et de l'audit de production.
2. **Si le déploiement est confirmé mais l'Étape 4 n'a pas été exécutée** : c'est la seule action bloquante restante pour que le dashboard affiche le vrai score. La procédure est prête (`RECONCILIATION.md`, Étape 4) — backup, pré-vérification, UPDATE scopé, post-vérification.
3. **Si le déploiement n'est PAS encore effectif** : rien d'autre à faire côté code — attendre/déclencher le déploiement Railway/Vercel avant de toucher à la base (l'ordre de déploiement documenté doit être respecté : backend avant ou avec le frontend, jamais après).
4. **Ensuite seulement**, envisager l'Étape 6 (rangement des branches), avec la vérification manuelle de `server/mdr-validator.ts` sur `master` et un examen de la branche frontend `claude/qara-compliance-audit-qitbxl` avant toute suppression.

---

## D. Requêtes et informations nécessaires de votre part

**Railway** — `backend-qara-new-claude` → Deployments → déploiement actif → SHA affiché. Comparer à `469608da`.

**Vercel** — `frontend-qara` → Deployments → déploiement de production (pas preview) → SHA affiché. Comparer à `91b6f84`.

**Requête SQL 1 — compte admin (lecture seule)** :
```sql
SELECT id, email, LEFT(passwordHash, 12) AS hash_prefix, updatedAt
FROM users
WHERE email = 'nickandroklauss@gmail.com';
```
(`$2b$...` = bcrypt, Étape 1 exécutée ; `scrypt:...` = pas encore fait)

**Requête SQL 2 — audit de production (lecture seule)** :
```sql
SELECT a.id, a.userId, a.name, a.status, a.referentialIds,
       JSON_TYPE(a.referentialIds, '$[0]') AS type_element_0,
       (SELECT COUNT(*) FROM audit_responses ar WHERE ar.auditId = a.id) AS nb_reponses
FROM audits a
WHERE a.userId = 2;
```
(confirme la valeur actuelle de `referentialIds`, son type JSON exact, et le nombre de réponses associées)

**Visuel** : le dashboard de l'app affiche-t-il un score MDR non nul actuellement ?
