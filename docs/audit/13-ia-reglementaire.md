# IA réglementaire QARA — assistant à deux modes

*Périmètre : backend---qara (moteur de prompts + routeur) et frontend---qara
(panneau chat réutilisable, intégré à deux endroits). Voir aussi
`docs/audit/PROGRESS-ia-reglementaire.md` pour le suivi tâche par tâche.*

## Ce qui est fait

### Backend
- `server/assistant/types.ts` — types du contexte injecté dans les prompts
  (`QuestionAssistantContext` pour le mode utilisateur, `AuditorGapContext`/
  `AuditorScoringSummary` pour le mode auditeur).
- `server/assistant/promptBuilder.ts` — construction pure des deux prompts
  système. 9 tests unitaires.
- `server/assistant/assistant-router.ts` — routeur tRPC :
  - `assistantUser` : contexte = une question du périmètre de l'audit
    courant (vérifié en base, 404 sinon) + ses champs riches du corpus.
  - `assistantAuditor` : contexte = résumé chiffré du scoring (recalculé
    côté serveur, Lot 2) + écarts triés par priorité (réutilise
    `sortByPriority` du Lot 3), enrichis des champs riches et de la
    couverture croisée.
  - Les deux appellent Anthropic (`claude-sonnet-5`) via `@anthropic-ai/sdk`,
    clé lue depuis `ANTHROPIC_API_KEY` (variable d'environnement serveur,
    jamais en dur).
- `server/assistant/assistant-router.test.ts` — 6 tests avec un client
  Anthropic factice injecté (voir §Garde-fous ci-dessous pour ce que ces
  tests prouvent et ne prouvent pas).

### Frontend
- `client/src/components/AssistantChatPanel.tsx` — panneau de chat générique
  réutilisable (liste de messages, saisie, envoi, état de chargement/erreur).
