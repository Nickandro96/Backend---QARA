# Phase 5 — Proposition de refonte + intégration MDSAP

> **⏸ STOP.** Ce document est un livrable de proposition. Aucune implémentation (Phase 6) ne doit commencer avant validation explicite du scénario retenu.

Cette proposition s'appuie directement sur les constats des Phases 1 à 4 : une plateforme dont l'idée et une bonne partie de la mécanique métier (référentiels, moteur de classification, module de veille réglementaire) sont solides, mais dont la couche technique porte plusieurs défauts qui rendent le produit **actuellement inutilisable en l'état pour un usage réel au-delà d'une session** (C-06 : reconnexion impossible ; C-07 : l'UI ne reconnaît jamais une session valide) et **non défendable commercialement face à une cible réglementée** (mots de passe en clair, authentification contournable, backdoor codé en dur).

---

## 5.1 Vision produit cible

**Positionnement** : outil d'auto-évaluation et de préparation aux audits (audit blanc, gap analysis, suivi CAPA) pour PME MedTech, cabinets de conseil QARA, et responsables qualité — pas un ambition de "certifier" quoi que ce soit, mais de réduire drastiquement le temps de préparation et le risque de non-conformité avant un vrai audit d'organisme notifié ou d'autorité.

**Différenciateurs à construire (aucun n'est aujourd'hui réellement fonctionnel malgré une UI qui le laisse parfois croire — voir Phases 1-2)** :
- **Multi-référentiels croisés** : une réponse à une question alimente plusieurs référentiels quand la même exigence existe dans plusieurs textes (ex. gestion des risques ISO 14971 pertinente à la fois pour MDR, ISO 13485, MDSAP). Nécessite un modèle de données référentiel-agnostique (voir 5.3) — le modèle actuel ne le permet pas (MDR/ISO/FDA sont chacun câblés différemment, voir Phase 1 §3).
- **IA réglementaire fiable et sourcée** (RAG sur les textes officiels plutôt que génération libre) — aujourd'hui **totalement absente côté serveur** (le endpoint `trpc.ai.*` appelé par le frontend n'existe pas du tout, Phase 2 M-04/Phase 1 §4.2). À construire entièrement.
- **Génération de rapports d'audit "niveau organisme notifié"** — le générateur existe (`report-generator.ts`) mais est cassé à l'exécution (Phase 2, M-08) et la fonction de comparaison n'est pas implémentée.
- **Plan d'action CAPA intégré avec suivi** — les tables `findings`/`actions` existent en base mais **aucune route backend `findings`/`actions` n'existe** ; le frontend les appelle dans le vide (Phase 1 §4.2).

## 5.2 Intégration MDSAP (nouvelle capacité majeure)

Conception fidèle au MDSAP Audit Model tel que confirmé en Phase 4 (sources : FDA.gov, mdsap.global, synthèses de cabinets spécialisés recoupées — accès direct à certains PDF sources bloqué depuis cet environnement, à corriger avec un accès direct avant implémentation finale).

### Modèle de données proposé

```
mdsap_jurisdictions        (code, name)                         -- TGA, ANVISA, HC, MHLW/PMDA, FDA
mdsap_processes            (id, name, order)                    -- les 7 processus du modèle
mdsap_tasks                (id, processId, description, iso13485Clause)
mdsap_jurisdiction_requirements (taskId, jurisdictionId, additionalRequirementText)
mdsap_audits               (id, auditId FK -> audits, selectedJurisdictions json)
mdsap_nonconformities      (id, auditId, taskId, initialImpact enum(direct,indirect),
                             occurrence enum(first,repeat), escalationFactors json,
                             computedGrade int(1-6), displayedGrade int(1-5))
```

### Les 7 processus (confirmés Phase 4)
Management ; Device Marketing Authorization and Facility Registration ; Measurement, Analysis and Improvement ; Medical Device Adverse Events and Advisory Notices Reporting ; Design and Development ; Production and Service Controls ; Purchasing.

### Les 5 juridictions (confirmées Phase 4)
TGA (Australie), ANVISA (Brésil), Santé Canada, MHLW/PMDA (Japon), FDA (États-Unis) — chacune avec des exigences additionnelles par tâche (`mdsap_jurisdiction_requirements`), au-delà du tronc commun ISO 13485.

### Sélecteur de juridictions
L'utilisateur coche les marchés visés lors de la création de l'audit MDSAP → la checklist affichée ne montre que : le tronc commun ISO 13485 (toujours) + les exigences additionnelles des juridictions cochées. Implémentation : filtrage côté requête (`WHERE jurisdictionId IN (...)`), pas de duplication de contenu.

