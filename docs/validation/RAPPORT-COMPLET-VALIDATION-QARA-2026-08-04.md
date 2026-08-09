Exit code: 0
Wall time: 1.5 seconds
Output:
# QARA â€” Rapport complet de validation avant fusion

Date : 4 aoÃ»t 2026  
PÃ©rimÃ¨tre : corpus, rapports d'audit V2, sÃ©curitÃ© d'accÃ¨s, frontend, dÃ©ploiement Railway et groupes divergents.

## 1. Ã‰tat synthÃ©tique

Le corpus de production est sain aprÃ¨s les corrections dÃ©jÃ  appliquÃ©es : 473 questions, 473 clÃ©s distinctes, aucune question tronquÃ©e, aucun titre terminÃ© par des points de troncature et aucun doublon de `questionKey`. Une sauvegarde avant et une sauvegarde aprÃ¨s traitement existent.

Le gÃ©nÃ©rateur de rapports V2 existe cÃ´tÃ© backend pour PDF, Word et Excel, en franÃ§ais et en anglais. Deux branches complÃ©mentaires ont Ã©tÃ© poussÃ©es :

- backend : `codex/report-v2-hardening`, PR #10 ;
- frontend : `codex/report-v2-ui`, PR #4.

Elles restent volontairement en brouillon. Aucune Ã©criture de production ni fusion n'a Ã©tÃ© dÃ©clenchÃ©e.

## 2. Modifications poussÃ©es

### Backend â€” PR #10

Fichiers modifiÃ©s :

- `server/routers.ts`
  - ajout d'un contrÃ´le de propriÃ©tÃ© avant l'appel Ã  l'ancien gÃ©nÃ©rateur PDF ;
  - un utilisateur authentifiÃ© ne peut plus exporter un audit appartenant Ã  un autre compte en devinant son identifiant.
- `server/report/excelRenderer.ts`
  - ajout de la preuve objective dans le registre des Ã©carts ;
  - ajout de la justification de criticitÃ© ;
  - extension du filtre Excel de 6 Ã  8 colonnes.

### Frontend â€” PR #4

Fichier modifiÃ© :

- `client/src/pages/ReportGeneration.tsx`
  - remplacement de l'appel Ã  l'ancien endpoint `reports.generate` par `reports.generateV2` ;
  - choix simple du format PDF, Word ou Excel ;
  - choix du franÃ§ais ou de l'anglais ;
  - suppression des options affichÃ©es qui n'Ã©taient pas rÃ©ellement exÃ©cutÃ©es par le gÃ©nÃ©rateur V2.

## 3. Dossiers et fichiers Ã  vÃ©rifier

### Backend â€” gÃ©nÃ©ration et cohÃ©rence

- `server/report/reportData.ts`
  - propriÃ©tÃ© de l'audit ;
  - score identique au tableau de bord ;
  - jointure des CAPA par `questionKey` ;
  - preuves objectives ;
  - historique et version du rapport.
- `server/report/pdfRenderer.ts`
  - page de garde, pied de page, confidentialitÃ© ;
  - sections 1 Ã  8 ;
  - registre des Ã©carts et CAPA ;
  - texte sur l'Ã©chantillonnage.
- `server/report/wordRenderer.ts`
  - structure identique au PDF ;
  - sommaire, en-tÃªte, pied de page et pagination ;
  - registre des Ã©carts et CAPA.
- `server/report/excelRenderer.ts`
  - onglets SynthÃ¨se, DÃ©tail Q-R, Registre Ã©carts, Plan CAPA, Index preuves ;
  - huit colonnes du registre des Ã©carts ;
  - filtres, volets figÃ©s et couleurs de criticitÃ©.
- `server/report/i18n.ts`
  - libellÃ©s franÃ§ais et anglais ;
  - absence de texte franÃ§ais rÃ©siduel dans un rapport anglais.
- `server/routers.ts`
  - autorisation `canExportReports` ;
  - propriÃ©tÃ© de l'audit sur l'ancien et le nouveau gÃ©nÃ©rateur ;
  - sauvegarde correcte de l'URL, de la rÃ©fÃ©rence, de la version, du statut et de la langue.
- `server/report-generator.ts`
  - chemin historique conservÃ© uniquement comme repli sÃ©curisÃ©.
- `drizzle/schema.ts` et `drizzle/00*.sql`
  - colonnes de `audit_reports` cohÃ©rentes avec les insertions du routeur.

### Frontend â€” parcours utilisateur

- `client/src/pages/ReportGeneration.tsx`
  - audit absent : bouton bloquÃ© et message simple ;
  - audit prÃ©sent : gÃ©nÃ©ration possible ;
  - choix des trois formats ;
  - choix des deux langues ;
  - ouverture du fichier puis navigation vers l'historique.
- `client/src/pages/Reports.tsx` et/ou `client/src/pages/ReportHistory.tsx`
  - prÃ©sence du rapport gÃ©nÃ©rÃ© ;
  - lien de tÃ©lÃ©chargement valide ;
  - affichage de la rÃ©fÃ©rence, version, langue et statut si ces champs sont exposÃ©s.
- `client/src/lib/trpc.ts`
  - type du endpoint `reports.generateV2` correctement propagÃ©.
- `client/src/App.tsx`
  - route de gÃ©nÃ©ration et route d'historique accessibles.

### Corpus et groupes divergents

- `scripts/corpus/questions-corpus.json`
  - aucune modification de `questionKey` ;
  - 24 titres validÃ©s ;
  - 45 reformulations validÃ©es ;
  - corrections rÃ©glementaires ISO 14971, FDA CAPA, ISO 9001 et bÃ©nÃ©fice-risque prÃ©sentes.
- `docs/corpus/divergent-groups-current.json`
  - diagnostic des 141 groupes.
