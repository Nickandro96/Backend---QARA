# Corrections vers le GO commercial full — état d'exécution

## Corrigé dans le code

- Analytique : suppression des jeux de démonstration Paris/Lyon/Bordeaux/Munich/Boston et des constats factices.
- Analytique : suppression de la fabrication d'actions CAPA à partir des constats.
- Analytique : exports CSV, impression PDF et Pack DG JSON désormais actifs sur les données authentifiées.
- Garde de release frontend : `npm run verify:analytics` refuse les marqueurs de démonstration connus et vérifie les sources réelles.
- Gouvernance corpus : `npm run verify:corpus` compare les `questionKey` actives de production aux 473 clés versionnées et échoue si elles divergent.
- Sauvegarde : script `scripts/backup-production.ps1` avec transaction cohérente, contrôle de taille minimale, manifeste, SHA-256 et rétention.
- Hygiène locale : caches Corepack/NPM exclus de Git.

## Vérifications réussies

- Backend : 186 tests réussis, aucun échec.
- Frontend : syntaxe TSX de l'Analytique vérifiée.
- Frontend : garde anti-données-démo réussie.
- Corpus Git : 473 clés uniques, empreinte SHA-256 `49f996f03e3ed42b034e64636efd8ecfd4e7a2c8868d7b7f5afb82879fd853f2`.
- Script PowerShell de sauvegarde : syntaxe validée.

## Actions externes encore nécessaires

Ces éléments ne peuvent pas être honnêtement clôturés par une modification de code seule :

1. Déployer les changements frontend et backend.
2. Exécuter `npm run verify:corpus` dans Railway avec `DATABASE_URL` injectée, puis décider du sort des clés inattendues/manquantes.
3. Planifier `backup-production.ps1` quotidiennement sur un stockage chiffré distinct du service principal et raccorder l'échec du job à `infos@n3-conseil.com`.
4. Accumuler 14 manifestes valides et réaliser une nouvelle restauration isolée.
5. Rejouer audit → constat → CAPA → PDF sur les sept référentiels.
6. Obtenir trois PV de pilotes réels et plus de 95 % de réussite des parcours critiques.
7. Achever la période de 14 jours sans P0, suivie jusqu'au 19 octobre 2026.
8. Faire valider le corpus critique par des experts humains habilités.

## Décision actuelle

Les défauts produits immédiatement corrigeables sont traités dans les dépôts. Le GO full reste conditionné aux preuves externes et temporelles ci-dessus; un GO pilote encadré demeure possible.