### Gradation des non-conformités (grades 1-5, distincte du système majeure/mineure ISO — confirmée Phase 4)
1. Score initial via matrice 2 axes : impact QMS (direct = clauses ISO 13485 6.4-8.5 ; indirect = clauses 4.1-6.3) × occurrence (première/répétée).
2. Escalade : +points si absence de procédure documentée, mise sur le marché d'un dispositif non conforme, ou récidive.
3. Grade final 1-6, affiché 1-5 (6 rabattu sur 5). Un grade ≥5 déclenche une alerte "intervention requise" dans l'UI.
4. Les grades ne sont pas recalculés après action corrective (traçabilité de l'état constaté à l'instant de l'audit) — reproduire cette règle explicitement pour rester fidèle au modèle réel.

### Estimation de durée d'audit
Le modèle MDSAP officiel dimensionne la durée d'audit selon le nombre d'employés, le nombre de sites, la complexité des processus couverts et le nombre de juridictions sélectionnées (barèmes détaillés à extraire du document *AU P0002 Audit Approach* v010 — accès direct à obtenir avant implémentation, non consulté intégralement dans cette session pour les valeurs exactes du barème). Prévoir un module de calcul dédié plutôt qu'une valeur codée en dur, sur le modèle des autres irrégularités déjà relevées (ex. `DEFAULT_REFERENTIAL_ID` codé en dur dans `import-mdr-questions.js`).

## 5.3 Architecture technique cible

| Sujet | Recommandation | Justification |
|---|---|---|
| **Auth** | JWT signés (`jose`, déjà une dépendance inutilisée) ou session store Redis, cookie httpOnly+Secure **correctement conditionné à l'environnement** (corrige M-12) | Corrige C-04/C-05/C-06 d'un coup ; `jose` est déjà installé, aucune nouvelle dépendance nécessaire |
| **Mots de passe** | `argon2` (préféré) ou `bcrypt` | Corrige C-03 ; argon2 est le choix recommandé actuel (OWASP) pour du hachage de mot de passe |
| **Transformer tRPC** | Retirer `superjson` du client, ou l'activer symétriquement des deux côtés | Corrige C-07 — choix technique trivial, mais **priorité absolue avant tout le reste**, y compris avant l'audit de sécurité, car il fausse actuellement toute observation de "ce qui marche" dans l'app |
| **Modèle de données** | Référentiel-agnostique : une table `referentials` (déjà là) + `requirements` (générique, remplace `questions` câblées par référentiel) + `requirement_crosswalk` (table de correspondance many-to-many entre exigences de référentiels différents, pour le "multi-référentiels croisés" de 5.1) | Permet d'ajouter MDSAP, IVDR, ISO 14971 sans nouveau code, seulement des données — corrige la disparité actuelle MDR (JSON fallback inexistant) vs ISO/FDA (table `questions` partagée) |
| **Multi-tenant** | Table `organisations` déjà présente : lui donner un rôle réel (aujourd'hui `userId` seul fait foi partout, `organisationId` n'isole rien) ; scoping par organisation + rôles (owner/member/viewer) | Nécessaire pour vendre à des cabinets de conseil QARA (plusieurs consultants, plusieurs clients) |
| **IA réglementaire** | RAG : ingestion des textes officiels (EUR-Lex MDR, ISO 13485/9001, 21 CFR 820/QMSR, guidances MDCG, companion document MDSAP) dans un store vectoriel, réponses **toujours accompagnées de la citation de la clause/l'article source** | Le module de veille réglementaire existant (`server/services/watch/`) est déjà une bonne base de collecte de sources à réutiliser plutôt que reconstruire |
| **Tests** | Tests unitaires sur chaque moteur de règles (classification, scoring, gradation MDSAP) dès l'écriture, tests E2E Playwright étendus à partir du socle déjà posé en Phase 3 (`frontend-qara/e2e/`) | Couverture actuelle ~0% hors veille réglementaire (Phase 2) |
| **CI/CD** | Un seul gestionnaire de paquets (pnpm), suppression des flags `TSC_COMPILE_ON_ERROR`/`ESLINT_NO_DEV_ERRORS`, pipeline qui fait tourner `npm test` + `playwright test` avant tout déploiement | Corrige M-02/M-05 ; empêche la régression silencieuse type C-07 de repartir en production sans être détectée |

## 5.4 Trois scénarios

### Scénario A — Correctif minimal
**Périmètre** : corriger uniquement C-01 à C-07 + M-12 (Lot 0 sécurité/fiabilité de `02-audit-technique.md`) sans toucher à l'architecture ni ajouter de fonctionnalité. Rendre l'existant réellement utilisable et sûr, tel quel.
**Effort estimé** : 4 à 5 jours (chiffrage détaillé en `02-audit-technique.md`).
**Risques** : le produit reste ensuite dans son état actuel — MDR/FDA fonctionnels une fois corrigés, ISO vide de contenu, pas de facturation, pas d'upload de preuves, pas d'IA, pas de MDSAP, dette de type (`AppRouter = any`) non résorbée. Ne répond pas à l'ambition commerciale du brief de mission (vendre à des PME MedTech avec une vraie valeur ajoutée face à Greenlight Guru/Qualio/Matrix/Scilife).
**Recommandation** : à faire **dans tous les cas**, quel que soit le scénario retenu ensuite — c'est un préalable, pas une alternative aux deux scénarios suivants.

### Scénario B — Refonte progressive (recommandé)
**Périmètre** : Scénario A, puis par lots successifs sans réécriture complète : (1) partage réel du type `AppRouter` entre les deux dépôts pour éliminer la classe entière de bugs "route fantôme" (M-04/M-05) ; (2) implémentation réelle de l'upload S3 + module `evidence` + réparation de `reports.generate`/`reports.compare` ; (3) modèle de données référentiel-agnostique (5.3) migré progressivement, en commençant par recâbler MDR sur le même mécanisme que ISO/FDA (aujourd'hui incohérent) ; (4) module MDSAP construit sur ce nouveau modèle une fois prêt ; (5) RAG réglementaire ; (6) facturation Stripe réelle.
**Effort estimé** : 8 à 14 semaines selon la profondeur retenue sur chaque lot (à affiner lot par lot une fois validé — voir roadmap ci-dessous pour un découpage indicatif).
**Risques** : plus long à livrer entièrement que le scénario A, mais chaque lot est livrable et démontrable indépendamment ; risque de dette technique résiduelle sur les parties non retouchées si le projet s'arrête en cours de route (acceptable, contrairement au scénario C).
**Recommandation** : **scénario recommandé.** Il permet de vendre/démontrer une progression continue, garde l'investissement déjà fait sur MDR/ISO/FDA/veille réglementaire (qui fonctionnent, une fois Lot 0 corrigé), et amortit le risque en le découpant en lots indépendamment livrables plutôt que de tout miser sur une réécriture longue.

