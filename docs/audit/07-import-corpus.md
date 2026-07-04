# Import du corpus de contenu vérifié (473 questions, 7 référentiels)

**Contexte** : en parallèle du Lot 0, un corpus de contenu réglementaire a été préparé séparément (473 questions couvrant MDR, IVDR, FDA QMSR, MDSAP, ISO 13485, ISO 14971, ISO 9001 — décrit comme vérifié à 100% sur sources officielles), accompagné d'un script d'import et de 3 spécifications fonctionnelles (moteur de scoring, plan d'action CAPA, rapport d'audit). Fournis via `INSTRUCTION-CLAUDE-CODE.md`, `README-pont-import.md`, `SPEC-1/2/3-*.md`, `import-corpus.mjs`, `questions_import_ready.json`.

## Décision validée (04/07/2026)

Le nouveau corpus chevauchait le contenu MDR/FDA déjà importé en Lot 0 : `MDR` (même code référentiel, 80 questions dans le corpus contre 826 déjà en base) et un nouveau code `FDA_QMSR` (43 questions) distinct des deux référentiels FDA existants (`FDA_QSR_21CFR820` 30 questions, `FDA_US_MARKET_ACCESS` 193 questions). **Décision : remplacement complet** — l'ancien contenu MDR (826 questions) et les deux anciens référentiels FDA sont supprimés au profit du nouveau corpus vérifié.

## Écarts corrigés entre le script fourni et le schéma réel

Le script `import-corpus.mjs` fourni supposait une colonne `processus.referentialId` qui n'existe pas dans le schéma actuel (`processus` est une table **partagée** entre référentiels, sans rattachement direct — voir `01-comprehension.md`). Corrigé pour matcher/créer les processus par nom uniquement, cohérent avec le modèle existant. Autres corrections : import du schéma Drizzle (chemin `.ts` explicite), mise à jour du nom/type des référentiels déjà existants (pas seulement à la création), remplacement de l'ancien contenu MDR/FDA avant import (voir §0 du script).

**Conséquence architecturale à noter** : le nouveau corpus utilise une granularité de processus beaucoup plus fine par référentiel (ex. IVDR a ses propres sous-processus "Vigilance IVDR", "PMS IVDR", etc., distincts des processus MDR équivalents) — la table `processus` compte désormais ~240 lignes au lieu de 15. C'est une caractéristique du corpus fourni (granularité au niveau de l'exigence), pas un bug : à garder en tête pour le moteur de scoring (Spec 1), qui restitue des résultats "par_processus" — le regroupement sera donc fin, pas limité à 15 catégories.

## Migration

`drizzle/migrations/0018_rich_question_fields.sql` ajoute 9 colonnes à `questions` (`auditVerifies`, `relances`, `explanationSimple`, `concreteExample`, `conformityCriteria`, `typicalNc`, `mappings`, `referenceStatus`, `officialSource`) pour préserver la profondeur pédagogique du corpus (voir `README-pont-import.md` pour le détail du mapping champ par champ).

## Procédure d'exécution

```bash
npx tsx drizzle/... # migration déjà versionnée, appliquée via apply-sql-migrations.ts en production
DATABASE_URL=... npx tsx scripts/import-corpus.mjs
```

Vérification (résultat obtenu et confirmé) :
```sql
SELECT r.code, COUNT(*) FROM questions q JOIN referentiels r ON q.referentialId=r.id GROUP BY r.code;
-- MDR 80, IVDR 72, FDA_QMSR 43, MDSAP 74, ISO13485 93, ISO14971 67, ISO9001 44 = 473
```

## Suite (Lots 2-4, specs fournies)

- **Lot 2 — Moteur de scoring** (`SPEC-1-moteur-scoring.md`) : conversion réponse→score pondérée par criticité, règle de blocage sur écart critique, gradation MDSAP, propagation multi-référentiel via `mappings`.
- **Lot 3 — Plan d'action CAPA** (`SPEC-2-plan-action-CAPA.md`) : génération automatique depuis les écarts, cycle de vie avec vérification d'efficacité obligatoire (pas de clôture directe), priorisation.
- **Lot 4 — Rapport d'audit** (`SPEC-3-rapport-audit.md`) : synthèse exécutive, radar par processus, registre des écarts, export PDF/Excel en un clic.

Ces specs ne redemandent pas d'audit du contenu réglementaire (déjà fait et vérifié côté fourniture) — le rôle de cette session est l'implémentation, pas la recherche.
