# QARA — Passe mécanique : validation de la méthode de reconstruction (AVANT toute écriture)

**Statut : analyse seule, aucune écriture en base, aucune donnée touchée.**
Rédigé le 2026-07-31, en ouverture de la session "passe mécanique du corpus".

## A. Pourquoi ce document diffère du brief de départ

Le brief d'ouverture de session indiquait que "la session précédente a produit 15 exemples de
reconstruction" à valider. **Ces 15 exemples ne sont pas présents dans `DIAGNOSTIC-corpus.md`**
(relu intégralement, sections A à J : la section J.1 donne des comptages agrégés et 3-5 exemples
illustratifs par type, mais pas 15 exemples de reconstruction concrets avant/après). Ils
n'existent pas non plus ailleurs dans l'historique git de la branche de diagnostic.

**Plutôt que de présumer leur contenu, j'ai reconstruit la méthode moi-même depuis les données
réelles** : le fichier source `scripts/questions_import_ready.json` (473 questions) n'est commité
que sur la branche `claude/qara-backend-corpus-diagnostic` (jamais mergée) — je l'en ai extrait
en lecture seule pour vérifier la méthode sur les vraies données, sans écrire nulle part.

## B. Un bug trouvé dans la méthode décrite par le diagnostic — corrigé avant de te le montrer

Le diagnostic (section J.1) décrit la méthode comme : "si le fragment tronqué est un préfixe
exact du `title`, réinjecter le `title` complet dans le même gabarit". **En testant cette méthode
sur les 216 questions tronquées réelles, j'ai trouvé un cas où elle produit une phrase cassée.**