### Scénario C — Refonte totale
**Périmètre** : nouveau projet, modèle de données référentiel-agnostique dès le départ, nouvelle stack d'authentification, RAG réglementaire dès le départ, MDSAP natif, tests dès le premier commit. L'existant (MDR/ISO/FDA/veille réglementaire) sert de spécification fonctionnelle et de source de contenu (questions, règles de classification) à réimporter dans le nouveau modèle, pas de code à reprendre tel quel.
**Effort estimé** : 4 à 6 mois pour retrouver un périmètre fonctionnel équivalent à l'existant (hors nouvelles fonctionnalités), avant même d'avoir ajouté de la valeur nouvelle.
**Risques** : le plus élevé des trois — perte de tout l'acquis (module de veille réglementaire notamment, seul module réellement testé et abouti aujourd'hui) pendant une longue période sans rien à démontrer commercialement ; risque classique de "second system syndrome".
**Recommandation** : à écarter sauf si un changement de stack imposé de l'extérieur (ex. contrainte d'hébergement, rachat de code, exigence d'un partenaire technique) rend le scénario B impraticable.

## Roadmap indicative (scénario B, priorisation MoSCoW)

| Lot | Contenu | Priorité | Effort indicatif |
|---|---|---|---|
| 0 | Sécurité/fiabilité critique (C-01 à C-07, M-12) | **Must** | 4-5j |
| 1 | Assainissement dépôt (doublons, artefacts Manus, SEO, lockfiles) | **Must** | 1-2j |
| 2 | Partage du type `AppRouter`, suppression des flags de build permissifs | **Must** | 1-2j |
| 3 | Upload de preuves réel (S3) + réparation des rapports PDF | **Should** | 2-3j |
| 4 | Contenu ISO 9001/13485 réellement importé (dépend de la refonte des questionnaires en cours en parallèle) | **Should** | selon refonte |
| 5 | Modèle de données référentiel-agnostique + recâblage MDR dessus | **Should** | 1-2 semaines |
| 6 | Module MDSAP (5.2), sur le nouveau modèle du lot 5 | **Could** (différenciateur majeur mais nouveau) | 3-4 semaines |
| 7 | RAG réglementaire sourcé | **Could** | 3-4 semaines |
| 8 | Facturation Stripe réelle | **Could** | 3-5j |
| 9 | i18n structurelle (M-10), responsive (M-11), accessibilité | **Won't (pour l'instant)** — à revisiter une fois le socle fonctionnel stabilisé | 1-2 semaines |

**Quick wins réalisables immédiatement sur l'existant, indépendamment du scénario retenu** : Lot 0 et Lot 1 ci-dessus (sécurité + assainissement) ne nécessitent aucune décision d'architecture et peuvent démarrer dès validation.

---

## Décision attendue

Merci de valider :
1. Le scénario retenu (A / B / C — **B recommandé**).
2. L'autorisation de démarrer le **Lot 0** (sécurité critique) en premier dans tous les cas.
3. Toute contrainte de calendrier/budget qui devrait faire évoluer le découpage en lots ci-dessus.

Je ne commence aucune implémentation (Phase 6) avant votre retour sur ces points.