- `docs/corpus/approved-retirements-lot-1.json`
  - huit retraits non destructifs validÃ©s.
- `docs/corpus/non-destructive-retirement-design.md`
  - conservation des rÃ©ponses, CAPA et rapports historiques.
- `docs/corpus/exact-duplicate-validation-lots.md`
  - lots 2 Ã  7 encore soumis au point de contrÃ´le A.
- `docs/corpus/criticality-divergence-validation.md`
  - 21 divergences de criticitÃ© Ã  confirmer avant changement.

## 4. Matrice complÃ¨te des tests de rapport

Tester le mÃªme audit comportant au minimum une rÃ©ponse conforme, partielle, non conforme, non applicable, une preuve et une CAPA.

| Test | Format | Langue | RÃ©sultat attendu |
|---|---|---|---|
| R1 | PDF | FranÃ§ais | fichier lisible, sections complÃ¨tes, chiffres cohÃ©rents |
| R2 | PDF | Anglais | mÃªmes chiffres que R1, libellÃ©s anglais |
| R3 | Word | FranÃ§ais | document Ã©ditable, sommaire et pagination |
| R4 | Word | Anglais | mÃªmes chiffres que R3, libellÃ©s anglais |
| R5 | Excel | FranÃ§ais | cinq onglets, filtres et huit colonnes du registre |
| R6 | Excel | Anglais | mÃªmes chiffres que R5, libellÃ©s anglais |

ContrÃ´les transverses pour R1 Ã  R6 :

- score global identique au tableau de bord ;
- mÃªmes nombres de conformes, partiels, non-conformes et non-applicables ;
- mÃªmes Ã©carts majeurs, mineurs et observations ;
- CAPA reliÃ©es au bon Ã©cart ;
- aucun texte inventÃ© pour une donnÃ©e absente : afficher Â« Non renseignÃ© Â» ou son Ã©quivalent anglais ;
- rapport visible dans l'historique et retÃ©lÃ©chargeable.

## 5. Tests de sÃ©curitÃ© obligatoires

1. Avec l'utilisateur A, gÃ©nÃ©rer un rapport pour un audit appartenant Ã  A : succÃ¨s attendu.
2. Avec l'utilisateur A, appeler l'ancien gÃ©nÃ©rateur avec l'identifiant d'un audit appartenant Ã  B : refus attendu.
3. RÃ©pÃ©ter avec `generateV2` : refus attendu.
4. VÃ©rifier que la liste et la lecture d'un rapport appartenant Ã  B sont refusÃ©es Ã  A.
5. VÃ©rifier que l'offre sans capacitÃ© d'export reÃ§oit un refus serveur, mÃªme si l'appel est fabriquÃ© manuellement.
6. VÃ©rifier que les chemins S3 sont isolÃ©s par identifiant utilisateur.

## 6. VÃ©rifications techniques automatisÃ©es

### Backend

Ã€ exÃ©cuter sur la branche `codex/report-v2-hardening` :

```text
npm ci
npm test
npm run build
```

### Frontend

Ã€ exÃ©cuter sur la branche `codex/report-v2-ui` :

```text
npm ci
npm test
npm run build
```

Le clonage local automatique a Ã©tÃ© tentÃ©, mais GitHub a refusÃ© l'accÃ¨s HTTPS aux dÃ©pÃ´ts privÃ©s depuis le terminal faute d'identifiants disponibles. La lecture et la publication via le connecteur GitHub ont fonctionnÃ©. Les compilations doivent donc Ãªtre exÃ©cutÃ©es par GitHub Actions ou dans un terminal authentifiÃ© avant fusion.

## 7. Ordre recommandÃ© de fusion et de dÃ©ploiement

1. ExÃ©cuter compilation et tests backend sur la PR #10.
2. Fusionner la PR backend #10.
3. VÃ©rifier le dÃ©ploiement Railway backend et l'absence d'erreur dans les journaux.
4. Tester au minimum un PDF V2 directement via l'interface/API.
5. ExÃ©cuter compilation et tests frontend sur la PR #4.
6. Fusionner la PR frontend #4.
7. VÃ©rifier le dÃ©ploiement frontend.
8. ExÃ©cuter R1 Ã  R6 et les tests de sÃ©curitÃ©.
9. Conserver les PR de corpus divergent sÃ©parÃ©es : ne pas mÃ©langer ce dÃ©ploiement avec la retraite non destructive des doublons.

## 8. CritÃ¨res GO / NO-GO

GO uniquement si :

- les deux compilations rÃ©ussissent ;
- les six fichiers s'ouvrent ;
- les chiffres sont identiques entre formats et tableau de bord ;
- les tests d'isolation utilisateur rÃ©ussissent ;
- l'historique permet le retÃ©lÃ©chargement ;
- Railway ne montre aucune erreur de migration, dÃ©marrage ou stockage.

NO-GO si un rapport d'un autre utilisateur est accessible, si un chiffre diffÃ¨re entre formats, si un fichier est vide/corrompu, si l'URL n'est pas enregistrÃ©e, ou si le dÃ©ploiement relance un import de corpus non demandÃ©.

## 9. Points restant volontairement ouverts

- validation manuelle des lots 2 Ã  7 des doublons exacts ;
- validation des 21 groupes Ã  criticitÃ© divergente ;
- mise en Å“uvre de la retraite non destructive aprÃ¨s validation du modÃ¨le de donnÃ©es ;
- alimentation rÃ©elle de la liste de diffusion, de l'agenda d'audit et des champs encore absents, sans fabriquer de valeurs ;
- dÃ©cision ultÃ©rieure sur la suppression de l'ancien gÃ©nÃ©rateur aprÃ¨s validation complÃ¨te du V2.


