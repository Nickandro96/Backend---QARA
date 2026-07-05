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
- [x] T4. Frontend (`frontend-qara`) : composant réutilisable
      `client/src/components/AssistantChatPanel.tsx` (chat générique — même
      composant pour les 2 modes, seul `onSend` diffère). Intégré dans
      l'onglet existant « IA Copilot » de `MDRAuditDrilldown.tsx` (l'écran de
      question), en complément des suggestions statiques déjà présentes
      (non supprimées — ajout, pas remplacement). Vérifié en direct via
      Playwright piloté : panneau visible, message envoyé, erreur gracieuse
      affichée en l'absence de clé API (comportement attendu).
- [x] T5. Frontend : même composant intégré dans `MDRAuditReview.tsx` (écran
      de résultats après complétion — aucune page frontend dédiée
      "rapport/dashboard" Lot 4 n'existe encore, voir décision ci-dessous),
      bouton d'envoi sous le titre « Analyser mes résultats ». Vérifié en
      direct via Playwright piloté, même résultat que T4.
- [~] T6. Garde-fous — partiel, par choix explicite de l'utilisateur.
      L'utilisateur a refusé (à raison) de coller une clé API dans le chat :
      `ANTHROPIC_API_KEY` doit être configurée côté serveur (Railway), jamais
      saisie en dur ni collée en conversation. Fait à la place :
      - Refactor de `assistant-router.ts` pour injecter le client Anthropic
        (`callAssistant(systemPrompt, messages, client?)`), permettant de
        tester le câblage sans clé réelle.
      - `assistant-router.test.ts` (6 tests, client factice) : le modèle/
        max_tokens/prompt système sont transmis tels quels ; le prompt
        système (garde-fous) est TOUJOURS envoyé séparément du message
        utilisateur, jamais concaténé ni contournable par un message
        adversarial ("ignore tes instructions...") ; troncature de
        l'historique correcte ; erreur claire si réponse vide.
      - **Limite assumée et documentée** : un mock ne peut PAS prouver
        qu'un vrai modèle respecte les garde-fous du prompt système (c'est
        un comportement du modèle, pas du code testable). Ces tests
        vérifient uniquement que le code transmet fidèlement le contexte —
        pas que Claude refuse effectivement d'halluciner en pratique.
      - **Reste à faire dès qu'ANTHROPIC_API_KEY sera configurée** (par
        l'utilisateur, hors chat) : lancer l'app avec la clé réelle,
        ouvrir le panneau assistant sur une vraie question, tenter
        explicitement de le faire inventer une clause/référence absente du
        corpus, et vérifier qu'il refuse + cite la source réelle. Documenter
        le résultat dans `docs/audit/13-ia-reglementaire.md`.
- [x] T7. Doc `docs/audit/13-ia-reglementaire.md` + suite E2E complète
      (aucune régression) — fait avec T6 partiel assumé et documenté.

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
- Pas de page frontend "rapport/dashboard" consommant les Lots 2-4
  (scoring/CAPA/rapport) — `MDRAuditReview.tsx` utilise encore
  `mdr.getAuditDashboard` (un dashboard antérieur, non lié aux nouveaux
  moteurs). Construire cette page serait le pendant frontend du Lot 4,
  hors périmètre de la mission IA réglementaire. Le panneau auditeur a donc
  été ajouté sur `MDRAuditReview.tsx` (écran de résultats existant) plutôt
  que sur une page rapport qui n'existe pas encore — l'assistant
  `assistantAuditor` recalcule lui-même le scoring (Lot 2) côté serveur,
  donc cette intégration ne dépend d'aucune page Lot 4 manquante.

## Idées notées, non traitées

- Rate-limiting inter-requêtes (anti-abus au-delà du garde-fou par requête
  déjà en place) — nécessiterait une infra dédiée (Redis ou équivalent),
  hors périmètre.
- Vérification post-hoc automatisée que la réponse du modèle ne cite pas une
  référence absente du contexte fourni (aujourd'hui, seul le prompt système
  l'interdit — pas de contrôle programmatique après coup). Idée pour un lot
  futur si l'assistant est mis en production.

## PROCHAINE ÉTAPE

T2 à T5 faits et vérifiés (backend + frontend, hors appel LLM réel faute de
clé). Prochaine étape : T6 — demander à l'utilisateur une clé
ANTHROPIC_API_KEY pour la vérification live des garde-fous, puis T7 (doc
finale + E2E complète). Suite E2E Playwright en cours de vérification
(aucune régression attendue, chat panels vérifiés séparément).
