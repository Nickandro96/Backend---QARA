# Lot 3 — Plan d'action CAPA (SPEC-2)

## Périmètre livré

- `server/capa/types.ts` — types partagés (`CapaAction`, `CapaStatus`,
  `CapaActionDraft`, etc.).
- `server/capa/capaEngine.ts` — moteur pur : dérive un brouillon d'action
  depuis un écart du moteur de scoring (`buildActionDraft`), calcule un score
  de priorité (`priorityScore`, `sortByPriority`) et valide le cycle de vie
  des statuts (`isValidStatusTransition`, `validateTransitionFields`).
- `server/capa/capaEngine.test.ts` — 14 tests unitaires (`node:test`).
- `server/capa/capaRouter.ts` — routeur tRPC (`capa.generateFromAudit`,
  `capa.list`, `capa.update`, `capa.updateStatus`, `capa.history`).
- `drizzle/schema.ts` / `drizzle/migrations/0019_capa_actions.sql` — tables
  `capa_actions` (une fiche par écart, scopée `userId`+`auditId`+`questionKey`,
  contrainte unique) et `capa_action_history` (historique immuable,
  insert-only).
- `server/scoring/scoringRouter.ts` — extrait `loadAuditScoringContext()` en
  fonction exportée, réutilisée telle quelle par `capaRouter.ts` pour éviter de
  dupliquer la reconstruction questions/réponses déjà écrite pour le moteur de
  scoring (Lot 2).

## Fonctionnement

1. **Génération** (`capa.generateFromAudit`) : recalcule les écarts de
   l'audit via `buildScoringResult` (même moteur que Lot 2), puis crée une
   fiche CAPA pour chaque écart n'ayant pas déjà de fiche (idempotent — la
   contrainte unique `(userId, auditId, questionKey)` empêche les doublons).
   Chaque fiche est pré-remplie avec :
   - le constat (`ecartIdentifie`) : réponse donnée, score élémentaire, NC
     typiques du corpus le cas échéant ;
   - l'action recommandée (`actionRecommandee`), dérivée de `auditVerifies` +
     `expectedEvidence` de la question (voir déviation ci-dessous) ;
   - les référentiels impactés (`referentielsImpactes`), repris de la
     couverture croisée déjà calculée par le moteur de scoring (Lot 2).
2. **Priorisation** (`capa.list`) : tri par score de priorité =
   `gravité × 10 + criticité` (gravité prépondérante), donc majeur/critical en
   tête, observation/low en dernier — conforme à l'ordre demandé par la spec
   (§5).
3. **Cycle de vie** (`capa.updateStatus`) : `ouverte → en_cours → a_verifier →
   cloturee_efficace | cloturee_inefficace`, avec `cloturee_inefficace →
   en_cours` pour la réouverture. Aucun saut direct `en_cours →` clôture n'est
   possible : `isValidStatusTransition()` le rejette explicitement (`BAD_REQUEST`).
   `cloturee_sans_suite` est atteignable depuis `ouverte` ou `en_cours` pour
   l'abandon justifié (§8 — jamais de suppression physique).
4. **Champs obligatoires par transition** (`validateTransitionFields`) :
   - analyse de cause racine obligatoire avant `en_cours` pour une gravité
     `majeur` (5 pourquoi / Ishikawa, §4 SPEC-2) ;
   - preuve de réalisation obligatoire avant `a_verifier` ;
   - preuve d'efficacité + résultat cohérent (`efficace`/`inefficace`)
     obligatoires avant toute clôture.
5. **Traçabilité** (`capa.history`) : chaque modification de champ (y compris
   les changements de statut) est journalisée dans `capa_action_history`
   (horodatée, attribuée à l'utilisateur), table insert-only — aucune mise à
   jour ni suppression de ligne d'historique.

## Écarts documentés par rapport à la spec d'origine

- **Pas de champs `comment_repondre` / `preuves_a_demander` dans le corpus
  réel** : la spec suppose que `action_recommandee` se dérive de ces deux
  champs. Le corpus vérifié (473 questions) ne les porte pas ; le champ le
  plus proche, `actionPlan`, existe en base mais est **vide pour les 473
  questions** (vérifié). `action_recommandee` est donc dérivé de
  `auditVerifies` (ce que la question vérifie réellement) et
  `expectedEvidence` (preuves attendues), les champs les plus proches
  réellement peuplés — avec un libellé générique de repli si les deux sont
  absents.
- **Pas de `grade_mdsap` structuré** (même déviation que Lot 2) : la
  priorisation utilise la gravité (majeur/mineur/observation, déjà calculée
  par le moteur de scoring) et la criticité de la question, pas un grade
  MDSAP 1-6 explicite qui n'existe pas dans le corpus.
- **`referentielsImpactes` provient de la couverture croisée informative du
  Lot 2**, pas d'un mécanisme de propagation de score : conformément à la
  déviation déjà documentée dans `docs/audit/08-moteur-scoring.md`, ces
  référentiels sont affichés à titre indicatif sur la fiche CAPA (§7 SPEC-2 —
  « une seule action, plusieurs conformités améliorées »), sans modifier
  aucun score dans les autres référentiels.

## Vérification

- 30/30 tests unitaires (`npm test`), dont 14 dédiés au moteur CAPA.
- Vérification de bout en bout via l'API réelle sur un audit MDR réel
  (id=10) : génération de 3 fiches CAPA depuis 3 écarts détectés,
  idempotence confirmée (deuxième appel : `created: 0`), cycle de vie complet
  testé (`ouverte → en_cours → a_verifier → cloturee_efficace`) avec rejet
  effectif des transitions invalides (`ouverte → a_verifier` direct,
  `en_cours → cloturee_efficace` direct) et des champs manquants (cause
  racine, preuve de réalisation, preuve d'efficacité), historique de
  traçabilité vérifié (7 entrées, horodatées, attribuées).
- 10/10 tests E2E Playwright (suite de non-régression complète), aucune
  régression liée à l'ajout du routeur `capa`.
