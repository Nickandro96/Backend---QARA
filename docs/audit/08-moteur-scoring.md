# Lot 2 — Moteur de scoring (SPEC-1)

## Périmètre livré

- `server/scoring/types.ts` — types partagés (`ScoringQuestion`, `ScoringResponse`,
  `ScoringResult`, `ScoringConfig`, etc.) et configuration par défaut
  (`DEFAULT_SCORING_CONFIG`).
- `server/scoring/scoringEngine.ts` — moteur pur et déterministe : prend en
  entrée les questions du périmètre audité + les réponses saisies, ne fait
  aucun accès base de données.
- `server/scoring/scoringEngine.test.ts` — 11 tests unitaires (`node:test`),
  couvrant les deux types de question, l'exclusion des N/A, la pondération par
  criticité, la règle bloquante, les seuils de statut, la gradation des
  écarts, le déterminisme, les regroupements par référentiel/processus et la
  couverture croisée.
- `server/scoring/scoringRouter.ts` — adaptateur tRPC (`scoring.compute`) qui
  reconstruit les objets du moteur à partir des lignes DB (`questions`,
  `audit_responses`, `processus`, `referentiels`) et applique le contrôle
  d'accès (l'audit doit appartenir à l'utilisateur courant).

## Fonctionnement du calcul

1. **Score élémentaire** (0 à 1, ou `null` si hors périmètre) :
   - `yes_no_partial_na` : conforme = 1, partiel = 0.5, non conforme = 0 ;
     N/A et « en cours » (pas encore répondu) = `null`.
   - `maturity_0_5` : niveau / 5. Un niveau absent = `null` (pas encore
     répondu).
2. **Score pondéré par groupe** (global, par référentiel, par processus) :
   moyenne des scores élémentaires pondérée par la criticité
   (`poids: { critical: 4, high: 3, medium: 2, low: 1 }`), exprimée en
   pourcentage. Les questions N/A et non répondues sont exclues du
   dénominateur.
3. **Règle bloquante** : si au moins un écart majeur porte sur une question
   `critical` répondue « non », le statut du groupe est forcé à
   `non_conforme`, quel que soit le score numérique.
4. **Seuils de statut** (configurables, valeurs par défaut) :
   - `>= 90 %` → `conforme`
   - `>= 75 %` (et pas de règle bloquante) → `conforme_avec_reserves`
   - en dessous, ou règle bloquante déclenchée → `non_conforme`
5. **Gradation des écarts** : majeur / mineur / observation, dérivée du
   couple (bucket de réponse, criticité) — voir `graviteFor()`.
6. **Couverture croisée** : pour chaque question dont le corpus fournit
   plusieurs `mappings` (au-delà de l'exigence primaire), restitution d'une
   matrice informative des référentiels couverts. Voir déviation ci-dessous.

## Écarts documentés par rapport à la spec d'origine

- **Pas de `grade_mdsap` structuré** : la spec suppose un champ structuré
  `{gravite, grade_mdsap}` sur chaque non-conformité type. Le corpus réel
  (473 questions, `typicalNc`) ne porte que des descriptions textuelles
  libres, sans identifiant de grade MDSAP. Le moteur calcule donc sa propre
  gradation (majeur/mineur/observation) à partir de la criticité et du
  bucket de réponse, indépendamment de tout grade MDSAP explicite.
- **Couverture croisée informative, pas propagative** : la spec envisage un
  mécanisme où une réponse sur une exigence modifie le score d'une exigence
  correspondante dans un autre référentiel. Le corpus ne fournit qu'un
  libellé d'exigence correspondante (`libelle_exigence`), jamais d'identifiant
  vers la question cible — la propagation automatique du score est donc
  impossible à implémenter de façon fiable. Le moteur restitue à la place une
  matrice de couverture croisée à titre informatif (quelles exigences d'autres
  référentiels sont couvertes par la même question), sans modifier aucun
  score.
- **Convention de stockage des niveaux de maturité** : `audit_responses` n'a
  pas de colonne numérique dédiée pour les niveaux de maturité 0-5. Le
  routeur MDR/ISO (`mdr-router.ts`, `iso-router.ts`) stocke le niveau sous
  forme de chaîne ("0".."5") dans la colonne `responseValue` existante ; côté
  scoring, `scoringRouter.ts` reconnaît ces valeurs et les traduit en
  `{ responseValue: "in_progress", maturityLevel: <n> }` avant de les passer
  au moteur pur, qui lit `maturityLevel` en priorité pour ce type de
  question.

## Bug corrigé pendant l'implémentation

`elementaryScore()` excluait à tort **toutes** les réponses de type
`maturity_0_5` du calcul : la garde `responseValue === "in_progress"` était
évaluée avant la lecture de `maturityLevel`, alors que l'adaptateur DB pose
justement `"in_progress"` comme valeur de convention sur toutes les réponses
de maturité (le niveau réel étant porté par `maturityLevel`). Corrigé en
testant `questionType === "maturity_0_5"` en premier. Vérifié par les tests
unitaires (16/16 OK) et par un test de bout en bout via l'API réelle (audit
avec 1 réponse yes/no + 2 réponses de maturité → `questionsApplicables: 3`,
`maturiteMoyenne` correctement calculée, contre `1` et `null` avant
correctif).

## Vérification

- 16/16 tests unitaires (`npm test`), y compris les 11 tests dédiés au
  moteur de scoring.
- Vérification de bout en bout via l'API réelle (`scoring.compute`) sur un
  audit MDR avec réponses mixtes (yes/no + maturité).
- 10/10 tests E2E Playwright (suite de non-régression complète), suite à
  l'élargissement de `ResponseValueEnum` dans `mdr-router.ts`/`iso-router.ts`
  pour accepter les niveaux de maturité "0".."5" (nécessaire pour que ces
  questions soient répondables via l'API existante).
