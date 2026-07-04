# État du projet — point de reprise

**Dernière mise à jour** : 04/07/2026, fin de session d'audit + Lot 0 + Lot 1.
**Branche de travail (les deux repos)** : `claude/qara-compliance-audit-qitbxl`.

Ce document est le point d'entrée pour reprendre le travail proprement d'une session à l'autre. Il résume où en est le projet ; le détail complet reste dans les documents `01-` à `06-` de ce même dossier.

---

## 1. Ce qui a été fait

| Document | Contenu |
|---|---|
| `01-comprehension.md` | Architecture réelle, modèle de données, inventaire fonctionnel complet |
| `02-audit-technique.md` | Sécurité, qualité, perf, UX — chaque anomalie avec sévérité/fichier:ligne/correction |
| `03-tests-fonctionnels.md` | Résultats des tests E2E réels (suite Playwright dans `frontend-qara/e2e/`) |
| `04-contenu-reglementaire.md` | Validité QMSR/MDCG/ISO/MDSAP face aux sources officielles |
| `05-refonte-proposition.md` | 3 scénarios de refonte + conception du module MDSAP + roadmap |
| `06-lot0-implementation.md` | Détail des correctifs Lot 0 |

**Lot 0 (sécurité/fiabilité critique) — ✅ fait, testé, poussé** (commits `909f2c36` backend / `3c5012b3` frontend) :
C-01 (schéma reconstituable), C-02 (script MDR destructeur), C-03 (mots de passe bcrypt), C-04 (JWT signé), C-05 (backdoor supprimé), C-06 (bug de reconnexion), C-07 (mismatch transformer tRPC), M-12 (cookie secure/sameSite). Voir `06-lot0-implementation.md` pour le détail de chaque correctif et sa vérification.

**Lot 1 (assainissement) — ✅ fait, testé, poussé** (commits `75b19d1d` backend / `36d507a8` frontend) :
Doublons de fichiers, `dist/` retiré du suivi, artefacts Manus (domaine mort SEO, télémétrie, liens), composants/pages morts confirmés supprimés, lockfile unique (pnpm), routeur backend dupliqué supprimé.

**État de la suite de tests** : 10/10 (Playwright `frontend-qara/e2e/`), vérifié après Lot 0 et après Lot 1.

## 2. Ce qui reste (non commencé)

Scénario retenu : **B — refonte progressive**, découpée en lots (voir `05-refonte-proposition.md` pour le détail et l'estimation d'effort de chacun) :

