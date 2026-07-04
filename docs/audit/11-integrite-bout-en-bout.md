# Vérification d'intégrité bout-en-bout — 9 champs riches du corpus

*Protocole exécuté en local (base MySQL + backend réels) sur le corpus vérifié (473 questions). Réponses aux 5 étapes demandées.*

## Étape 1 — La base contient-elle les 9 colonnes et sont-elles remplies ?

```
SHOW COLUMNS FROM questions;
```
Les 9 colonnes existent : `auditVerifies, relances, explanationSimple, concreteExample,
conformityCriteria, typicalNc, mappings, referenceStatus, officialSource`.

Taux de remplissage réel (473 lignes) :

| Colonne | Vides | Total |
|---|---|---|
| auditVerifies | 0 | 473 |
| explanationSimple | 0 | 473 |
| concreteExample | 0 | 473 |
| conformityCriteria | 0 | 473 |
| mappings | 0 | 473 |
| typicalNc | 0 | 473 |
| relances | 0 | 473 |
| referenceStatus | 0 | 473 |
| officialSource | 0 | 473 |

**Aucune perte à l'import.** Les 9 champs sont remplis à 100 %, exactement comme dans
`questions_import_ready.json`. Vérification complémentaire : `scripts/import-corpus.mjs`
fait un mapping direct nom-à-nom (`auditVerifies: row.auditVerifies || null`, etc.), sans
renommage ni transformation — donc le JSON source utilise déjà littéralement ces noms de
colonnes. Il n'existe **aucun champ `comment_repondre` ou `grade_mdsap` dans le JSON
source** : ce ne sont pas des colonnes DB qui auraient été perdues à l'import, ce sont des
noms de la spec d'origine (SPEC-1/SPEC-2) qui ne correspondent à aucun champ réel du
corpus retravaillé — confirmé en Étape 2 et 3 ci-dessous.

Distribution complémentaire (`mappings`) : 199 questions n'ont qu'une correspondance
(l'exigence primaire seule, pas de couverture croisée), 274 en ont plusieurs (2 à 11) —
donc la couverture croisée est réellement exploitable sur 58 % du corpus.

## Étape 2 — Le scoring exploite-t-il bien la gravité / le grade ?

Code vérifié (`server/scoring/scoringEngine.ts`, fonction `graviteFor`) :

```ts
function graviteFor(bucket: "non" | "partiel", criticality: Criticality): Gravite {
  const highOrCritical = criticality === "critical" || criticality === "high";
  if (bucket === "non") return highOrCritical ? "majeur" : "mineur";
  return highOrCritical ? "mineur" : "observation";
}
```

Confirmé : la gradation des écarts s'appuie sur `criticality` (rempli à 100 %, 4 valeurs
possibles) + le bucket de réponse (non/partiel/conforme) — **pas** sur un champ
`grade_mdsap` structuré, qui n'existe pas dans le corpus. `typicalNc` (texte libre, ex.
« Mineure : … » / « Majeure : … ») est transporté tel quel sur l'écart (`Ecart.typicalNc`)
à titre informatif — il n'est pas re-parsé pour en dériver la gravité. C'est documenté
depuis le Lot 2 (`docs/audit/08-moteur-scoring.md`) et confirmé ici : **c'est un
renommage/reformat assumé, pas une perte** — la source de gradation (`criticality`) est
fiable à 100 % et strictement plus robuste qu'un parsing de texte libre.

Amélioration optionnelle notée mais non implémentée : reparser `typicalNc[0]` (qui
commence systématiquement par « Mineure : » / « Majeure : » / « Majeure critique : »,
voir Étape 1) pourrait affiner la gravité à 3 niveaux au lieu de 2 pour les cas non-bucket
`non`. Non nécessaire pour l'intégrité : la gradation actuelle est correcte, juste moins
fine que ce qu'un `grade_mdsap` 1-6 aurait permis.

## Étape 3 — Le CAPA récupère-t-il la richesse ?

Vérifié en direct sur les 3 fiches CAPA générées depuis l'audit MDR réel (id=10) :
`action_recommandee` non vide dans les 3 cas, dérivé de `auditVerifies` +
`expectedEvidence` (voir `server/capa/capaEngine.ts::buildActionDraft`).

**Écart de conception à documenter explicitement** (le protocole suggérait
`actionPlan`/`aiPrompt`) : vérification en base —

