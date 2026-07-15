# ASSAINISSEMENT — Topologie actuelle et cible (Phase 1)

*Rédigé le 2026-07-10, sur la branche `claude/qara-backend-assainissement-qitbxl` (créée à partir de `origin/claude/qara-compliance-audit-qitbxl`, non poussée sur `qitbxl` lui-même — voir note de sécurité en fin de document). Aucune action exécutée : cartographie et lecture de code uniquement.*

---

## 0. Point de vigilance à traiter AVANT toute autre décision de cette phase

**Le commit actif que vous avez relevé dans Railway (`ba779bb5`) n'existe dans aucune branche accessible de ce dépôt.**

`git rev-list --all | grep ba779bb5` et `git cat-file -t ba779bb5` ne retournent rien — cet objet est introuvable, y compris après un `git fetch --prune` complet. Le dernier commit connu de `claude/qara-compliance-audit-qitbxl` que je peux voir est `bfc88cf7` (2026-07-07 08:22:36 UTC, "docs: compte-rendu de l'état actuel..."), daté d'un jour avant votre déploiement du 8 juillet.

Explications possibles, **aucune retenue par défaut** :
1. Un commit a été poussé sur `qitbxl` le 8 juillet, après `bfc88cf7`, puis la branche a été réécrite (rebase/force-push) et ce commit n'existe plus sous ce nom — Railway garde le SHA du déploiement effectué à l'époque, qui peut devenir orphelin si l'historique est réécrit ensuite.
2. Le SHA affiché dans Railway est tronqué/mal recopié (à revérifier directement dans le dashboard, format complet).
3. Railway a déployé depuis un remote/fork non couvert par le remote `origin` que j'utilise ici.

**Recommandation avant Phase 2/3** : re-vérifiez dans Railway (Deployments → cliquer sur le déploiement actif → copier le SHA complet, pas tronqué) et, si possible, comparez au tip actuel de `git log origin/claude/qara-compliance-audit-qitbxl -1`. Si le SHA complet est différent de `bfc88cf7` et introuvable ici, il faut identifier d'où il vient avant de baser tout correctif sur l'état actuel de la branche `qitbxl` telle que je la vois — sinon je pourrais travailler sur une version légèrement différente de ce qui tourne réellement.

---

## 1. État actuel

### 1.1 Backends Railway

| Service | Branche déployée | Base de données | Statut | Rôle réel |
|---|---|---|---|---|
| `backend-qara-new-claude` | `claude/qara-compliance-audit-qitbxl` (tip connu `bfc88cf7` — **SHA actif à reconfirmer, voir §0**) | contient le corpus 473 (réf. 3-9), bcrypt natif, `onboarding_profiles` absente, scope engine présent | **Actif — c'est le backend de l'application réelle** | Production réelle |
| `backend-qara-production` | `main` (tip `8330bd4a`, merge de `claude/qara-backend-securite-persistance-bo77ju`) | supposée contenir le travail des 2 derniers jours (scrypt, `onboarding_profiles`, tentative corpus 826) — **jamais vérifiée directement en lecture, seulement déduite du nom et de l'historique de déploiement** | Existe, nom trompeur ("production") | **N'est PAS utilisé par l'app réelle** — nom source de toute la confusion de cette mission |

