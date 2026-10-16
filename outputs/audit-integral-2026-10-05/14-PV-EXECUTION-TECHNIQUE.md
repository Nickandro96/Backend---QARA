# PV d'exécution technique

Date : 5 octobre 2026

## Tests backend

Commande : `npm test`

- tests : 186 ;
- réussis : 186 ;
- échecs : 0 ;
- annulés : 0 ;
- ignorés : 0 ;
- durée : 42,5 secondes.

Les tests couvrent notamment : récupération de mot de passe, garde-fous IA, isolation propriétaire/tiers, cycle de vie audit, CAPA, classification, onboarding, droits par plan, non-exposition de `passwordHash`, génération et pagination PDF, scoring, agrégats, veille réglementaire, stockage S3 et références ISO historiques.

Les messages `completion failed` observés pendant la suite correspondent à des cas négatifs attendus et assertés (audit tiers, incomplet ou déjà clôturé). Le résumé final est vert.

## Builds locaux

Les commandes `npm run build` frontend et backend ont échoué avant compilation fonctionnelle. Les lanceurs `esbuild` installés dans `node_modules` référencent un ancien workspace situé hors du périmètre actuel, ce qui provoque `Access is denied` et des résolutions de chemin erronées.

Conclusion : **environnement local non reproductible en l'état**. Ce résultat ne prouve ni un défaut du code source ni un succès des builds de production. Refaire une installation propre et verrouillée des dépendances dans un environnement CI isolé, puis archiver les journaux de build.

## Session connectée

Le contrôleur UI a échoué à l'initialisation avec `failed to write kernel assets: Le chemin d’accès spécifié est introuvable`. Aucun clic, aucune saisie, aucun secret et aucune donnée de production n'ont été manipulés. Les parcours live sont donc marqués non exécutés.

## Contrôles HTTP publics

Le connecteur web n'a pas pu accéder aux URL de production lors de cette exécution. Le dossier s'appuie donc sur le PV monitoring daté du même jour, qui documente deux moniteurs UP et une alerte reçue, sans transformer cette preuve historique en mesure instantanée.
