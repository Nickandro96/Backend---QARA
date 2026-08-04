# QARA — Journal de mission (reprise automatique entre sessions)

**Lire ce fichier en premier au début de chaque session.** Reprendre à "PROCHAINE ACTION"
ci-dessous. Un simple « continue » de l'utilisateur doit suffire à reprendre sans reperdre de
contexte.

---

## ÉTAT ACTUEL (mis à jour : 2026-08-04)

### CHANTIER 1 — Qualité du corpus

**Passe mécanique (171 questions)** : ✅ code mergé dans `qitbxl` (PR #4). Le déploiement Railway
qui a suivi exécute `import-corpus.mjs` à chaque release, qui a très probablement déjà réappliqué
`questionText` correct pour ces 171 lignes (upsert par `questionKey`, cohérent avec l'observation
"45/473 tronquées restantes"). **Reste : `questionTextSource` (colonne de traçabilité) est
probablement encore NULL pour elles** — `import-corpus.mjs` ne la touche jamais. Backfill préparé,
voir plus bas.

**Passe éditoriale (45 questions)** : ✅ validée intégralement par l’utilisateur en langage simple. Les quatre ajustements réglementaires finaux ont également été validés : production/post-production ISO 14971, CAPA FDA selon le QMSR actuel, périmètre SMQ d’ISO 9001 §6.1 et risque résiduel global ISO 14971 §8. Aucun déploiement ni SQL de production n’a été exécuté.

**24 titres tronqués silencieusement** : ✅ corrections validées explicitement par l’utilisateur. Elles restent bloquées par le point de contrôle B avant toute exécution en production.

**Script SQL consolidé prêt** : `scripts/output/final-pass.sql` (8 blocs : migration additive,
backfill questionTextSource pour les 171, 6 blocs de la passe éditoriale, correction des 24
titres). Procédure complète dans `VALIDATION-titres-tronques.md` section D-E.

**⚠️ Blocage technique confirmé** : cette session n'a ni `DATABASE_URL` ni accès réseau direct à
`turntable.proxy.rlwy.net:32678` (MySQL, pas HTTPS — le proxy sortant de la session ne route que
du HTTPS). **Impossible d'exécuter du SQL contre new-claude depuis une session Claude Code** dans
cette configuration réseau, indépendamment de la règle de mission (§3.B) qui l'interdit de toute
façon. L'utilisateur doit exécuter `scripts/output/final-pass.sql` lui-même dans Railway.

**141 groupes divergents** : ❌ non commencé. Diagnostic complet disponible dans
`DIAGNOSTIC-corpus.md` (branche `claude/qara-backend-corpus-diagnostic`, non mergée) : 25 groupes
Type 1 (fusion), 45 Type 2 (conserver, différencier les `title`), zone intermédiaire (71 groupes,
tri au cas par cas), 21 criticités divergentes. **Point de contrôle A** requis avant toute
fusion/suppression.

**Correctif moteur de score (double comptage)** : investigué, **pas un bug de code**. Lu
`server/scoring/scoringEngine.ts` en entier + le chemin de fetch (`fetchAuditScopedQuestions` dans
`server/mdr-router.ts`) : pas de JOIN à fanout, pas de duplication de ligne — chaque `questionKey`
compte exactement une fois, pondéré par sa criticité, ce qui est le comportement correct pour
les questions réellement posées aujourd'hui. **Le "double comptage" décrit dans le prompt de
mission est une conséquence des groupes Type 1 non fusionnés** (2-3 `questionKey` quasi-identiques
pèsent 2-3× plus qu'une exigence unique dans le score agrégé) — pas quelque chose à corriger dans
`scoringEngine.ts`. Le vrai correctif est la fusion des 25 groupes Type 1 ci-dessus, qui reste un
Point de contrôle A. **Rien à committer ici — investigation qui conclut qu'aucun code ne doit
changer, documentée pour ne pas la refaire.**

**Robustesse import** : vérifié, **déjà satisfait**. `scripts/import-corpus.mjs` fait un upsert
par `questionKey` (select puis update-ou-insert), aucun `DELETE` — confirmé idempotent par
l'historique git (incidents du 25-26/07/2026 déjà corrigés avant cette session). Combiné à la
correction du fichier source (0 troncature dans `questionText`/`title` désormais), un réimport
futur ne peut plus réintroduire les troncatures : il réécrira toujours les mêmes valeurs déjà
correctes. **Rien à committer ici non plus — déjà en place.**

### CHANTIERS 2-5 (rapport d'audit, veille réglementaire, complétude produit, robustesse/sécurité)

❌ **Non commencés.** Chacun est un effort de plusieurs sessions (générateur de rapport PDF/Word/
Excel bilingue, module de veille avec intégrations API réelles, refonte UX, revue de sécurité).
À aborder après CHANTIER 1 (fondation du contenu) — voir `MISSION-globale.md` pour le détail
complet de chaque chantier (prompt maître collé en session, à sauvegarder tel quel si pas déjà
fait).

---

## PROCHAINE ACTION

**Corrections réglementaires appliquées à la branche le 2026-08-04** : `Q-14971-PPP-1811`, les trois `Q-FDA-CMC-*`, les preuves ISO 9001 §6.1 et les deux formulations ISO 14971 §8 ont été alignées. 473 clés conservées, aucune `questionKey` modifiée. Paquet séparé : `scripts/output/regulatory-corrections.sql`.

**Point de contrôle B** : la PR technique #5 et la PR corpus #6 sont ouvertes en brouillon. Procédure exacte dans `PROCEDURE-PRODUCTION-CORPUS.md`. Attendre confirmation d'une sauvegarde récupérable de new-claude et de `IMPORT_CORPUS_ON_RELEASE` absent/différent de `1` avant toute fusion. Ordre : sauvegarde → PR #5 → vérifier import ignoré → actualiser/fusionner PR #6 → vérifier import ignoré → SQL séparés backfill, éditorial, corrections réglementaires, titres → contrôles finaux.

**Passe éditoriale finalisée le 2026-08-04** : 45/45 questions validées en langage simple (ISO14971 25, ISO9001 6, IVDR 3, FDA_QMSR 7, MDR 3, MDSAP 1) et appliquées dans le JSON, les données éditoriales et les SQL préparatoires, sans déploiement. Preuve : 473 lignes / 473 clés uniques ; 45/45 correspondances exactes JSON ↔ données ↔ SQL ; 0 troncature dans `questionText` ; 0 titre avec « … » ou longueur 250. **Point de contrôle A franchi pour les 45 reformulations et, le 2026-08-04, pour les 24 titres complétés. Tout le contenu de cette passe est validé. Point de contrôle B reste requis avant toute sauvegarde/exécution SQL/déploiement de corpus.**

**Point de contrôle A franchi pour ce lot** : les 45 reformulations, les 24 titres et les quatre corrections réglementaires sont validés. Les paquets restent séparés et idempotents. Le point de contrôle B — sauvegarde récupérable et contrôles de new-claude — demeure obligatoire avant toute fusion ou exécution.

**Pendant ce temps, en autonomie complète** (aucun des deux points de contrôle n'est concerné) :
commencer le cadrage des **141 groupes divergents** — préparer une proposition de traitement
(quels groupes fusionner, quels `title` différencier, quelles criticités harmoniser) **pour
présentation à l'utilisateur** (Point de contrôle A), sans rien écrire en base. C'est la suite
logique du CHANTIER 1 et ne dépend pas de l'exécution SQL en attente.

## MISE À JOUR AUTONOME — 2026-08-04, groupes divergents

- Production corpus finalisée et sauvegardée : 473 questions / 473 clés, 0 troncature, 24 titres corrigés, longueur maximale 333.
- PR #5 (garde-fou import), #6 (corpus) et #8 (title VARCHAR(1024)) fusionnées et vérifiées sur Railway.
- Recalcul effectué sur le JSON de production actuel : 141 groupes / 354 questions ; 42 groupes forte similarité, 63 moyens, 36 faibles ; 46 groupes contiennent un doublon texte exact ; 21 groupes ont une criticité divergente.
- Lot 1 validé : 7 groupes, 8 clés à désactiver non destructivement. Registre documentaire : `docs/corpus/approved-retirements-lot-1.json`.
- Diagnostic complet reproductible : `docs/corpus/divergent-groups-current.json`.
- Conception de conservation historique : `docs/corpus/non-destructive-retirement-design.md`.
- Aucune question supprimée, aucune migration préparée ou exécutée, aucun comportement runtime modifié.

### Prochaine action

Implémenter sur branche de travail la désactivation additive (`isActive`, `supersededByQuestionKey`) avec distinction stricte nouveaux audits / audits historiques, puis tests. Ne pas fusionner ni appliquer en production avant point de contrôle B. Préparer en parallèle les prochains lots exacts pour point de contrôle A.
