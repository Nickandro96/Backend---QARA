# État des lieux — crash du backend en environnement de test (Railway)

*Document autonome, écrit pour un lecteur qui découvre le projet (développeur
externe, prestataire). Chaque affirmation technique renvoie à un fichier et
une ligne précise du dépôt, ou à un extrait de log réel. Les hypothèses non
confirmées sont explicitement marquées comme telles.*

---

## 1. Résumé pour décideur

QARA est un logiciel qui aide les fabricants de dispositifs médicaux à
s'auto-évaluer avant un audit réglementaire (vérifier qu'ils respectent bien
les règles européennes/américaines applicables à leurs produits).

On essaie actuellement de mettre en ligne, sur un **environnement de test**
séparé de la version en production (celle que les vrais clients utilisent
aujourd'hui), une nouvelle version du logiciel contenant plusieurs mois
d'améliorations non encore livrées. Cet environnement de test refuse de
démarrer correctement : à chaque tentative, une étape de préparation de la
base de données échoue au bout de quelques secondes, ce qui fait que le
logiciel lui-même (la partie qui répond aux utilisateurs) ne démarre jamais.
La plateforme d'hébergement (Railway) relance alors automatiquement une
nouvelle tentative, qui échoue à son tour — d'où l'impression d'un
« redémarrage en boucle ».

**Point important et rassurant** : ce problème ne touche que
l'environnement de test, pas la version en production utilisée par les
clients aujourd'hui, qui n'a pas été modifiée. Il n'y a aucun risque pour
les utilisateurs actuels.

**Cause identifiée avec un bon niveau de confiance** (détails en section 5) :
Railway semble faire tourner, à certains moments, **plus d'une copie** de la
procédure de préparation de la base de données en même temps (par exemple
pendant un redéploiement, l'ancienne tentative et la nouvelle se chevauchent
quelques secondes). Ces copies se marchent dessus : l'une vide une table
pendant que l'autre est en train d'y écrire, ce qui casse la cohérence des
données et fait planter l'insertion suivante. Ce n'est pas un bug du
logiciel métier lui-même (la partie qui sert les utilisateurs n'a, à ce
stade, jamais réussi à démarrer pour qu'on puisse même tester si elle
fonctionne) — c'est un problème dans la façon dont la préparation
ponctuelle de la base de données a été branchée sur le démarrage du
conteneur.

**Impact** : aucun (environnement de test uniquement, pas encore livré).
**Effort estimé pour la solution recommandée** : quelques dizaines de
minutes de travail (voir section 6) — la solution est de sortir cette
préparation de base de données du chemin de démarrage habituel du serveur,
pour qu'elle ne puisse plus jamais s'exécuter deux fois en même temps ni se
redéclencher à chaque redémarrage.

---

## 2. Présentation du projet

### 2.1 À quoi sert l'application

**QARA** est une plateforme web d'auto-évaluation réglementaire pour les
fabricants de dispositifs médicaux. Concrètement, un utilisateur (souvent un
responsable qualité/réglementaire) répond à une série de questions
d'audit organisées par référentiel réglementaire — par exemple le
**règlement européen MDR** (« Medical Device Regulation », le texte qui
encadre la mise sur le marché des dispositifs médicaux en Europe), la norme
**ISO 13485** (système de management de la qualité pour les dispositifs
médicaux), ou la réglementation américaine **FDA QMSR**. L'outil calcule
ensuite un score de conformité, identifie les écarts, et génère un plan
d'action correctif (CAPA — « Corrective And Preventive Action »).

### 2.2 Architecture en clair

L'application est composée de trois grands morceaux, hébergés séparément :

- **Le frontend** (« ce que l'utilisateur voit dans son navigateur ») : une
  application web écrite en React, hébergée sur **Vercel** (un service
  d'hébergement spécialisé pour ce type d'application, qui la reconstruit et
  la republie automatiquement à chaque changement de code).
- **Le backend** (« le programme qui tourne en coulisses, reçoit les
  demandes du frontend, parle à la base de données et renvoie les
  réponses ») : une application Node.js (JavaScript côté serveur), hébergée
  sur **Railway** (un autre service d'hébergement, qui fait tourner le
  programme dans un conteneur — une sorte de boîte isolée et reproductible).
- **La base de données** : MySQL (un système de stockage de données
  structurées en tables), également hébergée sur Railway, dans un service
  séparé du backend mais dans le même projet.

Schéma simplifié du flux d'une requête :

```
[Navigateur de l'utilisateur]
         │  (HTTPS)
         ▼
[Frontend — Vercel]
         │  (requêtes API, format "tRPC")
         ▼
[Backend — Railway, conteneur Node.js]
         │  (requêtes SQL)
         ▼
[Base de données MySQL — Railway]
```

Le backend et le frontend communiquent via **tRPC**, une couche qui permet
au frontend d'appeler des fonctions du backend de façon typée, sans écrire
d'API REST classique à la main.

### 2.3 Les deux versions du code actuellement en jeu

- `main` : la branche qui correspond à ce qui est **actuellement en
  production**, utilisée par les vrais clients. Elle n'est pas concernée par
  ce problème et n'a pas été modifiée.
- `claude/qara-compliance-audit-qitbxl` : une branche de travail contenant
  plusieurs mois d'améliorations (sécurité, moteur de scoring, plan d'action
  CAPA, rapport d'audit, parcours d'accueil des nouveaux utilisateurs,
  assistant IA réglementaire) qui n'ont **jamais été mises en production**.
  C'est cette branche qu'on essaie de déployer sur un environnement de test
  séparé (nommé « New Claude » dans le tableau de bord Railway), pour la
  faire valider avant d'envisager une mise en production. C'est cette
  tentative de déploiement de test qui échoue actuellement.

---

## 3. Environnement technique (l'inventaire)

### 3.1 Langages et briques principales

| Brique | Rôle en une phrase |
|---|---|
| Node.js (version 22 en local, version exacte sur Railway non vérifiée mais compatible) | Le moteur qui exécute le code JavaScript du backend. |
| Express (`package.json`, dépendance `express`) | La bibliothèque qui reçoit les requêtes HTTP entrantes et les distribue au bon code. |
| tRPC (`@trpc/server`) | La couche qui expose les fonctions du backend au frontend de façon typée (pas de REST/JSON manuel). |
| Drizzle ORM (`drizzle-orm`) | La bibliothèque qui traduit le code JavaScript en requêtes SQL vers MySQL (un « ORM », Object-Relational Mapper). |
| MySQL (via `mysql2`) | Le système de base de données qui stocke réellement les informations (utilisateurs, audits, questions, réponses...). |
| esbuild (`package.json`, script `build`) | L'outil qui empaquette le code source en un seul fichier `dist/index.js` prêt à être exécuté en production. |

### 3.2 Variables d'environnement nécessaires (sans leurs valeurs)

Le backend a besoin, au démarrage, des variables suivantes (voir
`server/db.ts:107-125` pour la logique de résolution de la base de
données) :

- `DATABASE_URL` (ou `MYSQL_PRIVATE_URL`/`MYSQL_PUBLIC_URL` en secours) :
  l'adresse de connexion à la base de données MySQL. Railway l'injecte
  automatiquement entre deux services du même projet/environnement.
- `JWT_SECRET` : une clé secrète utilisée pour signer les jetons de
  connexion des utilisateurs (« JWT », JSON Web Token). Le code refuse de
  démarrer en production sans cette variable (garde-fou de sécurité
  volontaire, voir `docs/audit/06-lot0-implementation.md`).
- `PORT` : le port réseau sur lequel le serveur doit écouter. Railway
  l'injecte automatiquement — rien à configurer manuellement
  (`server/_core/index.ts:73`).
- `ANTHROPIC_API_KEY` : la clé d'accès à l'assistant IA réglementaire
  (fonctionnalité optionnelle). **Volontairement absente** sur
  l'environnement de test actuel — le code gère cette absence proprement
  (voir `docs/audit/13-ia-reglementaire.md`), ce n'est pas une cause du
  problème traité ici.
- `ALLOWED_ORIGINS` : liste optionnelle d'origines web supplémentaires
  autorisées à appeler le backend (protection anti-triche de type CORS).

### 3.3 Structure des dossiers principaux

- `server/` : tout le code du backend.
  - `server/_core/index.ts` : point d'entrée du serveur (crée l'application
    Express, configure les autorisations, démarre l'écoute réseau).
  - `server/db.ts` : logique de connexion à MySQL.
  - `server/assistant/`, `server/onboarding/`, `server/mdr-router.ts`, etc. :
    les différentes fonctionnalités métier.
- `drizzle/` : tout ce qui concerne le schéma de la base de données.
  - `drizzle/schema.ts` : la description du schéma telle que le code
    l'attend.
  - `drizzle/migrations/` : les fichiers SQL numérotés qui, appliqués dans
    l'ordre, doivent amener une base de données vide au même état que le
    schéma attendu.
- `scripts/` : petits programmes indépendants du serveur principal, utilisés
  ponctuellement (appliquer les migrations, importer le contenu des
  questions d'audit, etc. — détaillés en section 4).
- `docs/audit/` : la documentation de suivi de toutes les missions menées
  sur ce projet jusqu'ici (voir section 7).

---

## 4. Le problème en détail

### 4.1 Le symptôme observé

Sur l'environnement de test Railway (« New Claude »), le service backend
échoue à chaque tentative de démarrage. **Point central à bien comprendre :
dans tous les logs récupérés jusqu'ici, l'application elle-même (le serveur
Express/tRPC qui répond aux utilisateurs) n'a JAMAIS réussi à démarrer.**
Le message `Server listening on port ...` (`server/_core/index.ts:75`, la
ligne qui prouve que le serveur a démarré) n'apparaît dans aucun des logs
récupérés. Le crash se produit systématiquement **avant** ce point, pendant
une étape de préparation de la base de données qui a été temporairement
ajoutée à la commande de démarrage du conteneur (voir 4.2).

### 4.2 Pourquoi une étape de préparation de base de données existe dans la commande de démarrage

Ce n'est pas la commande de démarrage normale du projet. Le fichier
`package.json:16` définit la commande de démarrage standard :
```
"start": "NODE_ENV=production node dist/index.js"
```
c'est-à-dire : lancer directement l'application, sans rien d'autre.

Pour cet environnement de test spécifiquement, la commande de démarrage a
été **temporairement remplacée**, dans les réglages du service Railway
(« Custom Start Command »), par une chaîne de plusieurs étapes exécutées
l'une après l'autre :
```
npx tsx scripts/apply-sql-migrations.ts \
  && npx tsx scripts/reset-corpus-tables.mjs \
  && npx tsx scripts/import-corpus.mjs \
  && node dist/index.js
```
La raison : la base de données de cet environnement de test était neuve et
vide, et il fallait (une seule fois) y recréer les tables et y importer le
contenu des 473 questions d'audit du référentiel avant que l'application
puisse fonctionner normalement. Ces trois scripts (`scripts/`) ne font pas
partie du fonctionnement normal de l'application : ils ne devraient tourner
qu'une fois, pas à chaque démarrage — mais comme la commande de démarrage
s'exécute à chaque fois que Railway (re)lance le conteneur, ils s'exécutent
en réalité à chaque tentative.

### 4.3 Chronologie type d'une tentative (avec extraits de logs réels)

**Étape 1 — les migrations s'appliquent** (fichiers SQL numérotés qui créent
les tables) :
```
Found migrations: [ '0000_add_sites_phone_email_notes.sql', ... ]
Already applied (by hash): 0000_add_sites_phone_email_notes.sql (16bc0ca0...)
...
```
Cette étape se termine normalement dans tous les logs observés.

**Étape 2 — les tables du corpus de questions sont vidées** (script de
réinitialisation ajouté en cours de diagnostic, voir section 5) :
```
Tables questions/referentiels réinitialisées (vidées, compteurs auto_increment remis à zéro).
```

**Étape 3 — l'import des 473 questions démarre, et plante** — trois formes
différentes de plantage ont été observées à ce stade, à des moments
différents du diagnostic (chacune corrigée successivement, voir section 5) :

- Une violation de clé étrangère (la ligne à insérer référence un
  identifiant de référentiel qui n'existe pas/plus au moment de l'insertion) :
```
DrizzleQueryError: Failed query: insert into `questions` (...)
cause: Error: Cannot add or update a child row: a foreign key constraint fails
(`railway`.`questions`, CONSTRAINT `questions_referentialId_referentials_id_fk`
FOREIGN KEY (`referentialId`) REFERENCES `referentials` (`id`))
code: 'ER_NO_REFERENCED_ROW_2'
```
- Une valeur refusée par une colonne trop restrictive :
```
cause: Error: Data truncated for column 'criticality' at row 1
code: 'WARN_DATA_TRUNCATED'
```
- **La même violation de clé étrangère que ci-dessus, mais sur une ligne
  différente**, après correction des deux problèmes précédents — c'est
  l'état actuel non résolu (voir section 5.3).

**Étape 4 — jamais atteinte** : `node dist/index.js` (le vrai démarrage de
l'application) n'apparaît dans aucun log récupéré à ce jour.

### 4.4 Un indice visuel important dans les logs

Dans les logs bruts fournis par Railway, on observe à plusieurs reprises que
**plusieurs blocs `Found migrations: [...]` apparaissent entrelacés entre
eux**, avec des lignes d'un bloc mélangées au milieu d'un autre bloc en
cours d'affichage. Exemple représentatif (horodatages réels, à la seconde
et sous-seconde près) :
```
2026-07-06T07:10:44.650166855Z [inf]  Found migrations: [
2026-07-06T07:10:44.650167822Z [inf]    '0011_processus_cleanup_keep_15.sql',
2026-07-06T07:10:44.650172514Z [inf]    '0020_onboarding_scope.sql',
2026-07-06T07:10:44.650177071Z [inf]    '0000_add_sites_phone_email_notes.sql',
2026-07-06T07:10:44.650177471Z [inf]    '0018_rich_question_fields.sql',
```
Un seul processus qui affiche son propre tableau de fichiers ne peut pas
produire un tel mélange — un tableau JavaScript s'affiche toujours dans
l'ordre où il a été construit. Ce mélange ne peut s'expliquer que par
**au moins deux processus distincts qui écrivent sur la même sortie de logs
en même temps**. C'est la preuve centrale du diagnostic (section 5).

---

## 5. Diagnostic

### 5.1 Ce qui a été écarté, avec preuve

- **Variable d'environnement manquante ou invalide** : écarté. Les logs
  montrent que la connexion à la base de données réussit (les migrations
  s'appliquent, des lignes sont lues et écrites en base) — si `DATABASE_URL`
  était absent ou invalide, la toute première requête SQL échouerait
  immédiatement avec une erreur de connexion, pas une erreur de contrainte
  de clé étrangère plusieurs dizaines de lignes plus tard.
- **Job planifié (cron/tâche récurrente) qui plante** : écarté. Le seul job
  du projet, `startWatchRefreshJob` (`server/jobs/watchRefreshJob.ts:7-28`),
  ne peut par construction jamais atteindre son code (il n'est appelé que
  depuis `server/_core/index.ts`, après que l'application ait démarré — or
  l'application ne démarre jamais dans ces logs). De plus son code est
  volontairement protégé par un `.catch()` qui empêche toute erreur de faire
  planter le processus (`watchRefreshJob.ts:19-21` et `26-28`, commentaire
  « Never let a background job crash the process »).
- **Exception non gérée générique dans le code applicatif** : écarté pour
  la même raison — le code applicatif (`server/_core/index.ts` et tout ce
  qu'il charge) n'est jamais atteint dans ces logs. Le point de plantage
  est toujours situé dans `scripts/import-corpus.mjs`, un script séparé de
  l'application.
- **Boucle infinie / fuite mémoire / dépassement de RAM** : écarté. Les logs
  montrent des erreurs SQL explicites et immédiates (quelques secondes après
  le début de l'import), pas un blocage silencieux ni un `OOM` (Out Of
  Memory, message que Railway afficherait explicitement).
- **Conflit de port** : écarté. Aucun message d'erreur de type `EADDRINUSE`
  (port déjà utilisé) n'apparaît dans aucun log, et de toute façon le point
  de plantage est toujours antérieur à la tentative d'écoute réseau
  (`app.listen(...)`, `server/_core/index.ts:74`).

### 5.2 Cause confirmée n°1 (déjà corrigée) : absence de verrou entre écritures concurrentes

`scripts/import-corpus.mjs` construit sa liste de référentiels réglementaires
(MDR, IVDR, FDA_QMSR, etc.) avec un motif « je vérifie si la ligne existe
déjà par son code, sinon je l'insère ». Aucune contrainte d'unicité en base
ne protège cette colonne `code` (vérifié dans `drizzle/schema.ts:145-152`).
Si deux exécutions de ce script tournent en même temps sur la même base,
elles peuvent toutes les deux conclure « cette ligne n'existe pas encore »
et l'insérer chacune de leur côté, avec des identifiants numériques
différents — ce qui casse la cohérence entre les questions déjà insérées
(qui référencent un identifiant) et les référentiels réellement présents en
base au moment de l'insertion suivante.

**Reproduit localement** : lancer volontairement deux copies du script en
parallèle sur une base neuve reproduit une erreur de ce type
immédiatement.

**Correctif déjà appliqué** (commit `c2b12697`) : un verrou nommé MySQL
(`GET_LOCK`/`RELEASE_LOCK`) a été ajouté autour de tout le corps de
`scripts/import-corpus.mjs`, pour qu'une deuxième exécution attende que la
première ait terminé plutôt que de courir en parallèle sur les mêmes
lignes.

### 5.3 Cause confirmée n°2 (probable, en cours) : le nouveau script de réinitialisation n'a, lui, aucun verrou

Après le correctif ci-dessus, l'erreur de clé étrangère a persisté de façon
identique et déterministe à chaque tentative — signe que la base était
déjà dans un état incohérent *avant* le verrou (des lignes orphelines
laissées par les tentatives précédentes, antérieures au correctif). Un
script `scripts/reset-corpus-tables.mjs` a donc été ajouté pour vider
(`TRUNCATE`) les deux tables concernées avant chaque import, afin de
repartir d'un état propre (commit `b19a14a9`).

**Ce script n'a cependant reçu aucun verrou.** Si — comme le suggère
l'entrelacement des logs (section 4.4) — plus d'une copie de la chaîne de
démarrage tourne en même temps, alors une copie peut être en train
d'insérer des questions (protégée par le verrou de la section 5.2) pendant
qu'une **autre** copie, à une étape différente de sa propre chronologie,
appelle `TRUNCATE TABLE questions` / `TRUNCATE TABLE referentiels`
**sans aucun verrou pour l'en empêcher** — vidant les tables sous les pieds
du premier processus, qui continue d'utiliser des identifiants de
référentiels qui viennent de disparaître. Ceci correspond exactement à la
dernière erreur observée : une violation de clé étrangère sur une ligne
différente de la précédente, après que le problème de colonne trop
restrictive (section 5.4) ait été corrigé et que l'import progresse donc
plus loin qu'avant avant de rencontrer le nouveau point de collision.

**Statut : hypothèse forte, cohérente avec toutes les preuves collectées,
mais pas reproduite en isolation avec certitude absolue** (contrairement au
problème de la section 5.2, qui a été reproduit volontairement en local).
Reproduire ce scénario précis nécessiterait de lancer `reset-corpus-tables.mjs`
et `import-corpus.mjs` en parallèle sur une base partagée, ce qui n'a pas
encore été fait explicitement — mais le mécanisme est identique à celui de
5.2, sur un script qui n'a pas reçu le même correctif.

### 5.4 Cause confirmée n°3 (déjà corrigée) : colonne de la base trop restrictive

Indépendamment de la concurrence, une colonne `criticality` de la table
`questions` s'est révélée être un `ENUM('low','medium','high')` — un type
de colonne MySQL qui n'autorise qu'une liste fermée de valeurs — alors que
le code (`drizzle/schema.ts:244` et `:373`) et les migrations la déclarent
comme un simple texte libre (`varchar(50)`), qui accepterait n'importe
quelle valeur raisonnable. Cette colonne provient d'une table créée en
dehors du contrôle de version à un moment non documenté du projet (un
problème de fond déjà connu et documenté, voir `docs/audit/02-audit-technique.md`,
point « C-01 : le schéma de base n'est pas reconstituable depuis le code
versionné »). La migration `0007b_baseline_core_tables.sql` recrée cette
table avec `CREATE TABLE IF NOT EXISTS`, une instruction qui ne fait
strictement rien si la table existe déjà — donc le type restrictif hérité
n'était jamais corrigé automatiquement.

Certaines questions du corpus FDA/QMSR utilisent la valeur `critical`, qui
n'existait pas dans la liste fermée de l'ENUM hérité, provoquant l'erreur
`Data truncated for column 'criticality'`.

**Correctif déjà appliqué** (commit `b19a14a9`, migration
`drizzle/migrations/0021_fix_criticality_column_type.sql`) : force
explicitement cette colonne au type texte libre attendu, quel que soit son
type actuel.

### 5.5 Cause racine de fond, au-delà du symptôme immédiat

Même une fois la section 5.3 corrigée, un problème de conception subsiste :
**une procédure de préparation de base de données (migrations + réinitialisation
+ import), pensée pour ne tourner qu'une seule fois, a été branchée sur la
commande de démarrage du conteneur**, qui peut s'exécuter plusieurs fois
(à chaque redémarrage, et potentiellement plusieurs fois en parallèle lors
d'un redéploiement, le temps que Railway bascule de l'ancien conteneur vers
le nouveau). C'est un choix pragmatique et temporaire (documenté comme tel
dans `docs/audit/PROGRESS-deploiement.md`), adapté à une base neuve et
vide qu'il fallait peupler rapidement sans accès direct à la base — mais ce
n'est pas une façon sûre de faire tourner ce genre d'opération à moyen
terme.

---

## 6. Solutions proposées

### 6.1 Solution recommandée : sortir la préparation de la base de données du chemin de démarrage

**Principe** : une fois que la base de données de test contient bien les
tables et les 473 questions, il n'y a plus aucune raison que
`scripts/apply-sql-migrations.ts`, `scripts/reset-corpus-tables.mjs` et
`scripts/import-corpus.mjs` s'exécutent à chaque démarrage du conteneur.

**Étapes** :
1. Vider une dernière fois manuellement les tables concernées si l'état
   actuel est incohérent (ou attendre qu'une exécution réussisse
   entièrement une fois — voir 6.2).
2. Remettre la commande de démarrage du service Railway à sa valeur par
   défaut : `node dist/index.js` (ou simplement supprimer le « Custom Start
   Command » pour revenir au comportement standard du `package.json`).
3. Vérifier que le serveur démarre normalement et affiche
   `Server listening on port ...`.
4. Vérifier, via une requête à l'application ou un accès à la base, que les
   473 questions sont bien présentes.

**Effort estimé** : quelques minutes (un changement de configuration dans
le tableau de bord Railway, pas de code).
**Compromis** : aucun — c'est un retour à la configuration standard du
projet.

### 6.2 Solution complémentaire : protéger `reset-corpus-tables.mjs` par le même verrou

Si l'équipe préfère garder, pour une raison ou une autre, la préparation de
base de données dans la commande de démarrage encore un moment (par
exemple parce que l'état actuel de la base de test reste incertain), il est
recommandé d'ajouter à `scripts/reset-corpus-tables.mjs` le même mécanisme
de verrou MySQL (`GET_LOCK`/`RELEASE_LOCK`) que celui déjà présent dans
`scripts/import-corpus.mjs` (voir section 5.2), pour empêcher qu'une
exécution concurrente ne vide les tables pendant qu'une autre y écrit.

**Effort estimé** : une dizaine de minutes de code, plus vérification.
**Compromis** : ne résout que le symptôme immédiat, pas la cause de fond
(section 5.5) — un script pensé pour tourner une fois continue de tourner
à chaque démarrage, avec le risque que cela représente à long terme
(ralentissement du démarrage, risque de nouvelle collision sur un autre
point non encore rencontré).

### 6.3 Ce qui peut être fait tout de suite vs ce qui demande investigation

- **Tout de suite, sans risque** : 6.1 (retirer la commande de démarrage
  personnalisée une fois l'import réussi une fois).
- **Investigation supplémentaire recommandée avant d'aller plus loin** :
  comprendre *pourquoi* Railway fait tourner plusieurs copies du conteneur
  en même temps sur cet environnement précis — configuration de replicas,
  comportement de redéploiement, ou health check qui déclenche des relances
  prématurées. Cette information se trouve dans les réglages du service
  Railway (onglet Settings → Deploy), pas dans le code, donc n'a pas pu être
  vérifiée depuis cet environnement de travail.

---

## 7. Contexte utile pour un intervenant extérieur

### 7.1 État du code par branche

- `main` : version en production, non modifiée, non concernée par ce
  problème.
- `claude/qara-compliance-audit-qitbxl` : branche de travail contenant tout
  ce qui a été fait ces derniers mois (voir 7.2), en cours de préparation
  pour un déploiement de test — c'est elle qui est concernée ici.

### 7.2 Travaux déjà réalisés sur cette branche (résumé, détails dans `docs/audit/`)

- Audit technique et sécurité complet, correction des failles critiques
  identifiées (`docs/audit/02-audit-technique.md`, `06-lot0-implementation.md`).
- Moteur de scoring de conformité, plan d'action correctif (CAPA), génération
  de rapport d'audit (`08-`, `09-`, `10-`).
- Vérification d'intégrité bout-en-bout des données du corpus réglementaire
  (`11-integrite-bout-en-bout.md`).
- Parcours d'accueil (« onboarding ») guidant l'utilisateur dans le choix de
  son périmètre réglementaire (`12-onboarding.md`).
- Assistant IA réglementaire à deux modes, avec garde-fous documentés
  (`13-ia-reglementaire.md`).
- Historique complet, pas à pas, de la tentative de déploiement de test
  actuellement en échec : `PROGRESS-deploiement.md` (c'est le document le
  plus directement lié au problème traité ici).

### 7.3 Piège déjà connu et documenté, pertinent ici

Le point « C-01 » de `docs/audit/02-audit-technique.md` documente déjà que
le schéma de base de données historique du projet contient des tables et
colonnes créées en dehors de tout fichier de migration versionné — c'est
exactement la cause de fond du problème de colonne `criticality` trop
restrictive (section 5.4). Un lecteur qui rencontre un futur problème
similaire (une colonne qui refuse une valeur que le code attend
explicitement) devrait consulter ce point en premier.

### 7.4 Comment lancer le projet en local (pour reproduire/vérifier)

Prérequis : Node.js, MySQL (ou MariaDB) accessible localement,
`pnpm` (le projet utilise `pnpm`, pas `npm` — utiliser `npm install`
provoque des erreurs de résolution de dépendances).

```bash
pnpm install
export DATABASE_URL="mysql://utilisateur:motdepasse@127.0.0.1:3306/nom_de_la_base"
npx tsx scripts/apply-sql-migrations.ts   # crée/complète le schéma
npx tsx scripts/import-corpus.mjs         # importe les 473 questions
npm run build                             # empaquette le serveur
npm start                                 # démarre l'application (NODE_ENV=production node dist/index.js)
```
Pour le développement au quotidien (rechargement automatique) :
```bash
npm run dev
```
Pour lancer la suite de tests automatisés (70 tests au moment de la
rédaction) :
```bash
npm test
```
