# Phase 3 — Tests fonctionnels de bout en bout

## Méthode et environnement

Contrairement à une revue de code statique, cette phase a fait tourner l'application réellement :

- Base MySQL locale (MariaDB) reconstituée à partir des 19 migrations SQL versionnées du backend (`scripts/apply-sql-migrations.ts`, adapté localement pour désactiver le SSL forcé).
- Questionnaires MDR et FDA importés réellement (826 questions MDR via `scripts/import-mdr-questions.js`, corrigé localement d'un bug bloquant — voir M-01 — 223 questions FDA déjà présentes dans les migrations).
- Backend démarré (`tsx watch server/_core/index.ts`) et frontend démarré (`vite`), reliés en HTTP local.
- Suite Playwright ajoutée au dépôt frontend (`e2e/`), exécutée avec Chromium.

Aucune donnée de production n'a été touchée : tout ce qui suit a été exécuté sur cette instance locale, jetable.

**Accès non fournis** (voir la liste "Ce qui manque" en fin de document) : URL de l'API Railway réelle, compte de test réel, variables d'environnement réelles, accès à une base de staging. Cette phase n'a donc **pas pu valider le comportement de l'environnement Railway/Vercel réel** — uniquement le code tel qu'il est écrit, exécuté dans un environnement équivalent reconstitué localement. Toute divergence entre la configuration réelle de production et cette reconstitution (variables d'environnement, version de MySQL, données déjà présentes) pourrait changer certains résultats.

## Suite Playwright livrée (`frontend-qara/e2e/`)

| Fichier | Contenu | Résultat |
|---|---|---|
| `auth.spec.ts` | Inscription → connexion → déconnexion ; refus sur mauvais mot de passe ; absence de "mot de passe oublié" | ✅ 3/3 passent |
| `mdr-audit.spec.ts` | Création de site puis d'audit MDR jusqu'à l'affichage de questions réelles | ❌ échoue — **bloqué par C-07**, pas un défaut du test (voir plus bas) |
| `classification.spec.ts` | 5 cas de classification DM avec classe attendue connue (Annexe VIII MDR) | ✅ 5/5 passent |
| `transformer-bug.spec.ts` | Test dédié qui isole et prouve C-07 (session serveur valide jamais reconnue côté UI) | ❌ échoue **intentionnellement** — c'est la preuve du bug, pas un test cassé |
| `helpers.ts` | Utilitaire d'authentification de test (inscription + attente de cookie) | — |

**Bilan : 8/10 tests passent.** Les 2 échecs sont tous deux des conséquences directes et attendues du bug C-07 (voir `02-audit-technique.md`), documentées comme telles dans le code des tests eux-mêmes — ce ne sont pas des tests fragiles ou mal écrits, mais des preuves reproductibles d'un vrai bug. Cette suite doit servir de socle de non-régression : une fois C-07 corrigé, `mdr-audit.spec.ts` devrait se remettre à passer sans modification, et `transformer-bug.spec.ts` devrait au contraire échouer différemment (l'assertion de l'étape 1 resterait vraie, celle de l'étape 2 devrait alors réussir — il faudra alors le retirer ou l'inverser en test de non-régression positif).

Pour rejouer la suite : `cd frontend-qara && npx playwright test e2e/` (nécessite le backend et le frontend démarrés localement, `DATABASE_URL` pointée vers une base migrée, variable `client/.env.local` avec `VITE_API_URL=http://127.0.0.1:3001/trpc`).

## 1. Inscription / connexion / mot de passe oublié / déconnexion

- **Inscription** : ✅ fonctionne (mot de passe stocké en clair — C-03 — et connexion automatique après inscription).
- **Connexion d'un utilisateur déjà enregistré** : ❌ **cassée à 100%, reproduite systématiquement** — voir C-06. C'est une découverte de cette phase, invisible en lecture de code seule sans trace précise de l'erreur MySQL réelle.
- **Mot de passe oublié** : 🚧 **n'existe pas** — ni page frontend, ni route backend (recherche exhaustive : aucune occurrence de "forgot"/"oublié"/"resetPassword" dans les deux dépôts).
- **Déconnexion** : le mécanisme (`auth.logout`) existe et invalide le cookie côté serveur ; son effet sur l'UI dépend cependant du même mécanisme `useAuth()` affecté par C-07 — non testé isolément au-delà de l'appel API lui-même, qui fonctionne.
- **État de connexion affiché dans l'UI** : ❌ **cassé de façon quasi-généralisée** — voir C-07. Même une session serveur parfaitement valide n'est jamais reflétée dans l'interface React.