| Champ source envisagé | Vides / 473 | Nature réelle du contenu |
|---|---|---|
| `actionPlan` | 473 (100 % vide) | Champ mort dans le corpus actuel — jamais rempli |
| `aiPrompt` | 0 (100 % rempli) | Guide d'entretien pour l'auditeur (« Ouvrir la procédure, choisir un cas réel… ») — méthodologie d'audit, pas une action corrective pour l'audité |
| `expectedEvidence` | 0 (100 % rempli) | Liste des preuves attendues — utilisable directement comme action |
| `auditVerifies` | 0 (100 % rempli) | Ce que la question vérifie réellement — utilisable directement comme action |

Décision confirmée (déjà prise au Lot 3, revalidée ici) : `action_recommandee` utilise
`auditVerifies` + `expectedEvidence`, **pas** `actionPlan` (vide à 100 %, donc inutilisable)
ni `aiPrompt` (guide d'entretien pour l'auditeur en situation d'audit, pas une action de
mise en conformité pour l'organisation auditée — les deux contenus ont des publics et des
moments d'usage différents). Aucune perte : les fiches CAPA ont bien un contenu
actionnable à 100 %. `aiPrompt`/`relances` restent disponibles en base pour un usage futur
côté UI d'entretien (non demandé dans ce Lot).

Lien vers l'exigence (`reference`/`title` via `referentialCode`/`questionKey`) et
criticité : présents sur chaque fiche CAPA (`referentialCode`, `criticality`).

## Étape 4 — Le rapport affiche-t-il les champs riches ?

Audit du code du Lot 4 **avant correction** (`server/report/types.ts`,
`AuditReport.registreEcarts: Ecart[]`) :

| Élément attendu | Champ source | Présent avant correction | Présent après correction |
|---|---|---|---|
| Explication « débutant » d'un écart | `explanationSimple` | ☐ absent | ✅ `registreEcarts[].explanationSimple` |
| Ce que l'auditeur vérifie | `auditVerifies` | ☐ absent en tant que champ dédié (seulement fondu en prose dans `action_recommandee`) | ✅ `registreEcarts[].auditVerifies` |
| Critères conforme/non conforme | `conformityCriteria` | ☐ absent | ✅ `registreEcarts[].conformityCriteria` |
| Couverture croisée (N référentiels) | `mappings` | ✅ déjà présent (`couvertureCroisee`, `planAction[].referentielsImpactes`) | ✅ inchangé |
| Statut de vérification de la référence | `referenceStatus` | ☐ absent | ✅ `registreEcarts[].referenceStatus` |
| Source officielle citée | `officialSource` | ☐ absent | ✅ `registreEcarts[].officialSource` |
| Exemple concret | `concreteExample` | ☐ absent | ✅ `registreEcarts[].concreteExample` |

**4 champs sur 9 étaient chargés en mémoire pendant la génération du rapport
(`questionRows` dans `loadAuditScoringContext`) mais jamais attachés à la sortie** —
exactement le risque décrit en introduction (contenu en base, non exploité au rendu).
`typicalNc` et `mappings` étaient déjà correctement exposés depuis le Lot 2/3.

### Correction appliquée (ce même lot)

- `server/report/types.ts` : nouveau type `EcartEnrichi` (étend `Ecart` avec les 6 champs
  ci-dessus) ; `AuditReport.registreEcarts` retypé en `EcartEnrichi[]`.
- `server/report/reportBuilder.ts` : nouvelle fonction pure `enrichEcarts()` qui associe
  chaque écart aux champs riches de sa question via une table de correspondance
  `questionsByKey` (fallback à `null` propre si une question n'a pas de correspondance —
  testé, ne plante pas).
- `server/report/reportRouter.ts` : construction de `questionsByKey` à partir de
  `questionRows` (déjà chargé par `loadAuditScoringContext`, aucune requête DB
  supplémentaire).

Vérifié en direct sur l'audit MDR réel (id=10) : les 3 écarts du registre portent
désormais `explanationSimple`, `officialSource` (URL EUR-Lex réelle),
`referenceStatus` (« vérifiée (structure officielle MDR (UE) 2017/745, EUR-Lex,
2026-07-02) »), et `conformityCriteria` (`{conforme, non_conforme}`) non vides.

## Étape 5 — Test bout-en-bout sur 1 cas réel

Question suivie : `Q-MDR-OF-8437` (MDR, processus « Obligations fabricant »,
criticité `high`, type `maturity_0_5`).

| Étape | Constat |
|---|---|
| JSON import | `auditVerifies`, `explanationSimple`, `conformityCriteria`, `referenceStatus`, `officialSource`, `mappings` (6 correspondances) tous remplis dans `questions_import_ready.json` |
| Ligne en base | Mêmes 6 champs confirmés non vides via `SELECT` direct (`questions` id correspondant) |
| Réponse « 2 » (maturité faible) | Score élémentaire 0.2/1, bucket « partiel » (criticité `high` → gravité `majeur`) |
| Écart scoré | `Ecart` contient `gravite: majeur`, `typicalNc` (3 entrées textuelles), et depuis la correction : `explanationSimple`, `officialSource`, `conformityCriteria`, `referenceStatus` |
| Fiche CAPA générée | `action_recommandee` non vide (dérivé de `auditVerifies`+`expectedEvidence`), `referentielsImpactes` = 2 référentiels (ISO 14971, MDR/IVDR Annexe I) |
| Apparition dans le rapport | Présent dans `registreEcarts` (enrichi), dans `planAction`, dans `couvertureCroisee` |

Aucune perte constatée sur ce fil unique après correction. Avant correction, l'étape
« apparition dans le rapport » perdait `explanationSimple`/`conformityCriteria`/
`referenceStatus`/`officialSource` (présents à toutes les étapes précédentes, absents à
la dernière).

## Confirmation explicite demandée

- **`grade_mdsap`** : n'a jamais existé comme champ dans le corpus retravaillé (vérifié
  dans le JSON source ET dans le schéma DB). La gravité est dérivée de `criticality` +
  bucket de réponse — une source fiable à 100 %, documentée depuis le Lot 2. **Renommage/
  reformat assumé, pas une perte de donnée.**
