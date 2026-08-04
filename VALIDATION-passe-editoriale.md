# QARA — Passe éditoriale du corpus (45 questions) : validation et livraison

**Statut corrigé le 2026-08-04 : les 45 reformulations ne sont PAS validées globalement. Seul un lot ISO 14971 partiel a été examiné. SQL préparatoire uniquement ; rien ne doit être exécuté ou déployé avant validation explicite lot par lot.** Rédigé le 2026-07-31, fait suite à `VALIDATION-passe-mecanique.md`
(passe mécanique, 171 questions, déjà mergée en prod via migration 0030).

## A. Contexte

Après la passe mécanique (216 → 45 questions encore atteintes d'un défaut de formulation),
répartition du résidu : ISO14971 25 · FDA_QMSR 7 · ISO9001 6 · MDR 3 · IVDR 3 · MDSAP 1.
La branche contient 45 propositions. La trace disponible ne démontre pas leur présentation complète ni un feu vert global. Elles doivent être représentées par lots de 5 à 8 au format : texte actuel / champs d'ancrage / reformulation proposée / justification, puis validées explicitement.

## B. Défaut supplémentaire trouvé en cours de route : `title` tronqué silencieusement

En préparant les reformulations, découverte que **24 lignes du corpus ont un `title` lui-même
coupé à exactement 250 caractères, sans marqueur "…"** — non détecté par le diagnostic initial,
qui ne cherchait que "…". Sur ces 24 :
- **13 sont dans le lot des 45** de cette passe (`Q-FDA-N-2561/1933/6492`, `Q-FDA-SQ-5662`,
  `Q-FDA-SC-6736/4677`, `Q-9001-CLO-5514/PS-7808/L-0975`, `Q-MDR-S-3363/S-5062/SM-0792`,
  `Q-MDSAP-PL-3453`) — `titleTruncated: true` dans `scripts/editorial-pass-data.mjs`.
- **11 sont ailleurs dans le corpus, hors scope de cette passe** (`questionText` jamais tronqué,
  donc jamais signalées) : `Q-FDA-CMC-0807/1104/4738`, `Q-FDA-DCS-2444/2147`, `Q-FDA-SQ-4087`,
  `Q-FDA-SC-8311`, `Q-14971-CIP-2019`, `Q-9001-OA-2015`, `Q-MDR-S-1304/DSM-0911`. **Non traitées
  ici** — à cadrer séparément si l'utilisateur le décide.
- Vérifié : **0 des 171 questions déjà reconstruites par la passe mécanique et mergées en prod**
  n'est concernée — aucune contamination rétroactive.

Pour les 13 lignes affectées, la reformulation s'ancre sur le `title` disponible (250 premiers
caractères, jamais modifié) complété par le texte réglementaire réel vérifié (connaissance
directe du référentiel, pas une invention) :
- 21 CFR 860 Subpart D (§§860.200-860.260), FD&C 513(f)(2) — voie De Novo
- FD&C section 524B — cybersécurité des « cyber devices »
- MDR Art. 32 — SSCP ; MDR Art. 10(14) — coopération avec l'autorité compétente
- ISO 9001 Amendement 1:2024 — enjeux liés aux changements climatiques
- MDSAP AU P0002 (Audit Approach) — liaison inter-processus

## C. Script et livraison

`scripts/editorial-pass-data.mjs` : les 45 `questionKey` → propositions de reformulation en attente de validation complète (`titleTruncated: true` sur les 13 concernées par le point B).

`scripts/editorial-pass-apply.mjs` : contrôles avant toute écriture (chaque `questionKey` existe
une fois, son `questionText` actuel contient encore "…", aucune reformulation n'introduit "…"),
puis :
- réécrit `scripts/questions_import_ready.json` en place (**45 `questionText` changés, rien
  d'autre** — vérifié par diff) ;
- génère `scripts/output/editorial-pass-report.json` (comptages) ;
- génère `scripts/output/editorial-pass.sql` (6 blocs `UPDATE ... CASE questionKey ... END`, un
  par référentiel concerné, idempotents comme la passe mécanique — `questionTextSource` peuplée
  uniquement si `NULL`, réutilise la colonne de la migration 0030 déjà en place).

Résultat vérifié après exécution du script (lecture seule sur le fichier source, aucune base
touchée) : **0 question encore tronquée dans `scripts/questions_import_ready.json`** (216 → 171
passe mécanique → 45 passe éditoriale → 0). 473 questions toujours présentes, aucun `questionKey`
modifié.

## D. Procédure d'exécution (attend le feu vert d'exécution en prod)

1. **Sauvegarde de la table `questions`** sur new-claude (responsabilité utilisateur).
2. Coller et exécuter "0. VERIFICATION AVANT" de `scripts/output/editorial-pass.sql` — confirmer
   473 total, 45 tronquées, 171 lignes avec `questionTextSource` déjà peuplée (preuve que la
   passe mécanique est bien en place avant de continuer).
3. Coller chacun des 6 blocs "RECONSTRUCTION EDITORIALE — {référentiel}", un par un.
4. Coller "VERIFICATION APRES" — confirmer 473 total (inchangé), **0 tronquée restante**, 216
   lignes avec `questionTextSource` peuplée (171 + 45), 473 `questionKey` distincts (inchangé).
5. Si tout correspond : merge vers `qitbxl` (feu vert explicite requis), le fichier source déjà
   corrigé dans ce commit empêche la régression au prochain déploiement.

**Aucune étape ci-dessus n'a été exécutée contre new-claude.**

## E. Reste ouvert (hors scope de cette passe, à cadrer séparément si décidé)

- Les 11 questions au `title` tronqué découvertes en section B, hors des 45.
- Les 141 groupes divergents (25 Type 1 fusion, 45 Type 2 title à différencier, zone
  intermédiaire, 21 criticités divergentes) — cf. `DIAGNOSTIC-corpus.md`.
