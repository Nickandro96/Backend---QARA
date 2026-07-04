# Lot 0 — Sécurité et fiabilité critique (implémentation)

Périmètre validé avec le commanditaire : Lot 0 (sécurité/fiabilité critique) + Lot 1 (assainissement), sans nouvelle fonctionnalité, sur la branche `claude/qara-compliance-audit-qitbxl` des deux dépôts. Chaque correctif a été vérifié en conditions réelles sur une instance locale (MySQL local, backend + frontend démarrés, suite Playwright complète) avant commit.

## Corrections apportées

| ID | Correctif | Fichiers | Vérification |
|---|---|---|---|
| C-05 | Suppression du backdoor codé en dur et de `system.devLogin` (contournement total de l'authentification) | `server/_core/systemRouter.ts` | Endpoints supprimés du routeur ; remplacés par `scripts/promote-admin.ts` (CLI uniquement, jamais exposé en HTTP) |
| C-04 | Token de session : `dummy-token-<openId>` (forgeable) → JWT signé HS256 via `jose` | `server/_core/sdk.ts` | Cookie de session inspecté après login : format JWT valide (`eyJ...`), `jwtVerify` rejette toute altération |
| C-03 | Mots de passe : identité (clair) → `bcrypt` (12 rounds) via `bcryptjs`, avec migration transparente des hashs existants au premier login réussi | `server/_core/passwordUtils.ts`, `server/_core/systemRouter.ts` | Inscription testée : `passwordHash` en base est un hash bcrypt (`$2b$12$...`), plus jamais le mot de passe en clair |
| C-06 | Reconnexion d'un utilisateur existant : violation de contrainte NOT NULL sur `email` à chaque tentative → corrigé (email/name/role transmis à l'upsert) | `server/_core/systemRouter.ts` | Testé en direct : register → logout → login réussit (échouait à 100% avant correctif) |
| C-07 | Mismatch transformer tRPC client/serveur (`superjson` déclaré côté client, absent côté serveur) → retiré du client | `client/src/lib/trpc.ts` | Suite Playwright : le test dédié `transformer-bug.spec.ts` passe désormais ; le parcours complet de création d'audit MDR (`mdr-audit.spec.ts`) fonctionne de bout en bout, bloqué par ce bug auparavant |
| M-12 | Cookie de session : `secure`/`sameSite` codés en dur, ignoraient `getSessionCookieOptions()` | `server/_core/systemRouter.ts`, `server/routers.ts` | Cookie émis en local reflète maintenant `secure:false, sameSite:lax` (dev), comme attendu |
| C-01 | Schéma DB non reconstituable depuis le dépôt seul (tables cœur jamais capturées en migration versionnée) → nouvelle migration `0007b_baseline_core_tables.sql` | `drizzle/migrations/0007b_baseline_core_tables.sql`, `scripts/apply-sql-migrations.ts` | Migration complète (19 fichiers) rejouée deux fois de suite sur une base MySQL totalement vierge : succès et parfaitement idempotente (0 ré-exécution au 2ᵉ passage) |
| C-02 | Script d'import MDR : `TRUNCATE TABLE questions` effaçait aussi ISO/FDA → suppression scopée à `referentialId = 1` (MDR uniquement), transaction réelle | `scripts/import-mdr-questions.js` | Ré-exécuté en local : 826 questions MDR remplacées, les 223 questions FDA restent intactes |
| M-01 | Script MDR : `require()` incompatible avec `"type":"module"`, colonne `risks` supprimée toujours référencée | `scripts/import-mdr-questions.js` | Le script s'exécute maintenant sans erreur (`node scripts/import-mdr-questions.js`) |

## Ajout : `scripts/promote-admin.ts`

Remplace la fonction perdue avec la suppression du backdoor/devLogin (créer le tout premier compte admin). CLI one-shot, jamais exposée en HTTP : `DATABASE_URL=... npx tsx scripts/promote-admin.ts email@example.com`. L'utilisateur doit déjà s'être inscrit normalement.

## Tests

Suite Playwright complète (`frontend-qara/e2e/`) : **10/10 tests passent** après ces correctifs (contre 8/10 avant, les 2 échecs restants documentant précisément C-07). Le test `transformer-bug.spec.ts` a été réécrit en test de non-régression positif (il vérifiait auparavant la présence du bug ; il vérifie maintenant son absence).

## Points d'attention pour la suite

- **`JWT_SECRET`** doit être défini comme variable d'environnement sur Railway avant déploiement (le code lève une erreur explicite au démarrage en production si absent — aucun fallback silencieux n'est utilisé hors développement).
- La migration transparente des mots de passe (C-03) ne s'applique qu'au **prochain login réussi** de chaque compte existant — un compte qui ne se reconnecte jamais garde un mot de passe en clair en base jusqu'à sa prochaine connexion. Comme il n'existe toujours pas de parcours "mot de passe oublié" (Phase 3), ceci reste la meilleure option disponible sans casser l'accès des comptes existants.
- Le comportement du système en production réelle (Railway) n'a pas pu être vérifié directement (pas d'accès fourni) — seule une instance locale reconstituée à l'identique a été testée.
