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

- [ ] T1. Créer ce fichier avec la checklist complète. *(en cours)*
- [ ] T2. Backend : `assistant-router.ts`, endpoint `assistantUser` (contexte
      = 1 question + champs riches). Prompt système avec garde-fous. Test
      unitaire (réponse fondée sur le corpus, refus si hors corpus).
- [ ] T3. Backend : endpoint `assistantAuditor` (contexte = résultats scoring
      + écarts). Test unitaire (priorisation des écarts, couverture croisée).
- [ ] T4. Frontend : panneau chat mode utilisateur sur l'écran de question.
      Bouton « Aide-moi à répondre ».
- [ ] T5. Frontend : panneau chat mode auditeur sur le rapport/dashboard.
      Bouton « Analyser mes résultats ».
- [ ] T6. Garde-fous vérifiés en direct : tenter de faire inventer une clause
      hors corpus → l'assistant refuse et cite la source. Documenter le test.
- [ ] T7. Doc `docs/audit/13-ia-reglementaire.md` + repasser la suite E2E
      (aucune régression).

## Décisions à prendre / prises

*(rien pour l'instant)*

## Idées notées, non traitées

*(rien pour l'instant)*

## PROCHAINE ÉTAPE

T1 en cours de finalisation (ce fichier). Ensuite : T2 — choisir le
fournisseur/SDK LLM à utiliser côté backend (variable d'environnement clé
API), avant d'écrire `assistant-router.ts`.