Exemple concret (`Q-14971-PGR-8687`) :
```
Texte tronqué original :
"Choisissons un danger réel concerné par processus de gestion des risques couvrant
toutes les phases du cycle… estimation, sa maîtrise et le risque résiduel retenu."

Reconstruction naïve (méthode "préfixe du title" telle que décrite) :
"...couvrant toutes les phases du cycle de vie du dispositif estimation, sa maîtrise..."
                                                              ^^^^^^^^^^ cassé — il manque
                                                              " : déroulez son identification, son"
```
**Cause :** dans certaines lignes, la troncature n'a pas seulement mangé la fin du `title` — elle a
aussi mangé le début du gabarit fixe qui suit (la partie après "…" n'est pas toujours le gabarit
complet, parfois c'est lui-même un fragment coupé). Une simple concaténation
"texte-avant-les-points + title + texte-après-les-points" reproduit cette coupure au lieu de la
réparer.

**Correction appliquée :** au lieu de faire confiance au texte qui suit "…", j'ai d'abord établi,
à partir des **257 questions NON tronquées** du corpus (jamais de "…"), la liste exhaustive des
paires (ouverture de phrase fixe, clôture de phrase fixe) réellement utilisées par le générateur —
**17 gabarits distincts, chacun confirmé par plusieurs occurrences intactes dans le corpus** (de 2
à 31 occurrences selon le gabarit). Pour chaque question tronquée, j'identifie le gabarit
(par l'ouverture, qui n'est jamais tronquée) puis je reconstruis avec la **clôture canonique
vérifiée**, jamais avec le reliquat de texte après "…" qui peut lui-même être corrompu.

Avec cette correction, l'exemple ci-dessus devient :
```
"Choisissons un danger réel concerné par processus de gestion des risques couvrant
toutes les phases du cycle de vie du dispositif : déroulez son identification, son
estimation, sa maîtrise et le risque résiduel retenu."
```
Grammaticalement complet, aucune exigence inventée (tout vient du `title` réel de la même ligne
et d'une clôture confirmée ailleurs dans le corpus).

## C. Chiffres révisés (méthode corrigée, sur les 473 questions réelles)

| | Diagnostic (estimation) | Cette vérification (mesure directe) |
|---|---|---|
| Questions tronquées ("…" dans `questionText`) | 216 | **216** (identique) |
| Reconstructibles mécaniquement (gabarit + `title` suffisent) | ~166 (147 + 19 estimés) | **171** (145 + 26, mesurés) |
| Résidu éditorial (vraie paraphrase, pas de correspondance gabarit/title) | ~50-69 | **45** (mesurés) |

Écart mineur et attendu (méthode plus stricte ici, appliquée aux 473 lignes réelles plutôt
qu'estimée) — le diagnostic annonçait lui-même ces chiffres comme des estimations, pas des
mesures exhaustives. Répartition du résidu éditorial (45) par référentiel, mesurée :
ISO14971 25, ISO9001 6, IVDR 3, FDA_QMSR 7, ISO13485 0(*), MDR 3, MDSAP 1 — cohérent avec le
diagnostic sur la concentration ISO14971/ISO9001.

*(ISO13485 : les 6 cas "manuels" du diagnostic sont ici résolus mécaniquement grâce à la clôture
canonique corrigée — c'est le bénéfice direct de la correction en section B.)*

## D. 15 exemples de reconstruction, un par référentiel minimum, pour validation

Format : `questionKey` | AVANT (texte réellement en base/JSON aujourd'hui) | APRÈS (reconstruction
proposée). Aucune modification du `title`, `expectedEvidence`, `criticality`, `questionKey` —
seul `questionText` change.

### MDR
**Q-MDR-MC-8407**
- AVANT : *Montrez-moi, sur un cas réel récent, comment marquage CE apposé uniquement après conformité démontrée est… est la preuve.*
- APRÈS : *Montrez-moi, sur un cas réel récent, comment marquage CE apposé uniquement après conformité démontrée est appliquée en pratique et où en est la preuve.*

**Q-MDR-RR-6201**
- AVANT : *Déroulez un cas concret concerné par obligations en cas de reconditionnement, relabelling ou modification… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ?*
- APRÈS : *Déroulez un cas concret concerné par obligations en cas de reconditionnement, relabelling ou modification susceptible d'affecter la conformité : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ?*

### IVDR
**Q-IVDR-AIFI-4529**
- AVANT : *Sortez le dernier cas concerné par investigation, analyse causes et actions suite incident/FSCA et… : date de connaissance, décision, date d'action. Le délai a-t-il été tenu ?*
- APRÈS : *Sortez le dernier cas concerné par investigation, analyse causes et actions suite incident/FSCA et reconstituons la chronologie : date de connaissance, décision, date d'action. Le délai a-t-il été tenu ?*

**Q-IVDR-DUCI-8719**
- AVANT : *Montrez-moi, sur un cas réel récent, comment déclaration UE de conformité IVD établie et tenue à jour est… est la preuve.*
- APRÈS : *Montrez-moi, sur un cas réel récent, comment déclaration UE de conformité IVD établie et tenue à jour est appliquée en pratique et où en est la preuve.*

### FDA_QMSR
**Q-FDA-CR-3056**
- AVANT : *Choisissons un danger réel concerné par rapports et enregistrements FDA des corrections et retraits visant un… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*
- APRÈS : *Choisissons un danger réel concerné par rapports et enregistrements FDA des corrections et retraits visant un risque santé ou violation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*

**Q-FDA-CC-4802**
- AVANT : *Montrez-moi, sur un cas réel récent, comment clarification des concepts FDA tels que organisation,… est appliquée en pratique et où en est la preuve.*
- APRÈS : *Montrez-moi, sur un cas réel récent, comment clarification des concepts FDA tels que organisation, safety/performance et exigences réglementaires est appliquée en pratique et où en est la preuve.*

### MDSAP
**Q-MDSAP-MAI-8057**
- AVANT : *Choisissons un danger réel concerné par traitement des réclamations et investigations proportionnées au… estimation, sa maîtrise et le risque résiduel retenu.*
- APRÈS : *Choisissons un danger réel concerné par traitement des réclamations et investigations proportionnées au risque : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*

**Q-MDSAP-DD-8592**
- AVANT : *Choisissons un danger réel concerné par planification conception et interfaces entre exigences, risques,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*
- APRÈS : *Choisissons un danger réel concerné par planification conception et interfaces entre exigences, risques, vérification et validation : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*

### ISO13485
**Q-13485-EM-7954**
- AVANT : *Montrez-moi, sur un cas réel récent, comment maîtrise, étalonnage et vérification des équipements de mesure est… est la preuve.*
- APRÈS : *Montrez-moi, sur un cas réel récent, comment maîtrise, étalonnage et vérification des équipements de mesure est appliquée en pratique et où en est la preuve.*

**Q-13485-RD-8627**
- AVANT : *Choisissons un danger réel concerné par revue de direction incluant entrées réglementaires, feedback, audits,… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*
- APRÈS : *Choisissons un danger réel concerné par revue de direction incluant entrées réglementaires, feedback, audits, fournisseurs, risques et actions : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*

### ISO14971
**Q-14971-DSD-1644**
- AVANT : *Montrez-moi, sur un cas réel récent, comment identification des dangers, situations dangereuses et séquences… est la preuve.*
- APRÈS : *Montrez-moi, sur un cas réel récent, comment identification des dangers, situations dangereuses et séquences d'événements est appliquée en pratique et où en est la preuve.*

**Q-14971-DGR-2987**
- AVANT : *Choisissons un danger réel concerné par dossier de gestion des risques traçable vers analyses, évaluations,… estimation, sa maîtrise et le risque résiduel retenu.*
- APRÈS : *Choisissons un danger réel concerné par dossier de gestion des risques traçable vers analyses, évaluations, contrôles et revues : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*

**Q-14971-PGR-8687** *(l'exemple de bug corrigé, section B, reproduit ici pour traçabilité)*
- AVANT : *Choisissons un danger réel concerné par processus de gestion des risques couvrant toutes les phases du cycle… estimation, sa maîtrise et le risque résiduel retenu.*
- APRÈS : *Choisissons un danger réel concerné par processus de gestion des risques couvrant toutes les phases du cycle de vie du dispositif : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu.*

### ISO9001
**Q-9001-P-9514**
- AVANT : *Montrez-moi, sur un cas réel récent, comment ressources humaines adaptées aux activités qualité et opérationnelles… est la preuve.*
- APRÈS : *Montrez-moi, sur un cas réel récent, comment ressources humaines adaptées aux activités qualité et opérationnelles est appliquée en pratique et où en est la preuve.*

**Q-9001-EO-6948**
- AVANT : *Montrez-moi, sur un cas réel récent, comment conditions environnementales et psychosociales adaptées aux… est la preuve.*
- APRÈS : *Montrez-moi, sur un cas réel récent, comment conditions environnementales et psychosociales adaptées aux opérations est appliquée en pratique et où en est la preuve.*

## E. Limite connue et acceptée (héritée du diagnostic, confirmée ici)

Certaines phrases reconstruites restent lourdes grammaticalement (accords de genre imparfaits
entre le `title` réinjecté et le verbe du gabarit, ex. "marquage CE... est appliquée" au lieu de
"est appliqué") — **ce défaut existe déjà identiquement dans des centaines de questions NON
tronquées du corpus** (le gabarit ne s'accorde jamais en genre avec le `title`), donc la
reconstruction n'introduit aucune régression, elle applique la même convention déjà en place.
L'élégance de formulation relève de la passe éditoriale, pas de cette passe mécanique.

## F. Ce qui reste à faire une fois cette méthode validée

1. Confirmer les comptages (216 / 171 / 45) sur new-claude (prod), pas seulement sur le JSON de
   la branche diagnostic — cf. règle de reconfirmation systématique.
2. Construire le script SQL réversible (colonne `questionTextSource`, UPDATE idempotent par
   `questionKey`, jamais de modification de `questionKey`).
3. Corriger le fichier source et rendre la génération déterministe pour empêcher la régression
   au prochain import.

**Rien n'est exécuté avant ton feu vert sur la méthode ci-dessus.**

---

## G. Méthode approuvée — livraison (étapes 2-4)

*Ajouté après ton feu vert sur la méthode (section A-F). Rédigé le 2026-07-31.*

### G.0 — Correction de topologie de branche (avant tout le reste)

La branche de travail `claude/qara-corpus-mechanical-pass-x12719`, telle que créée en ouverture
de session, était basée sur `main` — pas sur `claude/qara-compliance-audit-qitbxl` (prod) comme
l'exigent les règles de ce projet. `main` et `qitbxl` ont divergé de 83 commits côté `qitbxl`
(tout le travail de fond : normalisation `economicRole`, routeur générique, champs riches des
questions, etc. — absent de `main`). Continuer sur `main` aurait produit une migration `0030`
incompatible avec le schéma réel de production.

**Corrigé avant d'écrire quoi que ce soit d'autre** : rebase du commit de validation (section A-F)
sur `origin/claude/qara-compliance-audit-qitbxl`, puis `push --force-with-lease` (aucun autre
commit n'existait encore sur cette branche, aucune PR ouverte — rebase sans perte). La branche
est maintenant issue de `qitbxl`, conformément à la règle B.1. Vérifié : `drizzle/schema.ts` et
`drizzle/migrations/` reflètent maintenant l'état réel de prod (migration 0029 présente,
`questionText` bien de type `text`), et `scripts/questions_import_ready.json` de cette branche
est bit-à-bit identique (SHA-256) au fichier lu depuis la branche diagnostic — la méthode des
sections A-F s'applique donc bien à la source réelle.

### G.1 — Script déterministe et reproductible

`scripts/mechanical-pass-reconstruct.mjs` : lit `scripts/questions_import_ready.json` en entrée,
applique la méthode validée (17 paires ouverture/clôture dérivées des 257 questions non
tronquées, cf. section B), et produit :
- `scripts/output/mechanical-pass-report.json` — comptages exacts + la liste des 45 `questionKey`
  restant pour la passe éditoriale (avec la raison : `no-opener-match` ou `title-mismatch`) ;
- `scripts/output/mechanical-pass.sql` — le SQL prêt à coller dans Railway ;
- réécrit `scripts/questions_import_ready.json` en place (**seul `questionText` change, sur
  exactement 171 `questionKey`, aucun autre champ** — vérifié par diff : 171 lignes `questionText`
  modifiées, 0 ailleurs).

Exécuté une fois dans cette session : **216 tronquées → 171 reconstruites, 45 résidu éditorial**,
répartition par référentiel :

| Référentiel | Reconstructibles | Résidu éditorial |
|---|---|---|
| MDSAP | 34 | 1 |
| MDR | 31 | 3 |
| ISO13485 | 33 | 0 |
| FDA_QMSR | 19 | 7 |
| ISO14971 | 20 | 25 |
| IVDR | 19 | 3 |
| ISO9001 | 15 | 6 |
| **Total** | **171** | **45** |

### G.2 — Colonne de traçabilité (migration additive)

`drizzle/migrations/0030_questions_text_source.sql` : `ALTER TABLE questions ADD COLUMN
questionTextSource TEXT NULL`. Pas de `IF NOT EXISTS` (leçon de l'incident du 2026-07-27 sur la
migration 0029 — syntaxe rejetée par le MySQL de production) ; si "Duplicate column name" à
l'exécution, la colonne existe déjà, c'est un no-op attendu. `drizzle/schema.ts` mis à jour en
cohérence.

### G.3 — Script SQL (`scripts/output/mechanical-pass.sql`)

Un bloc par référentiel (7 `UPDATE ... CASE questionKey WHEN ... END WHERE questionKey IN
(...)`), chacun exécutable comme une seule instruction dans l'éditeur Query Railway. Idempotent :
`questionTextSource` n'est peuplée que si elle est `NULL` (`CASE WHEN questionTextSource IS NULL
THEN questionText ELSE questionTextSource END`) — un ré-exécution ne remplace jamais l'original
archivé par une valeur déjà reconstruite. Aucun `questionKey` modifié, aucune ligne ajoutée ou
supprimée. Requêtes de vérification avant (section 0) et après (section 3) incluses dans le même
fichier.

### G.4 — Procédure d'exécution (attend le feu vert)

1. **Sauvegarde de la table `questions`** sur new-claude (hors de ce dépôt, responsabilité
   utilisateur — mysqldump ou export Railway).
2. Coller et exécuter le bloc "0. VERIFICATION AVANT" de `mechanical-pass.sql` — confirmer 473
   total, 216 tronquées, avant de continuer.
3. Coller le bloc "1. MIGRATION ADDITIVE" (`ALTER TABLE`).
4. Coller chacun des 7 blocs "2. RECONSTRUCTION — {référentiel}", un par un.
5. Coller le bloc "3. VERIFICATION APRES" — confirmer 473 total (inchangé), 45 tronquées
   restantes (passe éditoriale), 171 lignes avec `questionTextSource` peuplée, 473 `questionKey`
   distincts (inchangé), et comparer l'échantillon de contrôle aux exemples de la section D.
6. Si tout correspond : merge de cette branche vers `qitbxl` (avec ton feu vert explicite),
   `scripts/questions_import_ready.json` déjà corrigé dans ce même commit empêche la régression
   au prochain déploiement (le script `release` ré-exécute `import-corpus.mjs` à chaque
   déploiement Railway, upsert par `questionKey` — il réécrirait `questionText` depuis la source
   si elle n'était pas corrigée aussi).

**Aucune étape ci-dessus n'a été exécutée contre new-claude. En attente de ton feu vert avant la
sauvegarde + exécution.**
