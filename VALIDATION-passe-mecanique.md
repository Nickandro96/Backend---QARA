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
