# Onboarding — wizard de sélection du périmètre (SPEC-onboarding-logique.md / SPEC-onboarding-ecrans.md)

*Périmètre : backend---qara (moteur de scoping + routeur) et frontend---qara
(wizard 4 étapes, gate, composant Stepper). Deux bugs pré-existants sérieux
ont été découverts et corrigés en cours de route (voir §Bugs trouvés).*

## Périmètre livré

### Backend
- `server/onboarding/scopeEngine.ts` — moteur pur : normalisation des
  libellés bruts `economicRole` vers les 4 rôles réglementaires
  (`normalizeEconomicRole`), détection de situation particulière
  (`situationFromEconomicRole`), prédicat de correspondance
  (`matchesScope`), catalogues statiques (référentiels, rôles, marchés,
  situations, raccourcis), validation du scope minimal
  (`validateScopeCompletion`).
- `server/onboarding/scopeEngine.test.ts` — 14 tests unitaires.
- `server/onboarding/onboardingRouter.ts` — routeur tRPC :
  `getScopeOptions` (catalogue + volumes réels par référentiel),
  `getMyScope`/`getGateStatus` (état de reprise/gate), `saveProgress`
  (autosave), `previewCount` (compteur live — même moteur que le filtrage
  réel), `complete` (valide, persiste, crée l'audit filtré).
- `drizzle/migrations/0020_onboarding_scope.sql` — `questions.roleReglementaire`/
  `situationTags` (nouveau), `audits.economicRoles`/`markets`/`situationTags`
  (nouveau, pluriel, en complément du `economicRole` singulier legacy),
  table `user_audit_scope` (source de vérité unique du périmètre,
  remplace `isoQualifications`/`mdrRoleQualifications` pour le scoping).
- `scripts/backfill-role-reglementaire.mjs` — backfill idempotent des 473
  questions.
- `server/mdr-router.ts` — `fetchAuditScopedQuestions` et
  `getQuestionsForAudit` appliquent désormais un filtre JS
  (`applyOnboardingScopeFilter`, basé sur `matchesScope`) pour les audits
  créés via l'onboarding (`economicRoles` non vide sur l'audit), en plus du
  filtrage SQL existant (référentiel, processus) — inchangé pour les audits
  legacy (créés via les wizards ISO/MDR existants, un seul `economicRole`).