## 2. Audits multi-référentiels (MDR, ISO 13485, ISO 9001, FDA)

- **MDR** : le contenu (826 questions, 15 processus) est réellement présent et cohérent une fois importé — mais **le script d'import officiel du dépôt ne fonctionne pas tel quel** (M-01, deux bugs cumulés) et **aucune donnée MDR n'existe dans une base fraîchement migrée** (ni ligne `referentiels`, ni question) : le contenu MDR n'est donc pas reproductible depuis le dépôt seul, contrairement à FDA. Le parcours de création d'audit MDR jusqu'à l'affichage des questions n'a **pas pu être validé de bout en bout** à cause de C-07 (la page affiche "Authentification requise" malgré une session valide).
- **ISO 13485 / ISO 9001** : **0 question en base**, y compris après tentative d'import via les scripts fournis. Sur 5 scripts liés à l'import ISO (`import_iso_questions_from_excel.py`, `import_questions_from_excel.py`, `import_iso_update.py`, `patch_iso_risks_from_excel.py`, `patch_iso_risks_from_excel_v2.py`), un est syntaxiquement invalide (`IndentationError` à l'analyse Python, ne peut littéralement pas s'exécuter — `import_iso_questions_from_excel.py:527`), et les autres sont conçus pour des en-têtes Excel MDR, pas ISO. **Aucun chemin d'import ISO fonctionnel n'a été trouvé dans le dépôt.** Le référentiel ISO le plus mis en avant commercialement (ISO 13485, cœur de cible MedTech) est donc, en l'état du dépôt, **vide de tout contenu testable**. Ceci constitue un signal d'alarme supplémentaire à ajouter à l'inventaire (à traiter comme 🚧 non-fonctionnel faute de contenu, indépendamment de la question de savoir si le code applicatif lui-même fonctionnerait avec des données).
- **FDA (QMSR / 21 CFR Part 820 + US Market Access)** : 223 questions présentes nativement dans les migrations versionnées — c'est le seul référentiel entièrement reproductible depuis le dépôt sans intervention manuelle.
- **Sauvegarde/reprise** : un hook `useAutoSave.ts` existe côté frontend ; son bon fonctionnement n'a pas pu être validé en conditions réelles à cause du blocage C-07 en amont.
- **Scoring, génération de rapport** : non testés en direct (bloqués en amont par C-07 pour l'UI ; `reports.generate` est de toute façon connu cassé à l'exécution — voir M-08 dans `02-audit-technique.md`, destructuration d'un retour `undefined` de l'upload S3 stub).

## 3. Module de classification DM (UE et FDA)

