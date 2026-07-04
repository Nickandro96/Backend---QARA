# Lot 4 — Rapport d'audit (SPEC-3)

## Périmètre livré

- `server/report/types.ts` — types du rapport assemblé (`AuditReport`,
  `ExecutiveSummary`, `RadarPoint`, etc.).
- `server/report/reportBuilder.ts` — assembleur pur : `buildAuditReport()`
  construit la structure complète du rapport (§2 SPEC-3) à partir du
  résultat du moteur de scoring (Lot 2) et du plan d'action CAPA (Lot 3).
  `topPriorities()` isole les 3-5 priorités absolues (§2.2) en excluant les
  actions déjà clôturées.
- `server/report/csvExport.ts` — export CSV du registre des écarts et du plan
  d'action (voir déviation ci-dessous).
- `server/report/reportBuilder.test.ts`, `csvExport.test.ts` — 9 tests
  unitaires (`node:test`).
- `server/report/reportRouter.ts` — routeur tRPC (`report.generate`,
  `report.exportGapRegisterCsv`, `report.exportActionPlanCsv`).

## Fonctionnement

`report.generate` recalcule le scoring (Lot 2) et relit le plan d'action
CAPA (Lot 3) de l'audit, puis assemble en un seul appel, sans saisie
manuelle (§7 SPEC-3) :

1. **Page de garde** (`meta`) : organisation (`audits.clientOrganization`),
   site, rôle économique, référentiels couverts, dates, auteur, niveau de
   rapport (synthétique/détaillé), horodatage de génération.
2. **Synthèse exécutive** (`syntheseExecutive`) : score + statut global,
   score par référentiel, répartition des écarts par gravité, nombre
   d'écarts critiques, verdict (`pret` / `pret_avec_reserves` / `pas_pret`)
   dérivé directement du statut calculé par le moteur de scoring, et les 3-5
   priorités absolues du plan d'action.
3. **Radar par processus** (`radarParProcessus`) : un point `{processName,
   referentialCode, score}` par processus — la donnée brute pour un graphique
   radar ; le rendu visuel (SVG/Canvas) est un souci de présentation laissé
   au frontend (voir déviation).
4. **Résultats détaillés par référentiel** (`resultatsParReferentiel`) :
   repris tels quels du moteur de scoring (score, statut, écarts par
   référentiel).
5. **Registre des écarts** (`registreEcarts`) : la liste des écarts du
   moteur, déjà triée par gravité décroissante.
6. **Plan d'action** (`planAction`) : les fiches CAPA de l'audit, triées par
   priorité (réutilise `sortByPriority` du Lot 3).
7. **Matrice de couverture croisée** (`couvertureCroisee`) : reprise telle
   quelle du moteur de scoring (Lot 2).
8. **Annexes** (`annexes`) : seuils et pondérations de configuration du
   moteur, nombre de questions N/A et non répondues.
9. **Mention légale** (`mentionLegale`) : rappel fixe (§6 SPEC-3) que l'outil
   est une auto-évaluation préparatoire.

Le niveau `synthetique` (§5 SPEC-3) retourne un sous-ensemble (page de garde +
synthèse exécutive + radar + mention légale) ; le niveau `detaille` retourne
la structure complète.

## Écarts documentés par rapport à la spec d'origine

- **Pas de génération PDF binaire (visuels jauges/radar/camembert) côté
  backend** : la spec demande un PDF « prêt à présenter/imprimer » avec des
  visuels obligatoires. Ce Lot livre la donnée structurée **complète et
  déterministe** dont tous les visuels dérivent directement (§3 SPEC-3 :
  « pas de saisie manuelle »), prête à être rendue par le frontend
  (HTML imprimable en PDF via le navigateur, ou composants graphiques
  React). Un générateur PDF backend dédié (mise en page fixe,
  `pdfkit`) existe déjà dans le dépôt (`server/report-generator.ts`) pour un
  flux FDA distinct, mais son modèle de données (`findings`/`actions`
  génériques) ne correspond pas à celui du moteur de scoring multi-référentiel
  (Lots 2-3) et porte des erreurs de type pré-existantes sans rapport avec ce
  Lot (colonnes `criticality`/`findingType`/`priority` absentes du schéma
  actuel) — non modifié ici, scope distinct.
- **Export CSV plutôt que `.xlsx` natif** (§4 SPEC-3 : « Excel — les données
  brutes ») : aucune librairie de génération `.xlsx` n'est une dépendance
  existante du projet. Le CSV s'ouvre nativement dans Excel/LibreOffice/
  Google Sheets et satisfait le besoin réel (données brutes pour
  retraitement) sans ajouter de dépendance binaire non validée par
  l'utilisateur.
- **i18n** : la spec anticipe une architecture multilingue (§5). Le corpus
  et tous les libellés du rapport sont en français uniquement à ce stade,
  conformément au périmètre du corpus vérifié (voir Phase 4) ; aucune
  architecture i18n n'a été ajoutée dans ce Lot (hors périmètre validé pour
  cette itération).

## Vérification

- 39/39 tests unitaires (`npm test`), dont 9 dédiés au rapport (assemblage,
  verdict, priorisation, export CSV).
- Vérification de bout en bout via l'API réelle sur l'audit MDR id=10 (déjà
  utilisé pour les Lots 2-3) : `report.generate` (niveaux détaillé et
  synthétique), `report.exportGapRegisterCsv`, `report.exportActionPlanCsv`
  — toutes les sections attendues présentes, l'action CAPA déjà clôturée
  (`cloturee_efficace`) correctement exclue des priorités absolues.
- 10/10 tests E2E Playwright (suite de non-régression complète).
