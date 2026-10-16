# QARA — Check indépendant « GO commercial autonome »

**Date du contrôle :** 16 octobre 2026  
**Périmètre :** application publique, santé backend/base, tests automatisés, analytique, corpus réglementaire, versionnement, exploitation et stabilité.  
**Règle de décision :** un GO autonome exige que les parcours critiques fonctionnent sans intervention technique, que les versions déployées soient traçables, que les données réglementaires de production soient rapprochées de leur source et que les sauvegardes/stabilité disposent de preuves exploitables.

## 1. Verdict exécutif

**Verdict : GO commercial encadré / NO-GO commercial autonome à cet instant.**

QARA peut continuer à être présenté et utilisé avec un accompagnement opérationnel. Les contrôles réalisés ne révèlent aucun P0 actif et les services publics répondent correctement. En revanche, l'autonomie commerciale complète ne doit pas être déclarée tant que les trois réserves de preuve de la section 4 ne sont pas levées.

Ce verdict ne signifie pas que le produit est défaillant. Il signifie que la démonstration d'exploitabilité autonome n'est pas encore complète et reproductible.

## 2. Résultats vérifiés

| Domaine | Preuve du 16/10/2026 | Résultat |
|---|---|---|
| Frontend public | `https://frontend-qara.vercel.app` | HTTP 200, environ 527 ms |
| Backend public | `https://backend-qara-new-claude.up.railway.app/healthz` | HTTP 200, environ 365 ms |
| Base de données | Réponse du healthcheck | `database: connected` |
| Tests backend | Suite locale complète avec cache temporaire isolé | **186/186 réussis**, 0 échec |
| Analytique | `npm run verify:analytics` | Contrôle réussi : aucune donnée de démonstration connue, exports actifs |
| Corpus source | Vérificateur canonique | 473 questions ; SHA-256 `49f996f03e3ed42b034e64636efd8ecfd4e7a2c8868d7b7f5afb82879fd853f2` |
| Incidents P0 connus | Historique disponible du suivi | Aucun nouveau P0 signalé lors des contrôles des 6, 13 et 16 octobre |

## 3. Éléments déjà favorables au lancement

- Services frontend et backend disponibles publiquement.
- Connexion base de données opérationnelle.
- Cycle métier protégé par des tests couvrant notamment audit, clôture, CAPA, PDF, scoring, rôles, veille et références ISO.
- 186 tests backend réussis.
- Données factices connues retirées de l'Analytique locale ; exports CSV, PDF/impression et Pack DG contrôlés.
- Surveillance UptimeRobot frontend/backend mise en place et notification e-mail déjà éprouvée.
- Procédure d'incident et canal client définis.
- Exercice de restauration MySQL déjà réussi avec code 0, RTO mesuré à 2,22 minutes et comptages restaurés identiques sur les tables contrôlées.

## 4. Réserves empêchant le GO autonome sans réserve

### R1 — Derniers correctifs non versionnés et non prouvés en production

Le frontend contient encore des modifications locales sur `.gitignore`, `AnalyticsDashboard.tsx`, `package.json` et `scripts/`. Le backend contient également des scripts et rapports non commités. Une correction locale réussie n'est pas une preuve de version déployée.

**Critère de levée :** commits propres, push, déploiements réussis, puis nouvelle vérification publique des versions déployées.

### R2 — Corpus de production non rapproché du corpus canonique

Le contrôle a validé la source à **473 questions**, mais n'a pas pu interroger la production en l'absence de `DATABASE_URL` dans l'environnement local. Le statut produit par le vérificateur est `SOURCE_ONLY`. L'historique contient par ailleurs un comptage restauré de 485 questions : cet écart doit être expliqué (questions archivées, historiques ou surplus inattendu).

**Critère de levée :** exécuter le vérificateur dans Railway ou un environnement autorisé, obtenir `productionChecked: true`, zéro question canonique manquante et une justification des entrées supplémentaires.

### R3 — Période de stabilité autonome incomplètement démontrée

Le suivi automatique initial devait aller jusqu'au 19 octobre 2026. Il a été arrêté le 16 octobre à la demande du propriétaire. Les contrôles disponibles (6, 13 et 16 octobre) sont positifs, mais ne constituent pas une preuve quotidienne complète de 14 jours ni une mesure documentée de réussite supérieure à 95 % des parcours critiques.

**Critère de levée :** soit conserver le verdict encadré, soit documenter jusqu'au 19 octobre les statistiques UptimeRobot et trois exécutions clientes complètes audit → réponses → clôture → CAPA → PDF sans P0.

## 5. Décision recommandée

### Autorisé maintenant

- Démonstrations commerciales.
- Onboarding de clients pilotes ou early adopters accompagnés.
- Vente avec support renforcé et procédure d'escalade active.
- Collecte structurée de retours terrain.

### À ne pas annoncer encore

- « Exploitation totalement autonome ».
- « Corpus de production intégralement certifié » sans le rapprochement R2.
- « 14 jours continus validés » puisque la fenêtre a été interrompue avant son terme.

## 6. Chemin minimal vers le GO autonome

1. Commit, push et déployer les correctifs frontend/backend restants.
2. Vérifier les SHA effectivement déployés sur Vercel et Railway.
3. Exécuter `npm run verify:corpus` dans un environnement autorisé disposant de la connexion de production, sans afficher ni copier le secret.
4. Archiver la preuve d'une sauvegarde automatique récente, non vide, avec hash et test de restauration.
5. Archiver trois preuves distinctes de parcours complets audit → clôture → CAPA → PDF.
6. Refaire le présent check. Si les six points sont verts et qu'aucun P0 n'est ouvert, le verdict peut passer à **GO commercial autonome**.

## 7. Conclusion accessible à un décideur non technique

QARA fonctionne, répond en ligne et possède une base de tests solide. Le risque résiduel porte moins sur le logiciel lui-même que sur la preuve que la version corrigée, les données réglementaires et les opérations de secours sont exactement celles exploitées en production. Le lancement commercial encadré est pertinent dès maintenant. Le lancement autonome définitif nécessite encore une courte clôture documentaire et de déploiement, sans refonte produit.