*Je n'ai pas d'accès direct à l'API Railway dans cette session — ce tableau croise uniquement ce que vous avez confirmé (§A du prompt) avec l'état du code observable en Git. Si vous voulez une cartographie Railway 100% exhaustive (variables d'env exactes, autres services/environnements existants que je ne connais pas), il faudra me copier-coller la liste des services depuis le dashboard.*

### 1.2 Branches Git — dépôt `Backend---QARA`

| Branche | Dernier commit | Date | Relation aux autres | Statut proposé |
|---|---|---|---|---|
| `master` | `0592c042` | 2026-02-10 | **Historique totalement déconnecté** de `main`/`qitbxl` (`git merge-base` échoue, exit 1 — aucun ancêtre commun, pas juste une vieille divergence) | Scaffold initial abandonné, dormant depuis 5 mois. Voir §2 pour le contenu à vérifier avant suppression. |
| `main` | `8330bd4a` | 2026-07-09 | Diverge de `qitbxl` au commit `4f37beb2` (2026-03-10) ; seulement 5 commits ajoutés depuis (mon Lot 1/2/3 + merge PR#1) | Travail superflu par rapport à `qitbxl` — voir §2 |
| `claude/qara-compliance-audit-qitbxl` | `bfc88cf7` (SHA actif Railway à reconfirmer, §0) | 2026-07-07 | Même point de divergence que `main`, 36 commits ajoutés depuis | **Lignée cible unique retenue** |
| `claude/qara-backend-securite-persistance-bo77ju` | — | 2026-07-08 | Déjà mergée dans `main` via PR #1 | Obsolète, contenu absorbé par `main` |
| `claude/qara-backend-corpus` | `2e133c48` | 2026-07-14 | Branchée sur `main` après le merge PR#1 | Obsolète — corpus 826 superflu, mais contient `DIAGNOSTIC-topologie-branches.md` (à préserver, voir §2) |
| `claude/qara-backend-assainissement-qitbxl` *(nouvelle, cette session)* | en cours | 2026-07-10 | Branchée sur `qitbxl` | Branche de travail pour Phases 2-3 de cet assainissement |

---

## 2. Ce qui sera archivé/supprimé à terme — vérification de non-perte, branche par branche

**Rien n'est supprimé ici. Ce qui suit est une liste préparatoire avec justification, en attente de votre feu vert (Phase 4).**

### `master` — à archiver, avec une réserve à vérifier manuellement

Comparaison de fichiers (hors `node_modules`/`dist`) contre `qitbxl` : la quasi-totalité du contenu de `master` a un équivalent plus récent et fonctionnellement supérieur sur `qitbxl` :
- `server/stripe/{permissions,products}.ts` → remplacé par `server/stripe/router.ts` sur `qitbxl`
- `server/db-dashboard.ts`, `server/pdf-generator.ts` → remplacés par `server/db-dashboard-v2.ts`, `server/report-generator.ts`
- `server/site-router.ts` → absorbé directement dans `routers.ts` sur `qitbxl` (qui a explicitement corrigé un bug de ce fichier — `organisationId` vide — via une réimplémentation Drizzle directe)
- `server/_core/llm.ts` + `server/document-ai.ts` (assistant IA générique, 332+167 lignes) → **remplacés par un système bien plus abouti** : `server/assistant/*` sur `qitbxl` (routeur tRPC `assistantUser`/`assistantAuditor`, intégration Anthropic `claude-sonnet-5` directe, tests unitaires, intégration frontend documentée dans `docs/audit/13-ia-reglementaire.md`)

**Un seul fichier reste sans équivalent nommé identifié : `server/mdr-validator.ts` (83 lignes, normalisation des données MDR avant envoi au frontend).** Sa logique est peut-être déjà inlinée ailleurs sur `qitbxl` (dans `mdr-router.ts` par exemple, que je n'ai pas comparé ligne à ligne pour ce point précis) — **je recommande un coup d'œil rapide humain sur ce fichier avant suppression définitive de `master`**, plutôt que de l'assumer couvert. Tout le reste de `master` semble raisonnablement sûr à archiver.

### `main` — à archiver, contenu déjà couvert ou explicitement abandonné

Fichiers uniques à `main` (absents de `qitbxl`) : `PROGRESS-backend.md`, `drizzle/migrations/0018_onboarding_profiles.sql`, `server/lib/plans.ts`, `server/onboarding-router.ts`, `server/site-router.ts` (même cas que `master` ci-dessus).

- `server/lib/plans.ts` (matrice de capacités) : **pas un doublon fonctionnel** — c'est l'apport unique confirmé et validé dans le diagnostic précédent (gating serveur des plans, absent de `qitbxl`). Ne pas jeter le code : il sera **réimplémenté** (pas copié tel quel) dans le style de `qitbxl` en Phase 3.
- `drizzle/migrations/0018_onboarding_profiles.sql` + `server/onboarding-router.ts` : remplacés fonctionnellement par le scope engine de `qitbxl` (`4a30bcae`), supérieur. À abandonner, décision déjà validée dans votre prompt (§A).
- `PROGRESS-backend.md` : journal de travail, à conserver pour mémoire (pas de suppression de fichier de doc, juste la branche entière sera archivée avec son historique Git préservé — rien n'est perdu tant que la branche n'est pas supprimée du remote).

### `claude/qara-backend-securite-persistance-bo77ju` — à archiver sans réserve

Entièrement mergée dans `main` (PR #1) — son contenu existe déjà ailleurs (dans `main`, lui-même à archiver). Aucune perte possible en la supprimant après `main`.

### `claude/qara-backend-corpus` — à archiver, sauf un fichier à rapatrier d'abord

Contenu unique : le corpus 826 (scripts + migration, abandonnés par décision), et **`DIAGNOSTIC-topologie-branches.md`** — le diagnostic complet produit lors de la session précédente. **Recommandation : copier ce fichier sur la nouvelle branche d'assainissement avant d'archiver `qara-backend-corpus`**, pour ne pas perdre la trace du diagnostic qui a mené à la décision actuelle. Je peux le faire dès que vous validez.

### Base de données `backend-qara-production`

Aucune requête n'a été exécutée contre elle dans cette session — je ne peux pas confirmer ce qu'elle contient réellement (le tableau §1.1 est une déduction, pas une vérification). **Avant toute suppression d'environnement Railway, il faudra une vérification de lecture explicite de son contenu**, exactement comme cela a été fait pour `new-claude`. Je peux préparer ces requêtes si vous le souhaitez, mais ce n'est pas encore fait.

---

## 3. Topologie cible

- **Backend** : un seul environnement Railway (`backend-qara-new-claude`), alimenté par une seule branche Git (`claude/qara-compliance-audit-qitbxl`), une seule base de données.
- **Frontend** : à clarifier — voir §4, en attente de votre indication sur comment vérifier ce point (dashboard d'hébergement frontend, ou autre méthode que vous préférez).
- **Branches archivées** (non supprimées avant votre feu vert explicite en Phase 4) : `master`, `main`, `claude/qara-backend-securite-persistance-bo77ju`, `claude/qara-backend-corpus`.
- **Branche de travail pour les correctifs Phase 3** : `claude/qara-backend-assainissement-qitbxl` (créée cette session, basée sur `qitbxl`, **jamais poussée directement sur `qitbxl`** — voir note de sécurité ci-dessous).

---

## 4. Point de vigilance frontend — toujours ouvert

Non traité dans cette phase : vous avez rejeté l'exploration automatique des branches du dépôt `Frontend---QARA` et nous avons convenu de revenir dessus séparément. Ce point reste **en attente de votre indication** sur la méthode à utiliser (dashboard d'hébergement frontend en lecture directe, ou autre). Tant qu'il n'est pas résolu, on ne peut pas exclure que le frontend réellement utilisé par les utilisateurs pointe vers un backend ou une configuration différente de ce qu'on a travaillé ces deux derniers jours (`claude/qara-frontend-reprise-routes-auth`) — même type de piège que celui découvert côté backend.

---

## Note de sécurité sur la méthode de travail (Phase 3 à venir)

`backend-qara-new-claude` déploie automatiquement depuis la branche `claude/qara-compliance-audit-qitbxl` sur Railway. **Aucun commit de cet assainissement — y compris ce document — ne sera poussé directement sur cette branche**, pour éviter de déclencher un déploiement non désiré. Tout le travail (ce document, puis les correctifs de la Phase 3) se fait sur `claude/qara-backend-assainissement-qitbxl`, une branche séparée basée sur `qitbxl` mais indépendante d'elle pour le déploiement. Le merge vers `qitbxl` (et donc le déploiement) restera une action que vous déclenchez explicitement, jamais moi.
