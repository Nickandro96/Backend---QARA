# PROGRESS — IA réglementaire QARA (2 modes)

*Fichier d'état pour reprise autonome. Si la session est coupée, un simple
« continue » doit permettre de reprendre exactement où c'était arrêté —
lire ce fichier en premier, reprendre à la première tâche non cochée.*

## Cadrage (rappel, ne pas dévier)
- Séquence produit : (1) Onboarding ✅ FAIT — (2) **IA réglementaire ← ICI** —
  (3) Déploiement (plus tard, pas moi) — (4) Démo/business (après).
- **Ne PAS merger** `claude/qara-compliance-audit-qitbxl` vers `main`. **Ne PAS
  déployer.** L'ancienne version en ligne reste isolée.
- **Ne PAS toucher** onboarding/scoring/CAPA/rapport sauf strict besoin
  d'intégration (et documenter si c'est le cas).
- Reste concentré sur l'IA réglementaire uniquement. Toute autre amélioration
  repérée en cours de route : la noter ci-dessous dans « Idées notées, non
  traitées », pas la faire.

## Plan de travail

- [x] T1. Créer ce fichier avec la checklist complète.
- [x] T2. Backend : `server/assistant/assistant-router.ts`, endpoint
      `assistantUser` (contexte = 1 question du périmètre de l'audit +
      champs riches : auditVerifies, expectedEvidence, explanationSimple,
      concreteExample, conformityCriteria, article/annexe, officialSource,
      referenceStatus, typicalNc). Prompt système avec garde-fous
      (`server/assistant/promptBuilder.ts::buildUserModeSystemPrompt`,
      zéro-invention, citation systématique, assistant-pas-décideur,
      hors-périmètre, anti-prompt-injection). 9 tests unitaires
      (`promptBuilder.test.ts`) : garde-fous présents, champs injectés,
      champs absents rendus "non disponible" (pas omis). Vérifié en direct
      via curl : question hors périmètre référentiel → 404 ; sans
      ANTHROPIC_API_KEY → erreur claire (pas de crash).
- [x] T3. Backend : `assistantAuditor` (même fichier — infra partagée avec
      T2, contexte = résumé scoring recalculé serveur + écarts triés par
      priorité, enrichis avec article/officialSource/auditVerifies/aiPrompt,
      couverture croisée). Prompt système
      `buildAuditorModeSystemPrompt` (mêmes garde-fous + renvoi explicite
      vers le plan d'action CAPA plutôt que de s'y substituer). Vérifié en
      direct via curl sur un audit réel avec un écart enregistré.
- [ ] T4. Frontend : panneau chat mode utilisateur sur l'écran de question.
      Bouton « Aide-moi à répondre ».
- [ ] T5. Frontend : panneau chat mode auditeur sur le rapport/dashboard.
      Bouton « Analyser mes résultats ».
- [ ] T6. Garde-fous vérifiés en direct : tenter de faire inventer une clause
      hors corpus → l'assistant refuse et cite la source. Documenter le test.
      **Bloqué : nécessite une vraie clé ANTHROPIC_API_KEY, absente de cet
      environnement — à demander à l'utilisateur.**
- [ ] T7. Doc `docs/audit/13-ia-reglementaire.md` + repasser la suite E2E
      (aucune régression).

## Décisions à prendre / prises

- Fournisseur/modèle : Anthropic, `claude-sonnet-5`, via `@anthropic-ai/sdk`
  (installé, `package.json`). Clé lue depuis `ANTHROPIC_API_KEY` (non définie
  dans cet environnement de dev — nécessaire en production Railway, et pour
  la vérification live T6 ici).
- Garde-fous de coût appliqués : historique de conversation tronqué aux 12
  derniers messages envoyés au modèle (`MAX_HISTORY_MESSAGES`), message
  utilisateur plafonné à 4000 caractères, réponse plafonnée à 1024 tokens
  (`MAX_TOKENS`), écarts limités aux 15 premiers par priorité en mode
  auditeur (`MAX_GAPS_IN_CONTEXT`). Pas de garde-fou de rate-limiting
  inter-requêtes (nécessiterait une infra dédiée type Redis, hors périmètre
  de ce lot — noté ci-dessous).
- Champ "reference" du corpus (mission brief) : n'existe pas comme colonne
  DB dédiée — mappé sur `article`+`annexe` (colonnes réellement présentes,
  déjà utilisées ainsi par le scoring/rapport).

## Idées notées, non traitées

- Rate-limiting inter-requêtes (anti-abus au-delà du garde-fou par requête
  déjà en place) — nécessiterait une infra dédiée (Redis ou équivalent),
  hors périmètre.
- Vérification post-hoc automatisée que la réponse du modèle ne cite pas une
  référence absente du contexte fourni (aujourd'hui, seul le prompt système
  l'interdit — pas de contrôle programmatique après coup). Idée pour un lot
  futur si l'assistant est mis en production.

## PROCHAINE ÉTAPE

T2 et T3 (backend) faits et vérifiés en direct (hors appel LLM réel, faute
de clé). Prochaine étape : T4 — panneau chat mode utilisateur côté frontend
(MDRAuditDrilldown.tsx / ISOAuditDrilldown.tsx), bouton « Aide-moi à
répondre », appelle `assistant.assistantUser`.