- Mode utilisateur : intégré dans l'onglet existant « IA Copilot » de
  `MDRAuditDrilldown.tsx` (l'écran de question), en complément des
  suggestions statiques déjà présentes (conservées, pas remplacées).
- Mode auditeur : intégré dans `MDRAuditReview.tsx` (écran de résultats
  après complétion de l'audit) sous un titre « Analyser mes résultats ».

## Les deux modes

**Mode utilisateur** (« aide-moi à répondre ») : l'utilisateur est sur une
question d'audit et bloque. L'assistant reformule l'exigence en langage
simple, explique ce qu'un auditeur vérifierait et quelles preuves fournir,
peut aider à s'auto-évaluer sans jamais décider à sa place, et cite la
source officielle.

**Mode auditeur** (« analyse mes résultats ») : après un audit scoré,
l'assistant joue un auditeur senior qui débriefe — priorise les écarts,
explique le risque concret en audit externe, propose des pistes de
remédiation sans se substituer au plan d'action CAPA, et met en avant la
couverture croisée entre référentiels.

## Garde-fous

Les garde-fous sont encodés directement dans le texte du prompt système
(`promptBuilder.ts`), communs aux deux modes :
1. Zéro invention — n'utiliser que le contexte fourni, jamais la
   connaissance générale du modèle ; dire explicitement quand une
   information n'est pas disponible.
2. Citation systématique (article/annexe + source officielle) quand une
   exigence est affirmée.
3. Assistant, pas décideur — ne jamais déclarer une réponse "conforme"/
   "non conforme" à la place de l'utilisateur.
4. Périmètre strict qualité/réglementaire dispositifs médicaux ; refus poli
   du hors-périmètre.
5. Rappel que l'outil ne remplace pas un professionnel qualité ni un audit
   de certification.
6. Résistance explicite aux tentatives de contournement ("ignore tes
   instructions...").

**Ce qui est vérifié par le code (tests automatisés)** :
- `promptBuilder.test.ts` (9 tests) : les 6 règles ci-dessus sont bien
  présentes dans le texte du prompt système généré ; tous les champs du
  corpus fournis sont injectés ; un champ absent est rendu explicitement
  "non disponible" plutôt que silencieusement omis (empêche le modèle de
  deviner sans le signaler) ; la couverture croisée n'apparaît que si des
  référentiels sont réellement impactés ; le mode auditeur renvoie
  explicitement vers le plan d'action CAPA plutôt que de s'y substituer.
- `assistant-router.test.ts` (6 tests, client Anthropic factice injecté) :
  le modèle/max_tokens/prompt système sont transmis tels quels à l'API ; le
  prompt système est **toujours** envoyé dans le champ `system` séparé,
  jamais concaténé au message utilisateur ni contournable par un message
  adversarial ; l'historique est correctement tronqué ; une réponse vide/
  inattendue lève une erreur claire plutôt que de planter silencieusement.

**Ce qui N'EST PAS vérifiable par du code, et reste à faire dès qu'une clé
API réelle sera configurée** (décision explicite de l'utilisateur : la clé
`ANTHROPIC_API_KEY` doit être configurée côté serveur en production, jamais
collée dans le chat — voir `PROGRESS-ia-reglementaire.md`, T6) :
- Est-ce qu'un vrai modèle, face à une tentative délibérée de le faire
  inventer une clause/référence absente du corpus, refuse effectivement et
  cite la source réelle ? Un mock ne peut pas répondre à cette question — la
  résistance aux garde-fous du prompt système est un comportement du
  modèle, pas du code. Ce test reste à faire manuellement (ouvrir le
  panneau assistant sur une vraie question, poser une question hors
  périmètre ou demander explicitement une clause inventée, observer la
  réponse) une fois la clé configurée, et à documenter ici.

## Garde-fous de coût / anti-boucle

- Historique de conversation tronqué aux 12 derniers messages envoyés au
  modèle (le client garde l'historique complet pour l'affichage).
- Message utilisateur plafonné à 4000 caractères (validation Zod).
- Réponse plafonnée à 1024 tokens.
- Écarts limités aux 15 premiers par priorité en mode auditeur (évite un
  contexte auditeur illimité sur un audit à plusieurs centaines de
  questions).
- Pas de rate-limiting inter-requêtes (nécessiterait une infra dédiée type
  Redis, hors périmètre de ce lot — noté comme piste future).

## Écarts documentés par rapport à la mission

- **Champ "reference"** : n'existe pas comme colonne DB dédiée dans le
  corpus — mappé sur `article`+`annexe` (colonnes réellement présentes,
  déjà utilisées ainsi par le moteur de scoring et le rapport d'audit,
  Lots 2 et 4).
- **Mode auditeur intégré sur l'écran de résultats existant, pas un
  "rapport" dédié** : `MDRAuditReview.tsx` (basé sur `mdr.getAuditDashboard`,
  un dashboard antérieur) est la seule page frontend de résultats
  existante — aucune page frontend ne consomme encore les Lots 2-4
  (scoring/CAPA/rapport backend, déjà livrés mais sans pendant frontend).
  Construire cette page serait le pendant frontend du Lot 4, hors périmètre
  de la mission IA réglementaire. L'intégration choisie ne dépend
  d'aucune page manquante : `assistantAuditor` recalcule lui-même le
  scoring côté serveur.
- **T6 (vérification live des garde-fous) partiellement fait** : voir
  §Garde-fous ci-dessus — bloqué par l'absence volontaire et justifiée
  d'une clé API en environnement de développement partagé/chat. Câblage
  testé par mock ; comportement réel du modèle à vérifier manuellement dès
  que la clé sera configurée côté serveur.
- **Onboarding/scoring/CAPA/rapport non modifiés** au-delà de la lecture
  strictement nécessaire à l'assistant (`loadAuditScoringContext`,
  `buildScoringResult`, `sortByPriority` — tous réutilisés en lecture
  seule, aucune modification de leur comportement).

## Vérification

- 15/15 tests unitaires dédiés à l'assistant (9 `promptBuilder.test.ts` +
  6 `assistant-router.test.ts`), 70/70 au total sur le dépôt backend.
- Vérifié en direct via curl : `assistantUser` retourne 404 sur une question
  hors périmètre référentiel de l'audit (limite de sécurité) ; les deux
  endpoints atteignent correctement l'étape d'appel au modèle (le contexte
  et le prompt se construisent sans erreur) avant d'échouer proprement en
  l'absence de clé API.
- Vérifié en direct via un script Playwright piloté (non committé,
  jetable) : les deux panneaux de chat s'affichent, acceptent une saisie, et
  affichent l'erreur gracieuse attendue en l'absence de clé.
- Suite Playwright complète repassée après le refactor d'injection de
  dépendance : 11/11, aucune régression.