### Frontend
- `client/src/components/ui/stepper.tsx` — composant `<Stepper>` générique
  réutilisable (aucun n'existait).
- `client/src/pages/Onboarding.tsx` — wizard 4 étapes (`/onboarding`).
- `client/src/lib/onboardingGate.ts` — redirection post-authentification
  tenant compte du gate.
- `client/src/components/OnboardingResumeBanner.tsx` — bannière de reprise
  sur `ModernHome.tsx`.
- `client/src/_core/hooks/useAuth.ts`, `Register.tsx` — bug `navigate`
  fantôme corrigé, redirection harmonisée (voir §Bugs trouvés).
- `e2e/onboarding.spec.ts` — test de bout en bout (sélection → aperçu →
  démarrage → vraies questions).

## Bugs trouvés et corrigés en cours d'implémentation

### 1. Filtre par rôle silencieusement cassé pour ~338 questions sur 473

Avant ce lot, `fetchAuditScopedQuestions`/`getQuestionsForAudit`
(`mdr-router.ts`) filtraient sur `questions.economicRole` en ne reconnaissant
que 4 valeurs canoniques (+ synonymes anglais). Or le corpus réel porte 12
libellés bruts distincts (`organisme DM`, `fabricant IVD`, `fabricant
participant MDSAP`, `finished device manufacturer`, `assembleur`,
`direction`, etc. — vérifié en base). Résultat mesuré : sur un audit
MDR+ISO13485+ISO14971 avec rôle « fabricant », le filtre ne laissait passer
que 129 questions (uniquement celles littéralement étiquetées `fabricant`)
au lieu des 222 réellement pertinentes — **ISO13485 (93 questions,
`organisme DM`) était intégralement exclu**, un fabricant n'aurait jamais vu
la moindre question ISO13485 dans son audit.

Corrigé en ajoutant `questions.roleReglementaire`/`situationTags`
(normalisés une fois pour toutes via `scopeEngine.ts` + backfill) et un
filtre JS (`matchesScope`) appliqué en plus du SQL existant, uniquement pour
les audits issus de l'onboarding (legacy inchangé). Vérifié : le compteur
`previewCount` et le nombre de questions réellement servies par
`mdr.getQuestionsForAudit` coïncident exactement (222 = 222) sur plusieurs
combinaisons testées.

**Sous-écart découvert et corrigé pendant le développement** : une première
version dérivait aussi `situationTags` depuis `questions.applicableProcesses`
— ce champ s'est révélé être une liste d'audience large et **dupliquée par
processus**, pas un signal fiable par question (les 67 questions ISO14971
portent toutes `assembleur si impact risque` aux côtés de `fabricant`/
`fabricant IVD`, ce qui aurait masqué la totalité d'ISO14971 derrière une
case à cocher « assemblage » non cochée par défaut). Retiré ; `situationTags`
est dérivé uniquement de `economicRole` (qui varie réellement question par
question).

### 2. `insertId` mal lu sur les inserts drizzle-orm/mysql2 (id `undefined`)

`server/db.ts` lisait `(result as any).insertId` directement sur le retour de
`db.insert(...).values(...)`, alors que le driver mysql2 retourne un tuple
`[ResultSetHeader, FieldPacket[]]` — `insertId` vit sur `result[0]`, pas sur
`result`. Cinq fonctions étaient touchées : `createSite`, `upsertOrganisation`,
`createAudit`, `createEvidenceFile`, `upsertUser` — toutes retournaient
silencieusement `id: undefined`. Découvert via le test E2E de l'onboarding :
`onboarding.complete` créait bien l'audit en base mais renvoyait
`auditId: undefined`, donc une redirection vers `/mdr/audit/undefined`. Le
même bug affectait déjà `audit.create` (endpoint pré-existant, jamais
détecté car les vérifications précédentes de cette session passaient
systématiquement par une requête SQL directe plutôt que par la réponse de
l'API). Corrigé avec le pattern défensif déjà utilisé ailleurs dans le code
(`routers.ts`, `iso-router.ts`, `fda-router.ts`) :
`result?.[0]?.insertId ?? result?.insertId`.

### 3. `navigate` fantôme dans `useAuth.ts`

`useAuth({ redirectOnUnauthenticated: true })` appelait `navigate(...)` sans
jamais l'avoir récupéré de `useLocation()` — une `ReferenceError` prête à se
déclencher dès qu'un appelant activerait cette option (nécessaire pour le
gate d'onboarding). Corrigé ; `Register.tsx` harmonisé sur le même mécanisme
de navigation SPA que `Login.tsx` (au lieu d'un rechargement complet via
`window.location.href`).

## Écarts documentés par rapport à la spec d'origine

- **Case « reconditionnement » sans effet sur le filtrage aujourd'hui** :
  le corpus ne porte aucun libellé `economicRole` dédié au reconditionnement
  (Art. 16) — seul `assembleur` (Art. 22) est identifiable de façon fiable.
  La case reste dans l'UI (conforme à la spec, cases stockées et envoyées au
  backend) mais ne change actuellement aucune question servie, faute de
  signal dans le corpus.
- **Marchés MDSAP captés mais non filtrants** : le corpus ne différencie pas
  les 74 questions MDSAP par juridiction (`article`/`annexe` vides sur toutes
  ces questions). Les marchés sélectionnés sont stockés (`audits.markets`)
  et validés (au moins un requis si MDSAP), mais ne réduisent pas encore le
  sous-ensemble de questions MDSAP affichées — une évolution future du
  corpus serait nécessaire pour ça.
- **Mention « bonus couverture croisée » générique** : l'étape Aperçu
  affiche une phrase informative fixe plutôt qu'une liste calculée en direct
  des référentiels hors scope bénéficiant d'une couverture croisée (cette
  liste existe déjà côté rapport d'audit, Lot 4, `couvertureCroisee`) — non
  dupliquée ici pour éviter d'ajouter un endpoint dédié à une simple ligne
  d'incitation.
- **Pas de layout d'app (sidebar) pendant le wizard** : cohérent avec les
  wizards existants (`MDRAudit.tsx`, `ISOAuditWizard.tsx`), qui masquent déjà
  la navigation pendant un parcours guidé — résout la demande « choisir un
  seul layout » en n'en imposant aucun pendant l'onboarding lui-même.
- **Exemple de rôle toujours visible plutôt qu'au survol/dépli** :
  simplification d'implémentation (texte muted toujours affiché sous la
  description) plutôt qu'une interaction hover/collapse par carte.

## Vérification

- 14/14 tests unitaires `scopeEngine` (69/69 au total sur le dépôt backend).
- Vérification de bout en bout via l'API réelle : `previewCount` et le
  nombre de questions réellement servies (`mdr.getQuestionsForAudit`)
  coïncident sur plusieurs combinaisons de référentiels/rôles ; audits
  legacy (sans scope onboarding) confirmés inchangés (comportement
  identique avant/après).
- Suite Playwright complète : **11/11** (10 tests pré-existants + le nouveau
  `onboarding.spec.ts`), incluant la mise à jour de deux tests pré-existants
  (`auth.spec.ts`, `transformer-bug.spec.ts`) dont les assertions supposaient
  qu'une inscription réussie atterrit toujours sur `/` — désormais faux
  intentionnellement pour un nouvel utilisateur (gate vers `/onboarding`).

## Definition of Done (SPEC-onboarding-ecrans.md)

- [x] Gate : un utilisateur sans scope complet arrive sur `/onboarding`.
- [x] Les 4 étapes fonctionnent, étape Marchés conditionnelle à MDSAP.
- [x] Compteur live juste (= même résultat que le filtrage serveur).
- [x] « Démarrer » crée un audit réellement filtré (vérifié en base : nb de
      questions = compteur affiché).
- [x] Seuls les 4 rôles apparaissent ; aucun libellé parasite (fournisseur
      critique, etc. — jamais exposés dans `ECONOMIC_ROLE_CATALOG`).
- [x] État sauvegardé/repris ; combinaison vide gérée.
- [~] Scope éditable après coup : partiel. `saveProgress`/`getMyScope`
      permettent de revisiter `/onboarding` et de changer la sélection, mais
      `complete` crée systématiquement un **nouvel** audit plutôt que de
      modifier le périmètre d'un audit existant depuis ses propres
      paramètres — cette dernière capacité (éditer l'`auditScope` d'un audit
      déjà créé, sans repasser par le wizard) n'est pas construite dans ce
      lot.
- [x] Un seul `<Stepper>` réutilisable, redirections harmonisées.