- **Lot 2** : partage du vrai type `AppRouter` entre les deux dépôts (élimine la classe de bugs "route fantôme" type C-07) + suppression des flags de build permissifs (`TSC_COMPILE_ON_ERROR`, `ESLINT_NO_DEV_ERRORS`).
- **Lot 3** : upload de preuves réel (S3) + réparation de `reports.generate`/`reports.compare` (cassés à l'exécution).
- **Lot 4** : contenu ISO 9001/13485 — actuellement **0 question en base**, dépend de la refonte des questionnaires en cours en parallèle (hors de cette session).
- **Lot 5** : modèle de données référentiel-agnostique + recâblage de MDR dessus (aujourd'hui MDR fonctionne différemment d'ISO/FDA).
- **Lot 6** : module MDSAP (7 processus, 5 juridictions, gradation 1-5) — conception détaillée déjà prête dans `05-refonte-proposition.md`.
- **Lot 7** : RAG réglementaire sourcé (l'IA réglementaire n'existe pas du tout côté serveur aujourd'hui).
- **Lot 8** : facturation Stripe réelle (routeur actuellement vide).
- **Lot 9** : i18n structurelle, responsive, accessibilité.

Aucun de ces lots n'a été commencé. Rien n'a été implémenté au-delà de Lot 0/Lot 1 sans validation explicite, conformément à la consigne initiale.

## 3. Schéma de données actuel

Source de vérité : `drizzle/migrations/*.sql` (19 fichiers + `0007b_baseline_core_tables.sql` ajouté en Lot 0, qui capture les tables cœur qui n'avaient jamais été versionnées — voir C-01). `drizzle/schema.ts` reste la déclaration Drizzle correspondante utilisée par le code applicatif.

**Vérifié en Lot 0** : ces migrations reconstruisent maintenant un schéma complet et correct sur une base MySQL totalement vierge, de façon idempotente (testé deux fois de suite).

### Tables (25, hors tables de veille réglementaire déjà bien documentées en Phase 1)

| Table | Rattachement | Rôle |
|---|---|---|
| `users` | — (racine) | comptes, mot de passe (bcrypt depuis Lot 0), rôle user/admin |
| `user_profiles` | `userId` | profil complémentaire (peu utilisé) |
| `organisations` | `userId` | organisation cliente (multi-tenant faible, voir 01-comprehension.md) |
| `sites` | `userId`, `organisationId` | site/établissement audité |
| `referentiels` | — (partagé) | MDR, ISO9001, ISO13485, FDA_QSR_21CFR820, FDA_US_MARKET_ACCESS |
| `processus` | — (partagé) | 15 processus canoniques (gouvernance, RA, QMS, gestion des risques, conception, achats, production, traçabilité/UDI, PMS/PMCF, vigilance, distribution, importation, doc technique, audits/conformité, IT/cyber) |
| `questions` | `referentialId`, `processId` | banque de questions (voir §4, contenu très inégal selon référentiel) |
| `audits` | `userId`, `siteId` | audit en cours/terminé |
| `audit_responses` | `userId`, `auditId` | réponses aux questions |
| `findings` | `userId` (nullable), `auditId` (nullable) | constats de non-conformité |
| `actions` | `findingId` (pas de rattachement direct user/org) | plan d'action CAPA |
| `resultats` | `userId` (nullable), `auditId` (nullable) | scoring |
| `mdr_evidence_files` | `userId`, `auditId` | preuves documentaires (upload réel non implémenté, voir 02-audit-technique.md M-08) |
| `mdr_role_qualifications` | `userId`, `siteId` | qualification du rôle économique MDR |
| `iso_qualifications` | `userId` (unique) | qualification ISO |
| `fda_qualification_sessions` / `_answers` / `_results` | `userId` | qualification FDA |
| `audit_reports` | `userId`, `auditId` (pas de FK déclarée) | rapports générés (génération cassée, voir M-08) |

### État réel des données par référentiel (instance locale, à titre indicatif)

| Référentiel | Questions en base | Import reproductible depuis le dépôt ? |
|---|---|---|
| MDR | 826 | ✅ oui, `node scripts/import-mdr-questions.js` (corrigé en Lot 0) |
| FDA (QMSR + US Market Access) | 223 | ✅ oui, directement via les migrations versionnées |
| ISO 9001 | 0 | ❌ non — aucun script d'import ISO fonctionnel trouvé (voir 03-tests-fonctionnels.md §2). Refonte des questionnaires en cours en parallèle, hors périmètre de cette session. |
| ISO 13485 | 0 | ❌ idem |

## 4. Comment relancer l'environnement local

Reproduit l'environnement utilisé pour tous les tests de cette session (MySQL local + backend + frontend).

```bash
# 1) Base de données (MySQL/MariaDB local)
service mariadb start   # ou équivalent selon l'environnement
mysql -u root -e "CREATE DATABASE IF NOT EXISTS qara; CREATE USER IF NOT EXISTS 'qara'@'localhost' IDENTIFIED BY 'qarapass'; GRANT ALL PRIVILEGES ON qara.* TO 'qara'@'localhost'; FLUSH PRIVILEGES;"

# 2) Backend
cd backend-qara
pnpm install
export DATABASE_URL="mysql://qara:qarapass@127.0.0.1:3306/qara"
export PORT=3001
export ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
export JWT_SECRET="n'importe-quelle-valeur-en-local"   # requis en production, optionnel en dev (voir sdk.ts)
npx tsx scripts/apply-sql-migrations.ts   # nécessite un DATABASE_URL sans TLS forcé en local : voir note ci-dessous
npx tsx watch server/_core/index.ts

# 3) Seed du contenu (optionnel, pour tester avec des vraies questions)
node scripts/import-mdr-questions.js   # 826 questions MDR

# 4) Frontend
cd ../frontend-qara
pnpm install
echo 'VITE_API_URL=http://127.0.0.1:3001/trpc' > client/.env.local   # IMPORTANT : dans client/, pas à la racine (vite root = client/)
npx vite --port 5173 --host 127.0.0.1

# 5) Tests E2E
npx playwright test e2e/
```

**Note** : `scripts/apply-sql-migrations.ts` force `ssl:{rejectUnauthorized:false}`, adapté à Railway mais pas à un MySQL local sans TLS. Pour tester en local, utiliser une copie temporaire du script avec cette ligne retirée (ne pas committer cette copie).

**Note** : les cookies de session utilisent `secure`/`sameSite` dépendants de `NODE_ENV` (corrigé en Lot 0, M-12) — Chrome traite `127.0.0.1`/`localhost` comme contextes fiables, donc les cookies `Secure` fonctionnent même en HTTP local sur ces hôtes spécifiquement.

## 5. Décisions déjà validées par le commanditaire

- Scénario B (refonte progressive) retenu, priorité au Lot 0 en premier — validé.
- Périmètre immédiat : Lot 0 + Lot 1 uniquement, horizon 2-3 semaines, pas de contrainte budget/échéance particulière — validé, et livré.
- Refonte du contenu des questionnaires : prise en charge séparément, hors de cette session — noté et respecté (Phase 4 et au-delà n'ont pas audité le libellé des questions).

## 6. Décision en attente

Aucune ligne d'implémentation au-delà de Lot 0/Lot 1 n'a été écrite. Prochaine étape : décider si on enchaîne sur un des lots listés en §2 (Lot 2 — partage du type `AppRouter` — est le plus naturel ensuite, puisqu'il empêche toute une classe de bugs similaires à C-07 de réapparaître), ou si on attend l'avancement de la refonte des questionnaires avant de continuer.
