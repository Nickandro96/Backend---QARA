# QARA — MISSION GLOBALE AUTONOME : FINALISER LE PRODUIT
*Prompt maître pour Claude Code, travail en autonomie longue durée. Reçu et sauvegardé le
2026-08-04 (rédigé par l'utilisateur le 2026-07-27). Copie verbatim, pour survivre aux coupures
de session — voir `JOURNAL-MISSION.md` pour l'état d'avancement réel.*

---

## 0. NATURE DE CETTE MISSION
Tu vas travailler en **autonomie prolongée** sur l'ensemble des chantiers restants de QARA, sur plusieurs sessions successives. Ce document est ton **plan maître permanent** : tu le relis au début de chaque session, tu reprends là où le journal indique que tu t'es arrêté, tu avances sans attendre d'instruction pour les tâches autorisées en autonomie, et tu t'arrêtes UNIQUEMENT aux points de contrôle explicitement listés en §3.

**Objectif final :** un produit complet, cohérent, de niveau professionnel, prêt pour une phase de tests utilisateur — puis un rapport final récapitulatif.

---

## 1. GESTION DE LA CONTINUITÉ (reprise automatique entre sessions)
Les sessions ont une limite d'usage ; une nouvelle capacité se libère périodiquement (~5 h). Tu dois donc être **reprenable sans perte** à tout instant.

**Règles de continuité impératives :**
- Tiens un fichier **`JOURNAL-MISSION.md`** à la racine du backend, committé et poussé sur ta branche de travail **après chaque étape terminée** (pas à la fin — au fil de l'eau). Il contient : la tâche en cours, l'étape précise atteinte, ce qui est fait/testé/déployé, ce qui reste, et **la toute prochaine action à effectuer**.
- Structure chaque tâche en **petites étapes committables indépendamment**, pour qu'une coupure ne perde jamais plus que l'étape en cours.
- **Au démarrage de CHAQUE session** : lis `JOURNAL-MISSION.md`, identifie la dernière action validée, et reprends à l'action suivante — sans redemander le contexte, sans recommencer une tâche déjà faite. Un simple « continue » de l'utilisateur doit suffire.
- Si tu approches d'une limite de session en cours de tâche : termine proprement l'étape committable en cours, mets à jour le journal avec l'état exact et la prochaine action, commit+push, et signale clairement « session interrompue à l'étape X, reprise à l'étape Y ».
- Ne laisse jamais le dépôt dans un état non-buildable entre deux sessions.

---

## 2. TOPOLOGIE & RÈGLES PERMANENTES (jamais enfreintes)
| Élément | Valeur |
|---|---|
| Frontend prod | dépôt `Nickandro96/Frontend---QARA`, branche **`main`** → Vercel `frontend-qara.vercel.app` |
| Backend prod | dépôt `Nickandro96/Backend---QARA`, branche **`claude/qara-compliance-audit-qitbxl`** → Railway `backend-qara-new-claude.up.railway.app` |
| Base prod | MySQL **new-claude**, `turntable.proxy.rlwy.net:32678`, base `railway` |
| ⚠️ Base abandonnée | env `production`/`metro.proxy.rlwy.net` — NE JAMAIS cibler. Vérifier que le secret `DATABASE_URL` pointe bien vers new-claude avant toute migration. |
| IDs référentiels | **3-9** : MDR=3, IVDR=4, FDA_QMSR=5, MDSAP=6, ISO13485=7, ISO14971=8, ISO9001=9. **JAMAIS 1-7.** |
| Corpus | 473 questions, 15 processus |

**Règles absolues :**
1. Branches de travail issues des branches de prod. Tu peux merger/déployer le CODE toi-même (backend `qitbxl`, frontend `main`), backend avant frontend, en vérifiant le déploiement (Railway vert + `/trpc/iso.getStandards` répond ; Vercel Ready). **Jamais de push direct destructif, jamais de force-push.**
2. **AUCUNE donnée inventée.** Sur un outil de conformité, une exigence, une source ou une date fausse est une faute grave. Tout contenu réglementaire s'ancre sur le texte réel du référentiel et sur les champs réels de la base.
3. **Migrations additives uniquement.** JAMAIS de `DROP`/`DELETE`/`TRUNCATE` destructif. Toute écriture en base de production passe par un POINT DE CONTRÔLE (§3).
4. Démontré vs déclaré : prouve par le contenu (COUNT, fichier ouvert, test par le chemin réel de l'utilisateur), jamais par « exécuté sans erreur ». Reconfirme sur new-claude tout chiffre établi en local.
5. `questionKey` JAMAIS modifié (les `audit_responses` y sont rattachées).
6. Sécurité : aucun secret dans le code/commits ; clés API en variables d'environnement serveur.

---

## 3. POINTS DE CONTRÔLE — LES SEULS ARRÊTS AUTORISÉS
Tu travailles en autonomie SAUF sur ces deux catégories, où tu t'arrêtes et attends la validation explicite de l'utilisateur (qualiticien) :

**A. Validation de contenu réglementaire** — parce que l'utilisateur est le seul juge de la justesse réglementaire :
- Reformulations éditoriales de questions (par lots de 5-8, format d'ancrage réglementaire).
- Fusions/suppressions de questions (les 141 groupes divergents).
- Réécritures de criticité.
→ Tu PRÉPARES et PRÉSENTES pour validation ; tu n'écris en base qu'après accord explicite du lot.

**B. Écritures en base de PRODUCTION** — parce qu'une migration sur la mauvaise base est irréversible :
- Toute migration, tout `UPDATE`/`INSERT` sur new-claude.
→ Tu fournis le SQL prêt (blocs séparés, une instruction à la fois pour l'éditeur Railway) + les requêtes de vérification AVANT/APRÈS ; l'utilisateur prend la sauvegarde et exécute. Tu ne touches jamais la base prod directement.

**Tout le reste — construction de code, UI, générateurs, connecteurs, tests locaux, documentation, rangement de branches — se fait en AUTONOMIE COMPLÈTE, sans point d'arrêt.** Enchaîne les chantiers dans l'ordre du §4 sans attendre.

---

## 4. LES CHANTIERS À MENER (ordre de priorité)

### CHANTIER 1 — Qualité du corpus (fondation)
- **Passe éditoriale** : 45 questions restantes (ISO14971 25, FDA_QMSR 7, ISO9001 6, MDR 3, IVDR 3, MDSAP 1). Méthode : ancrage sur `title`/`expectedEvidence`/`conformityCriteria`/`officialSource` + texte réglementaire réel → reformulation en vraie sonde d'auditeur. **Point de contrôle A** (validation par lots).
- **141 groupes divergents** : classer et traiter — 25 Type 1 (fusion), 45 Type 2 (conserver, différencier les titres génériques), zone intermédiaire (proposer un tri), 21 criticités divergentes (corriger). **Point de contrôle A.**
- **Correctif moteur de score** : le comptage par `questionKey` double-compte les groupes ; corriger pour compter par question réellement posée. (Code → autonomie ; si migration → point de contrôle B.)
- **Robustesse import** : rendre la génération de `questionKey`/`questionText` déterministe et l'import réellement idempotent, pour qu'un réimport ne réintroduise pas troncatures ni doublons. (Autonomie.)

### CHANTIER 2 — Rapport d'audit opposable (livrable clé)
Niveau ISO 19011, en autonomie complète (c'est de la construction) :
- Structure : page de garde (emplacements logos QARA + client), sommaire, contexte + **déclaration d'échantillonnage**, profil réglementaire, synthèse exécutive (score + répartition + graphiques), résultats par processus, **registre des écarts en 3 temps** (exigence / preuve objective / énoncé d'écart, référence unique, criticité justifiée, gradation MDSAP quand applicable), plan CAPA, conclusion, annexes (Q/R complet, index des preuves), historique des versions.
- Traçabilité : en-tête/pied de page, référence, version, statut, « Page X sur Y ».
- Formats : **PDF + Word (.docx) + Excel (.xlsx)**, bilingue **FR/EN**.
- Brancher le module CAPA (`capa_actions`) au rapport (cohérence saisie ↔ rapport).
- Prouver par génération réelle sur un audit existant (contenu vérifié, chiffres cohérents avec le dashboard).

### CHANTIER 3 — Module veille réglementaire (différenciateur)
Architecture en autonomie, avec la **règle fondatrice : l'IA n'est JAMAIS source, elle analyse uniquement des documents réellement récupérés.**
- Inventaire des sources et de leur mode d'accès réel (API / RSS / rien) : EUR-Lex, Federal Register (API), MDCG, ANSM, Legifrance, SNITEM, FDA/CDRH, IMDRF, MDSAP, ISO/CEN, Health Canada, TGA, ANVISA, PMDA, MHRA, Swissmedic. **Livrer cet inventaire dans le journal.**
- Planificateur quotidien, ingestion + déduplication par identifiant officiel, analyse IA (résumé FR/EN, référentiels/processus impactés, nature d'impact, criticité, échéance) sur documents réels, traçabilité (source + identifiant officiel + lien), mode dégradé explicite si source indisponible.
- Personnalisation au profil de l'utilisateur, lien avec ses audits, gating par plan.
- Commence par 2-3 sources fiables et bien documentées (EUR-Lex, Federal Register, MDCG), puis étends. Couverture partielle documentée assumée.
- Clés API en variables d'environnement (**point de contrôle B** si un secret doit être ajouté côté prod).

### CHANTIER 4 — Complétude & expérience produit
- **Échantillonnage intelligent** des audits : tirage d'un panel de questions couvrant TOUT le périmètre des processus, paramétrable (rapide / approfondi / complet), reproductible (seed pour traçabilité). Conçois d'abord la stratégie, documente-la, puis implémente.
- **Étapes conditionnelles du wizard** par référentiel : classe de DM (MDR/IVDR), voie 510(k)/PMA (FDA), gradation MDSAP.
- **Bascule MDR sur le routeur générique** (étape H) : prouver la parité stricte (74 questions fabricant dont 62 socle, score 80,6 % inchangé) avant de retirer l'ancien routeur.
- **Revue UX/design** : cohérence visuelle de niveau premium sur l'ensemble des écrans, correction des warnings et incohérences résiduels.

### CHANTIER 5 — Robustesse, sécurité, rangement
- **Sauvegarde automatique** de la base (aujourd'hui inexistante) : proposer et mettre en place un mécanisme.
- **Rangement** : supprimer proprement l'environnement `production`/metro (élimine définitivement le piège `DATABASE_URL`) et les branches mortes (`master`, `qara-design-passation`, branches de travail fusionnées). Vérifier qu'aucune ne contient de travail unique avant suppression. **Point de contrôle B** pour toute suppression d'environnement/base.
- **Revue de sécurité** avant ouverture à des utilisateurs payants : gating serveur, fuite de données, rate limiting, validation des entrées.
- **Rapport de robustesse** : ce qui est prêt pour de vrais utilisateurs, ce qui reste à durcir.

---

## 5. RAPPORT FINAL
Quand tous les chantiers autorisés en autonomie sont terminés (les points de contrôle A/B ayant été franchis avec l'utilisateur au fur et à mesure), produis **`RAPPORT-FINAL.md`** :
- État de chaque chantier (fait / partiel / bloqué et pourquoi).
- Ce qui a été déployé en production vs ce qui attend validation.
- Liste des points de contrôle encore en attente de l'utilisateur.
- Plan de tests recommandé (parcours à vérifier, référentiel par référentiel).
- Risques résiduels et dettes connues.
- Recommandations pour la mise en marché.

---

## 6. DÉMARRAGE
1. Lis `JOURNAL-MISSION.md` s'il existe (reprise) ; sinon crée-le et commence le CHANTIER 1.
2. État immédiat connu : passe mécanique du corpus terminée (troncatures 46 %→10 %). Un lot ISO14971 de passe éditoriale a été présenté pour validation — reprends la passe éditoriale au point de contrôle A.
3. Avance en autonomie sur tout le reste, en t'arrêtant uniquement aux points de contrôle A (contenu réglementaire) et B (écriture base prod).
4. Committe et pousse le journal après chaque étape. Sois reprenable à tout instant.

**Rappel cardinal : autonomie totale sur la construction, arrêt systématique sur le contenu réglementaire et sur les écritures en base de production. Aucune donnée inventée. Ces deux garde-fous ne sont pas des freins — ils sont ce qui rend le produit crédible et sûr.**