Testé **au niveau API directement** (via `fetch` brut, contournant le bug C-07 et l'assemblage fragile du wizard multi-étapes de `Classification.tsx`), avec 5 cas dont la classe MDR attendue est connue :

| Cas | Entrée | Classe attendue | Classe obtenue |
|---|---|---|---|
| Dispositif non invasif simple, aucune fonction spéciale | `invasiveness: non-invasif`, pas de logiciel, pas actif | I (défaut, Règle 1) | ✅ I |
| Logiciel d'aide à la décision clinique, impact non critique | `is_software: true`, `danger_level: normal` | IIa (Règle 11) | ✅ IIa |
| Logiciel pouvant causer un préjudice grave | `is_software: true`, `danger_level: potentiellement_dangereux` | IIb (Règle 11) | ✅ IIb |
| Dispositif implantable | `implantable: true`, invasif chirurgical | IIb minimum (Règle 8) | ✅ IIb |
| Contact avec le système nerveux central | idem + `contact_nervous_system: true` | III (Règle 8) | ✅ III |

**Les 5 cas correspondent au comportement attendu du moteur de règles tel qu'implémenté.** Ceci valide que la **logique interne** de `classification-router.ts` est cohérente avec elle-même et avec sa propre lecture de l'Annexe VIII citée en commentaire. **Cela ne valide pas encore l'exactitude réglementaire absolue de cette lecture face au texte officiel du règlement (UE) 2017/745** — ce travail de vérification croisée avec le texte réglementaire et les guidances MDCG est traité dans `04-contenu-reglementaire.md`. Aucun cas de classification FDA (510(k)/De Novo/PMA) n'a été testé dans cette phase — le module FDA existant est un module de *qualification* réglementaire (rôle économique), pas un classificateur de risque FDA à proprement parler ; à vérifier plus avant si un tel module est attendu.

## 4. IA réglementaire

**Non testable en l'état** : `AIChatBox.tsx` appelle `trpc.ai.*`, un namespace qui n'existe pas du tout côté serveur (confirmé en Phase 1/2 par recherche exhaustive dans `server/routers.ts` et tous les routeurs montés). Il n'y a donc littéralement aucune IA réglementaire fonctionnelle à tester : ni pertinence des réponses, ni gestion d'erreur, ni hallucinations, ni coût par requête ne peuvent être évalués puisque le endpoint appelé n'existe pas. C'est un écart entre la promesse produit ("IA réglementaire intégrée", mentionnée dans le contexte de mission) et la réalité du code : **fonctionnalité entièrement absente côté serveur**, malgré une UI qui laisse croire le contraire.

## 5. Exports, notifications, multi-utilisateurs/organisations

- **Export PDF de rapport d'audit** : ❌ cassé à l'exécution (voir M-08 — `reports.generate` déstructure `{url}` d'un retour `undefined`, puis utilise `.returning()` non supporté par le driver MySQL utilisé).
- **Export Excel/CSV** (Analytics, Documents) : boutons présents mais TODO explicites dans le code (`AnalyticsDashboard.tsx`) — non implémentés.
- **Notifications** : `system.notifyOwner` existe côté serveur (admin uniquement) mais n'est appelé par aucune page frontend trouvée — fonctionnalité orpheline, pas de notifications utilisateur visibles identifiées.
- **Multi-organisations/sites** : les tables et endpoints existent et sont correctement scopés par utilisateur (voir audit IDOR en Phase 2), mais aucune isolation au niveau "organisation" à proprement parler (un utilisateur voit toutes ses données par `userId`, l'appartenance à une organisation ne restreint/n'élargit rien) — pas de vrai modèle multi-tenant au sens "plusieurs utilisateurs d'une même organisation partagent des audits", à confirmer si c'est un besoin produit attendu.

## 6. Cas limites

- **Données vides** : testé involontairement mais de façon significative — le référentiel ISO 13485/9001 est **réellement vide** dans une instance fraîchement provisionnée (voir §2), ce qui constitue un cas limite bien réel et non un artefact de test. Le comportement de l'UI face à 0 question n'a pas pu être observé à cause du blocage C-07 en amont du wizard.
- **Caractères spéciaux** : les emails de test contiennent des caractères spéciaux (`@`, tirets) sans souci particulier constaté au niveau de l'inscription/la base de données ; pas de test poussé sur l'injection de caractères spéciaux dans les champs de réponse d'audit (hors périmètre temporel de cette phase).
- **Sessions expirées en cours d'audit** : non testé directement, mais **C-06 en est une variante aggravée** : même une reconnexion volontaire (pas seulement une expiration) échoue systématiquement pour un compte existant.
- **Double soumission** : non testé de façon isolée dans cette phase (aucun bouton de soumission observé sans état `disabled`/`isPending` pendant les mutations en cours, ce qui est plutôt bon signe par lecture de code — à confirmer par un test dédié si cette phase est reconduite après correction de C-07).

## Ce qui manque pour aller plus loin

1. **URL de l'API Railway réelle + compte de test réel** — pour confirmer si C-06/C-07 sont bien présents en production telle que déployée (très probable, ce sont des bugs de code, pas d'environnement, mais la configuration réelle des variables d'environnement Railway pourrait théoriquement changer un détail).
2. **Contenu Excel ISO 9001/13485 déjà nettoyé/prêt à l'import**, ou confirmation qu'aucun import ISO n'a jamais réellement été fait en production non plus.
3. **Une fois C-07 corrigé** (correctif d'une ligne, effort minime — voir `02-audit-technique.md`), il sera nécessaire de **rejouer entièrement cette phase 3** : une bonne partie des parcours qui n'ont pas pu être validés ici (sauvegarde/reprise d'audit, scoring, wizard MDR complet) pourraient en réalité fonctionner correctement une fois l'UI capable de voir une session authentifiée — ou révéler de nouveaux bugs jusqu'ici masqués par ce blocage systématique.
