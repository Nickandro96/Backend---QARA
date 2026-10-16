# Synthèse direction — audit expert intégral QARA

## Décision

**NON au GO commercial large à ce jour. GO commercial contrôlé uniquement, sous surveillance et sans promesse de validation réglementaire.**

Score de confiance de cette décision : **91/100**. La décision est robuste car plusieurs seuils explicites du prompt ne sont matériellement pas atteints ou pas prouvés.

## Périmètre réellement couvert

- Inventaire source analysé : **473 questions / 473 identifiants uniques attendus**.
- Double revue : **473 revues structurelles simulées par deux grilles**, mais **0 validation humaine/licenciée**.
- Couples référentiel–processus inventoriés : **233**.
- Tests automatisés backend : **186 réussis, 0 échec**, couvrant notamment auth, isolation, audit, CAPA, scoring, PDF, veille et IA.
- Monitoring : deux moniteurs et alerte documentés dans le PV du 5 octobre 2026.
- Restauration : preuve antérieure d'une restauration avec RTO 2,22 min, RPO 10,06 min et comptes concordants sur six tables.
- Parcours live connectés : **non exécutés**, contrôleur UI indisponible; aucune conclusion live inventée.
- Builds locaux : non conclusifs, car les exécutables `esbuild` de `node_modules` référencent un ancien workspace hors périmètre. Ce défaut d'installation locale est classé P1 outillage et ne prouve pas un échec des builds déployés.

## Bloquants

1. **P0 couverture** : 473 questions dans la source contre 485 lignes observées dans la base restaurée; les 12 écarts ne sont pas rapprochés.
2. **P0 stabilité** : la fenêtre de 14 jours n'est pas achevée.
3. **P0 recette** : trois PV complets de trois organisations distinctes ne sont pas fournis dans cet espace de preuves.
4. **P0 sauvegarde industrialisée** : restauration ponctuelle prouvée, mais planification, rétention hors service, manifeste SHA-256 et alertes sur 14 jours non prouvés.
5. **P1 validation corpus** : l'analyse automatisée ne remplace pas deux experts humains par question.

## Indicateurs corpus

- Sans clause/référence : 0.
- Sans processus : 0.
- Sans preuve attendue : 0.
- Sans applicabilité explicite : 0.
- Lignes appartenant à un groupe de doublons exacts : 99.
- Source officielle ou statut de vérification insuffisant : 93.
- Formulations courtes/vagues détectées : 0.

## Proposition de valeur unique retenue

**QARA Evidence Graph** : un graphe explicable Exigence → Processus → Risque → Question → Preuve → Constat → CAPA → Efficacité → Indicateur → Revue de direction, complété d'un crosswalk multi-référentiels et d'un indice de confiance fondé sur la fraîcheur et la qualité des preuves.

## Prochaine décision possible

Le GO large devient signable seulement après fermeture des quatre P0, validation humaine du corpus critique et achèvement du journal de stabilité.