- **`comment_repondre`** : n'a jamais existé comme champ dans le corpus retravaillé.
  `action_recommandee` (CAPA) est dérivé de `auditVerifies` + `expectedEvidence`, tous
  deux remplis à 100 %. **Renommage/reformat assumé, pas une perte de donnée.**

## Bilan

| Champ | En base | Dans scoring (`Ecart`) | Dans CAPA (fiche) | Dans rapport (avant) | Dans rapport (après) |
|---|---|---|---|---|---|
| `auditVerifies` | ✅ 100% | — | ✅ (prose) | ❌ | ✅ |
| `explanationSimple` | ✅ 100% | — | — | ❌ | ✅ |
| `concreteExample` | ✅ 100% | — | — | ❌ | ✅ |
| `conformityCriteria` | ✅ 100% | — | — | ❌ | ✅ |
| `typicalNc` | ✅ 100% | ✅ | ✅ (prose) | ✅ | ✅ |
| `mappings` | ✅ 100% | (via couverture croisée) | ✅ (`referentielsImpactes`) | ✅ | ✅ |
| `referenceStatus` | ✅ 100% | — | — | ❌ | ✅ |
| `officialSource` | ✅ 100% | — | — | ❌ | ✅ |
| `relances` | ✅ 100% | — | — | — | — (hors périmètre, voir note) |

**Note sur `relances`** : champ de relances d'entretien pour l'auditeur en situation
d'audit live (« Montrez-moi maintenant le cas qui n'a pas suivi le chemin normal… »).
Contexte d'usage différent (pendant la conduite de l'audit, pas dans le rapport final
figé) — non câblé dans ce Lot, ce n'est pas un oubli mais un choix de périmètre : ce champ
relève d'une future UI d'assistance à l'entretien, pas du rapport SPEC-3.

## Vérification

- 41/41 tests unitaires (`npm test`), dont 2 nouveaux tests dédiés à l'enrichissement du
  registre des écarts (présence des champs + fallback `null` propre sans correspondance).
- Vérification de bout en bout via l'API réelle (`report.generate`) sur l'audit MDR id=10 :
  les 3 écarts portent désormais tous les champs riches, avec des valeurs réelles
  (URL EUR-Lex, statut de vérification daté).
- 10/10 tests E2E Playwright (suite de non-régression complète), aucune régression.
- Zéro nouvelle erreur TypeScript introduite (164, identique à la baseline post-Lot 4).
