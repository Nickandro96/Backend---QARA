# QARA — Diagnostic et classification du corpus (Tâche 1 : les 141 groupes divergents)

**Statut : diagnostic uniquement, aucune écriture en base, aucune correction appliquée.**
Rédigé le 2026-07-27. Chiffres calculés sur le miroir local (`qara_qitbxl_local`), dont la
volumétrie totale (473 questions, répartition par référentiel) est confirmée identique à
new-claude par vérifications antérieures de cette session — **mais pas re-vérifiée ligne à
ligne pour ce diagnostic précis**. Les requêtes de confirmation à exécuter sur new-claude sont
en section E ci-dessous, comme demandé.

## A. Périmètre et méthode

**Clé de regroupement** (déjà établie dans les diagnostics précédents de cette session) :
`(referentialId, economicRole, processId, article, annexe, title)`. Deux questions partageant
cette clé mais un `questionText` différent forment un "groupe divergent".

```sql
SELECT COUNT(*) AS groupes_divergents, SUM(cnt) AS questions_dans_groupes
FROM (
  SELECT referentialId, economicRole, processId, article, annexe, title, COUNT(*) AS cnt
  FROM questions
  GROUP BY referentialId, economicRole, processId, article, annexe, title
  HAVING COUNT(*) >= 2
) g;
```
**Résultat local : 141 groupes, 354 questions concernées** (sur 473 au total, soit 75 % du
corpus impliqué dans au moins un groupe divergent).

Répartition des 141 groupes par référentiel :

| Référentiel | Groupes divergents | Total questions du référentiel |
|---|---|---|
| ISO13485 | 28 | 93 |
| MDR | 26 | 80 |
| MDSAP | 26 | 74 |
| IVDR | 23 | 72 |
| ISO14971 | 20 | 67 |
| FDA_QMSR | 12 | 43 |
| ISO9001 | 6 | 44 |

**Méthode de triage (reproductible, pas une lecture manuelle exhaustive des 141 groupes)** :
pour chaque groupe, calcul de la similarité moyenne par paire entre les `questionText` du
groupe, via un indice de Jaccard sur les mots de plus de 3 lettres (recouvrement lexical). Un
score élevé signale une reformulation quasi mot-pour-mot (Type 1 probable) ; un score faible
signale un contenu substantiellement différent malgré la clé partagée (Type 2 probable). Les
scores intermédiaires nécessitent une lecture au cas par cas — **je ne les ai pas tous lus un
par un, je le signale explicitement plutôt que de prétendre une classification exhaustive**.

Distribution des 141 groupes par score de similarité :

| Tranche de similarité | Groupes | Questions concernées | Hypothèse |
|---|---|---|---|
| ≥ 0,50 (forte) | 25 | 75 | Type 1 — reformulation quasi pure |
| 0,25 – 0,49 (moyenne) | 71 | 176 | Mixte — nécessite lecture au cas par cas |
| < 0,25 (faible) | 45 | 103 | Type 2 — angles distincts |

## B. Type 1 — Reformulations pures (candidates à la fusion)

**Constat prouvé sur 3 groupes complets, sim ≥ 0,54, aucune troncature :**

### Exemple 1 — MDR, Art. 10(9), SMQ fabricant (sim = 0,59)
| Clé | Criticité | Texte complet | Preuve attendue |
|---|---|---|---|
| `Q-MDR-SFM-1417` | critical | Montrez-moi comment vous prouvez que l'action prise sur système de management qualité couvrant conformité réglementaire, responsabilité direction, ressources, réalisation produit, PMS, vigilance et CAPA a réellement empêché le problème de revenir. | *(identique sur les 3 lignes)* procédure ou instruction applicable à SMQ fabricant MDR ; enregistrement du cas réel sélectionné par l'auditeur ; preuve de revue/approbation avec date, rôle et justification ; éléments de traçabilité démontrant le lien avec les risques, la conformité produit et les décisions prises ; analyse d'impact patient/réglementaire ; preuve d'efficacité ou de vérification indépendante ; CAPA, mise à jour PMS/risques/dossier technique si applicable |
| `Q-MDR-SFM-1774` | critical | Prenez la dernière action corrective liée à système de management qualité couvrant conformité réglementaire, responsabilité direction, ressources, réalisation produit, PMS, vigilance et CAPA : déroulez-la du déclencheur jusqu'à la preuve d'efficacité vérifiée à distance. | *(identique)* |
| `Q-MDR-SFM-2992` | critical | **Texte strictement identique à Q-MDR-SFM-1774** — duplicata exact, pas seulement une reformulation. | *(identique)* |

`expectedEvidence` est **strictement identique** sur les 3 lignes. `criticality` aussi. Seule la
formulation d'accroche change ("Montrez-moi comment..." / "Prenez la dernière action
corrective..."), et `Q-MDR-SFM-2992` est un doublon EXACT de `Q-MDR-SFM-1774` (même texte au
caractère près, `questionKey` différent).

### Exemple 2 — MDSAP, Design T3 (sim = 0,57)
`Q-MDSAP-DD-3825` et `Q-MDSAP-DD-7756` : **texte strictement identique** ("Ouvrons le dernier
dossier de conception... montrez-moi la trace de bout en bout..."). `Q-MDSAP-DD-4122` :
reformulation ("Prouvez-moi, sur un projet réel, que revues, vérification, validation et
transfert conception réalisés sur preuves objectives a été appliquée et vérifiée, pas seulement
planifiée."). `expectedEvidence` et `criticality` (high) identiques sur les 3.

### Exemple 3 — IVDR, Art. 57 PMPF (sim = 0,55)
Même schéma : `Q-IVDR-DP-1061` et `Q-IVDR-DP-4992` strictement identiques ; `Q-IVDR-DP-1358`
reformulée. `expectedEvidence`/`criticality` (high) identiques sur les 3.

**Constat transversal important, au-delà des 25 groupes à forte similarité :** au moins **62
paires/groupes de `questionText` strictement identiques** existent dans le corpus (requête
ci-dessous), indépendamment de la clé de regroupement — c'est-à-dire des doublons purs à 100 %,
pas seulement des reformulations proches.

```sql
SELECT COUNT(*) AS paires_texte_exactement_identique
FROM (
  SELECT questionText, COUNT(*) AS n
  FROM questions
  WHERE questionText IS NOT NULL AND TRIM(questionText) <> ''
  GROUP BY questionText
  HAVING COUNT(*) >= 2
) x;
```
**Résultat local : 62.**

**Méthode de résolution proposée :** pour les 25 groupes à forte similarité (et prioritairement
les duplicatas texte-strictement-identiques parmi eux), conserver une seule question par
groupe — la mieux formulée grammaticalement (souvent celle utilisant "Montrez-moi comment..."
plutôt que les fragments cassés, à croiser avec la Tâche 2). Les autres `questionKey` du groupe
sont supprimées.

**Impact estimé (si les 25 groupes à forte similarité étaient fusionnés à 1 question chacun) :**
75 questions → 25 questions, soit **-50 questions sur les 473** (473 → 423, -10,6 %). C'est un
plancher : la tranche "moyenne" (71 groupes, 176 questions) contient probablement d'autres
candidats Type 1 qu'une lecture au cas par cas ferait basculer ici.

## C. Type 2 — Angles d'audit distincts (à conserver, titre à corriger)

**Constat prouvé sur 3 groupes complets, sim ≤ 0,08 :**

### Exemple 1 — ISO 13485, 7.5.6, validation des procédés (sim = 0,06)
C'est très exactement le cas que tu avais toi-même identifié dans ta demande :
| Clé | Angle testé |
|---|---|
| `Q-13485-VP-0054` | Méthodologie de décision valider/ne pas valider + preuve de contrôle à 100 % pour les procédés non validés + justification statistique des tailles d'échantillon en PQ. |
| `Q-13485-VP-0351` | Preuve simple qu'un lot a été validé et enregistré conformément à la procédure. |
| `Q-13485-VP-6015` | Gestion du changement : liste des changements depuis 2 ans sur un procédé validé, décision revalidation/non-revalidation, dérives qui auraient dû déclencher une revalidation. |

Trois angles réellement distincts (décision initiale / exécution conforme / gestion du
changement dans la durée) sous un `title` générique unique ("validation des procédés...") qui
les fait paraître comme des doublons alors qu'ils ne le sont pas.

### Exemple 2 — IVDR, Art. 10, obligations fabricant (sim = 0,08)
`Q-IVDR-OFI-0865` (justification de classification sur un portefeuille de 3 produits),
`Q-IVDR-OFI-2440` (organisation SMQ des 3 piliers de performance evaluation),
`Q-IVDR-OFI-4499` (détection et traitement d'une dérive de performance post-commercialisation).
Trois moments différents du cycle de vie, trois preuves différentes.

### Exemple 3 — MDSAP, boucle incident (sim = 0,07)
`Q-MDSAP-MDAE-1613` (reconstitution de chronologie sur un incident déclaré),
`Q-MDSAP-MDAE-7682` (audit des décisions de NON-déclaration, angle inversé — souvent oublié),
`Q-MDSAP-MDAE-7979` (réconciliation systémique registre incidents ↔ dossier de risques sur 24
mois). Trois preuves non substituables l'une à l'autre.

**Méthode de résolution proposée :** conserver les 45 questions à faible similarité telles
quelles (aucune fusion). Corriger uniquement le `title` partagé pour qu'il distingue
explicitement les angles (ex. suffixer "— décision initiale" / "— exécution" / "— gestion du
changement"), afin que l'affichage produit (qui expose `title`) ne laisse plus croire à un
doublon.

**Impact estimé :** 0 question supprimée. 45 `title` à reformuler (métadonnée seule, pas de
perte de contenu).

## D. Type 3 — Incohérences de données (correction obligatoire)

Deux sous-catégories distinctes trouvées, à ne pas confondre :

### D.1 — Groupes à `criticality` divergente au sein des 141

```sql
SELECT COUNT(*) FROM (
  SELECT referentialId, economicRole, processId, article, annexe, title,
         COUNT(*) AS cnt, COUNT(DISTINCT criticality) AS dc
  FROM questions
  GROUP BY referentialId, economicRole, processId, article, annexe, title
  HAVING COUNT(*) >= 2 AND COUNT(DISTINCT criticality) >= 2
) x;
```
**Résultat local : 21 groupes** — nombre qui correspond exactement à celui déjà évoqué avant ce
diagnostic.

**Constat clé, vérifié ligne par ligne sur les 21 : au moins 19 des 21 sont en réalité des
variantes Type 1 (même contenu, gabarit différent) dont la criticité a été assignée de façon
incohérente entre les gabarits** — pas des divergences volontaires reflétant des angles
différents. Exemple complet :

| Clé | Criticité | Texte |
|---|---|---|
| `Q-MDR-CA-6183` | **low** | Montrez-moi, sur un cas réel récent, comment voie d'évaluation de conformité sélectionnée selon classe et type de… est la preuve. |
| `Q-MDR-CA-8311` | **high** | Déroulez un cas concret concerné par voie d'évaluation de conformité sélectionnée selon classe et type de dispositif : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ? |

Même exigence (Art. 52 MDR, voie de conformité), même processus, même rôle — mais `low` pour un
gabarit et `high` pour l'autre. Second exemple, Art. 20 marquage CE : `low` vs `medium` sur la
même exigence. Troisième exemple, Art. 27 UDI : `low` vs `high`. Dans les 3 cas, c'est le
gabarit ("Montrez-moi, sur un cas réel récent, comment...") qui est systématiquement noté plus
bas que le gabarit ("Déroulez un cas concret concerné par...") — signe d'un biais de génération
par gabarit plutôt que d'une évaluation de criticité réfléchie par exigence.

**2 des 21 groupes semblent en revanche relever du Type 2** (angles réellement différents où une
criticité différente serait justifiée) : `8.5.3 actions préventives` (une question sur les
préventives routinières vs une sur les préventives d'ampleur suite à modification majeure) et
`Art. 15 PCVRR` (qualification de la personne vs cas concret d'usage de son autorité). **Ces 2
sont à trancher par une lecture experte, pas par la règle générale.**

### D.2 — Texte strictement identique mais métadonnées divergentes (le cas le plus grave)

```sql
SELECT COUNT(*) FROM (
  SELECT questionText, COUNT(*) AS cnt,
         COUNT(DISTINCT criticality) AS dc, COUNT(DISTINCT article) AS da,
         COUNT(DISTINCT expectedEvidence) AS de
  FROM questions
  WHERE questionText IS NOT NULL AND TRIM(questionText) <> ''
  GROUP BY questionText
  HAVING COUNT(*) >= 2 AND (COUNT(DISTINCT criticality) > 1 OR COUNT(DISTINCT article) > 1 OR COUNT(DISTINCT expectedEvidence) > 1)
) x;
```
**Résultat local : 4 groupes.** Texte rigoureusement identique au caractère près, mais au moins
une métadonnée (criticité, article, ou preuve attendue) diverge entre les lignes — c'est-à-dire
qu'un même énoncé de question reçoit un traitement différent selon la ligne, sans aucune
justification textuelle visible. **Ce sous-cas n'a aucune ambiguïté possible : c'est une
incohérence de données pure, correction obligatoire quelle que soit la décision sur le reste.**

**Méthode de résolution proposée :** pour D.1 (19 groupes confirmés + 2 à trancher), fusionner
comme les groupes Type 1 (une seule question conservée) en choisissant la criticité la plus
élevée du groupe par prudence réglementaire (jamais la plus basse), sauf pour les 2 cas
identifiés comme Type 2 où les 2 questions et leurs 2 criticités sont conservées séparément.
Pour D.2 (4 groupes), même traitement mais sans ambiguïté aucune — priorité de correction
absolue.

**Impact estimé :** inclus dans l'estimation Type 1 (ces groupes se recoupent largement avec la
tranche "forte similarité"), pas un impact volumétrique supplémentaire net — mais un impact de
**fiabilité** : un score de conformité aujourd'hui dépend de quelle variante (gabarit) l'auditeur
est tombé dessus, ce qui n'est pas défendable devant un organisme notifié.

## E. Requêtes à exécuter sur new-claude pour confirmer ces chiffres

Lecture seule, aucune écriture. Merci de me redonner les résultats exacts (les nombres, pas la
capture) pour chacune.

```sql
-- 1. Confirmation volumétrie totale
SELECT COUNT(*) AS total FROM questions;

-- 2. Les 141 groupes divergents (clé métier établie)
SELECT COUNT(*) AS groupes_divergents, SUM(cnt) AS questions_dans_groupes
FROM (
  SELECT referentialId, economicRole, processId, article, annexe, title, COUNT(*) AS cnt
  FROM questions
  GROUP BY referentialId, economicRole, processId, article, annexe, title
  HAVING COUNT(*) >= 2
) g;

-- 3. Répartition des groupes par référentiel (jointure sur les IDs réels 3-9)
SELECT r.code, COUNT(*) AS groupes
FROM (
  SELECT referentialId
  FROM questions
  GROUP BY referentialId, economicRole, processId, article, annexe, title
  HAVING COUNT(*) >= 2
) g
JOIN referentiels r ON r.id = g.referentialId
GROUP BY r.code
ORDER BY groupes DESC;

-- 4. Groupes à criticité divergente (Type 3, D.1)
SELECT COUNT(*) FROM (
  SELECT referentialId, economicRole, processId, article, annexe, title,
         COUNT(*) AS cnt, COUNT(DISTINCT criticality) AS dc
  FROM questions
  GROUP BY referentialId, economicRole, processId, article, annexe, title
  HAVING COUNT(*) >= 2 AND COUNT(DISTINCT criticality) >= 2
) x;

-- 5. Texte identique, métadonnées divergentes (Type 3, D.2 — le plus grave)
SELECT COUNT(*) FROM (
  SELECT questionText, COUNT(*) AS cnt,
         COUNT(DISTINCT criticality) AS dc, COUNT(DISTINCT article) AS da,
         COUNT(DISTINCT expectedEvidence) AS de
  FROM questions
  WHERE questionText IS NOT NULL AND TRIM(questionText) <> ''
  GROUP BY questionText
  HAVING COUNT(*) >= 2 AND (COUNT(DISTINCT criticality) > 1 OR COUNT(DISTINCT article) > 1 OR COUNT(DISTINCT expectedEvidence) > 1)
) x;

-- 6. Paires de texte strictement identique, toutes causes confondues
SELECT COUNT(*) AS paires_texte_exactement_identique
FROM (
  SELECT questionText, COUNT(*) AS n
  FROM questions
  WHERE questionText IS NOT NULL AND TRIM(questionText) <> ''
  GROUP BY questionText
  HAVING COUNT(*) >= 2
) x;
```

Si les résultats sur new-claude divergent de ceux ci-dessus (141/354/21/4/62), je le signale
immédiatement avant de continuer — ce serait le signe que mon miroir local a dérivé de la
production entre-temps.

## G. Fiabilité de la criticité sur l'ensemble du corpus (approfondissement demandé)

**Hypothèse testée :** le verbe d'ouverture du gabarit détermine-t-il systématiquement la
criticité, indépendamment de l'exigence réelle ?

**Test rigoureux (pas le petit échantillon de 21 groupes, qui est biaisé par construction —
il a été sélectionné parce qu'il montre une divergence, donc il ne peut pas servir à mesurer un
biais général) :** comparaison appariée des deux gabarits les plus fréquents du corpus,
"Montrez-moi, sur un cas réel récent, comment..." (105 questions) et "Déroulez un cas concret
concerné par..." (38 questions), **uniquement sur les groupes où les deux gabarits coexistent
pour la même exigence** (33 groupes) :

| Résultat | Nombre |
|---|---|
| Criticité identique entre les deux gabarits | 23 (70 %) |
| "Montrez-moi..." plus haut que "Déroulez..." | 5 |
| "Déroulez..." plus haut que "Montrez-moi..." | 5 |

**Conclusion honnête, qui corrige mon hypothèse initiale : il n'y a pas de biais directionnel
prouvé.** Sur l'échantillon apparié complet, la répartition est parfaitement symétrique (5
contre 5) et 70 % des paires ont exactement la même criticité. Le gabarit ne détermine donc pas
systématiquement une criticité plus basse ou plus haute.

**Ce qui reste vrai, en revanche :** dans 30 % des cas appariés (10/33), la même exigence
reçoit une criticité différente selon la variante — ce n'est pas un biais de verbe, c'est du
**bruit d'assignation** (la criticité semble avoir été attribuée indépendamment à chaque ligne
générée, sans vérification de cohérence avec les autres variantes de la même exigence), cohérent
avec le taux de 21/141 (15 %) déjà trouvé en Tâche 1 (section D.1).

**Vérification complémentaire — les gabarits fortement corrélés à "high" ne sont pas biaisés,
ils sont thématiquement concentrés (donc légitimes) :** "Choisissons un danger réel concerné
par" (72 questions, 97 % high/critical) est utilisé à 53 % (38/72) sur ISO14971 et à 47 % sur le
processus "gestion des risques" — cohérent avec le fait que ces questions portent réellement sur
l'analyse de risques, qui mérite une criticité élevée. Même chose pour "Ouvrons le dernier
dossier de conception" (95 % high, 18/20 sur le processus conception) et "Prouvez-moi, sur un
projet réel" (93 % high, 14/15 sur conception). **Ces corrélations reflètent le sujet traité, pas
un artefact de génération.**

**Verdict sur la fiabilité de la criticité :** ni totalement fiable, ni totalement aléatoire.
Le taux de bruit mesurable (15-30 % selon la méthode de mesure, sur les seules paires
comparables) est trop élevé pour faire une confiance aveugle à la colonne `criticality` telle
quelle, mais il n'y a pas de biais structurel massif qui invaliderait tout le corpus d'un coup
— une correction ciblée sur les groupes identifiés (141 groupes, harmoniser à la criticité la
plus élevée du groupe par prudence réglementaire) réglerait la partie mesurable du problème.

## H. Cinq exemples complets de la zone intermédiaire (0,25-0,49 de similarité, 71 groupes)

Échantillon non biaisé : le minimum, le 25e percentile, la médiane, le 75e percentile et le
maximum de similarité dans cette zone — pas une sélection favorable à une conclusion.

**1. sim=0,25 — MDR, Annexe I Ch. II (conception/fabrication)**
- `Q-MDR-GCF-4569` (high) : "Ouvrons le dernier dossier de conception concerné par exigences de conception et fabrication démontrées par preuves techniques : montrez-moi la trace de bout en bout, entrées, revues, vérification, validation."
- `Q-MDR-GCF-8622` (high) : "Prouvez-moi, sur un projet réel, que exigences de conception et fabrication démontrées par preuves techniques a été appliquée et vérifiée, pas seulement planifiée."

**2. sim=0,27 — FDA_QMSR, 21 CFR 830 (UDI/GUDID)**
- `Q-FDA-US-2719` (medium) : "Déroulez un cas concret concerné par attribution, changement, maintien et soumission GUDID des identifiants UDI : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ?"
- `Q-FDA-US-4294` (medium) : "Montrez-moi, sur un cas réel récent, comment attribution, changement, maintien et soumission GUDID des… est la preuve." *(gabarit tronqué, cf. section G/Tâche 2)*

**3. sim=0,33 — MDR, Art. 13 (vérifications importateur)**
- `Q-MDR-I-5980` (medium) : "Montrez-moi, sur un cas réel récent, comment vérifications importateur avant mise sur le marché et traçabilité des… est appliquée en pratique et où en est la preuve."
- `Q-MDR-I-6277` (medium) : "Déroulez un cas concret concerné par vérifications importateur avant mise sur le marché et traçabilité des… : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ?"

**4. sim=0,47 — ISO14971, 10.4 (actions post-PMS)**
- `Q-14971-APP-5733` (high) et `Q-14971-APP-9033` (high) : texte **strictement identique** ("Choisissons un danger réel concerné par actions sur le dispositif...") — un vrai doublon caché dans ce groupe de 3.
- `Q-14971-APP-7458` (high) : reformulation ("Montrez-moi comment actions sur le dispositif, le dossier de risque ou le PMS lorsque de… relie votre analyse de risques à une décision concrète sur le produit.")

**5. sim=0,49 — MDR, Art. 84 (plan PMS)**
- `Q-MDR-PP-2250` et `Q-MDR-PP-6472` : texte **strictement identique** ("Prenez la dernière action corrective liée à plan PMS documenté...") — encore un doublon caché.
- `Q-MDR-PP-8047` : reformulation ("Montrez-moi comment vous prouvez que l'action prise sur plan PMS documenté... a réellement empêché le problème de revenir.")

**Verdict sur la zone intermédiaire, sur cette base (échantillon de 5, pas un audit exhaustif des
71) : très majoritairement du bruit de génération, pas de vraies nuances d'audit.** Sur les 5
exemples, aucun ne présente un angle d'audit réellement différent au sens de la section C
(Type 2) — ce sont tous des reformulations gabarit-sur-gabarit qui se ressemblent moins
lexicalement que les groupes Type 1 "évidents", mais qui posent fondamentalement la même
question. Deux des cinq contiennent même un doublon texte-strictement-identique caché derrière
le calcul de similarité moyenne du groupe (la 3e variante fait baisser la moyenne). **Ça pousse
vers un remède éditorial plus large que prévu** — l'heuristique lexicale (Jaccard) ne sépare pas
fiablement "même question, gabarit différent" de "question réellement différente" dès que les
gabarits ne partagent pas beaucoup de mots ; il faudrait soit une lecture manuelle complète des
71 groupes, soit une méthode de similarité sémantique plus fine (embeddings) pour trancher
proprement — la méthode purement lexicale utilisée en Tâche 1 a une limite réelle, que je
signale plutôt que de la passer sous silence.

## I. Tâche 3 — Origine du corpus et verdict

### I.1 Provenance, telle que traçable dans le dépôt

Le corpus (`scripts/questions_import_ready.json`, 473 entrées, 2,2 Mo) n'a **qu'un seul commit
dans toute l'histoire du dépôt** : `60fda8a3`, "Import verified content corpus (473 questions, 7
referentials)", 2026-07-04, auteur `Claude <noreply@anthropic.com>`.

Le message de commit et `docs/audit/07-import-corpus.md` indiquent que ce corpus a été
**"préparé séparément"** et **"fourni"** via des fichiers (`INSTRUCTION-CLAUDE-CODE.md`,
`README-pont-import.md`, `SPEC-1/2/3-*.md`, `import-corpus.mjs`, `questions_import_ready.json`)
— **aucun de ces fichiers sources n'a jamais été commité dans ce dépôt** (recherche sur tout
l'historique git, aucune trace). **La provenance réelle du contenu (quel processus, quel outil,
quelle méthode de génération) n'est donc pas traçable depuis ce dépôt.**

Fait le plus important : `07-import-corpus.md` déclare explicitement que le corpus est
**"décrit comme vérifié à 100% sur sources officielles"** — une reformulation de la fourniture,
pas une vérification indépendante — et conclut : **"Ces specs ne redemandent pas d'audit du
contenu réglementaire (déjà fait et vérifié côté fourniture) — le rôle de cette session est
l'implémentation, pas la recherche."** Autrement dit : **personne n'a jamais audité la qualité
du contenu avant ce diagnostic.** Seule la mécanique d'import (comptages, tests E2E) a été
vérifiée.

### I.2 Preuves structurelles d'une génération sans passe de curation

- **216 questions sur 473 (45,7 %) contiennent l'artefact d'ellipse** ("…") **directement dans
  le JSON source** — pas introduit par le script d'import, confirmé en lisant le fichier brut.
  Présent sur les **7 référentiels**, de 31 % (IVDR) à 67 % (ISO14971) — un défaut systémique,
  pas un cas isolé.
- **Ce défaut ne se limite pas aux 141 groupes divergents : 63 des 119 questions "uniques" (sans
  aucun doublon/variante) en sont aussi atteintes, soit 53 %.** C'est la preuve la plus
  importante de cette section — même en réglant parfaitement les 141 groupes (Tâche 1), la
  majorité du problème de qualité textuelle resterait intacte sur le reste du corpus.
- **`officialSource` n'a que 13 valeurs distinctes sur 473 questions** — une par référentiel
  (ex. "NF EN ISO 13485:2016" répété identique sur les 93 questions ISO13485, un lien EUR-Lex
  répété sur les 80 questions MDR). C'est une citation de niveau réglementation, pas une
  vérification article par article : le corpus cite la bonne loi/norme globalement, mais rien
  n'indique une vérification ligne par ligne contre le texte exact de chaque article.
- Les champs riches (`expectedEvidence`, `aiPrompt`, `risk`) sont des paragraphes génériques
  réutilisés à l'identique sur des dizaines d'exigences différentes au sein d'un même
  référentiel (déjà visible dans les exemples Tâche 1, section B) — cohérent avec un système à
  gabarits plutôt qu'une rédaction question par question.
- Suffixes `questionKey` (`-8687`, `-9738`, etc.) : nombres à 4 chiffres sans structure
  apparente, cohérents avec une génération programmatique (ex. `Math.random()` ou équivalent)
  plutôt qu'une numérotation contrôlée.

### I.3 Verdict

**Une revue de fond est nécessaire — un correctif ciblé sur les 141 groupes ne suffit pas.**

Raisonnement : le correctif ciblé de la Tâche 1 (fusionner ~25-96 groupes selon le seuil retenu,
harmoniser la criticité de 141 groupes) réglerait la duplication et une partie du bruit de
criticité. **Mais il ne toucherait quasiment pas le défaut de formulation** : celui-ci touche
216 questions dont 63 hors de tout groupe divergent — un correctif limité aux groupes laisserait
au moins 63 questions cassées visibles par les utilisateurs, en plus d'une partie des 153
questions à l'intérieur des groupes qui ne seraient pas systématiquement corrigées par une simple
fusion (fusionner un groupe ne garantit pas que la question conservée soit elle-même bien
formée).

Pour un produit destiné à un usage réglementaire potentiellement examiné par un organisme
notifié, une question affichant "…est la preuve." n'est pas un défaut cosmétique mineur — c'est
un signal de non-sérieux qui peut légitimement faire douter de la fiabilité de tout l'outil.

### I.4 Méthode proposée pour la revue de fond (à valider, pas à exécuter)

1. **Périmètre en deux passes**, pas une seule revue monolithique :
   - **Passe 1 — assainissement mécanique** (peu de jugement, fort volume) : détection et
     correction automatisée des motifs de troncature identifiés (ellipses en fin de segment,
     doubles "est... est", répétitions de titre intégral) — corrigeable par script avec
     validation d'échantillon, pas par relecture ligne à ligne des 216 cas.
   - **Passe 2 — revue éditoriale qualitative**, par ordre de priorité : (a) `criticality =
     critical` d'abord (49 questions, le plus haut risque réglementaire si le contenu est
     mauvais), (b) puis les référentiels avec le taux de défaut le plus élevé (ISO14971 67 %,
     FDA_QMSR 60 %), (c) puis le reste par référentiel.
2. **Assistance IA encadrée, jamais IA seule** : proposition de reformulation par IA, ancrée
   explicitement sur le texte réglementaire réel (article/annexe cité), jamais sur la
   reformulation existante seule (pour ne pas perpétuer une erreur en la paraphrasant) —
   validation humaine ligne par ligne obligatoire avant toute écriture, exactement comme pour la
   table de correspondance des rôles économiques plus tôt dans ce projet.
3. **Aucune exigence nouvelle inventée** : toute reformulation doit rester strictement bornée au
   contenu déjà présent dans `expectedEvidence`/`risk`/`article` de la question d'origine, jamais
   ajouter une exigence qui n'y figurait pas.
4. **Traçabilité obligatoire** : conserver `questionKey` inchangé pour toute question réécrite
   (préserve l'historique des `audit_responses`, rappel de la contrainte B), et journaliser
   ancien texte → nouveau texte pour audit a posteriori.

## J. Cadrage de l'ampleur réelle (analyse mécanique/éditorial + source amont + charge)

Analyse demandée avant tout choix de méthode. Toujours aucune écriture — analyse seule.

### J.1 Sur les 216 questions atteintes : combien sont réparables par script ?

**Méthode :** pour chaque question tronquée, extraction du fragment de `questionText` juste
avant le "…", et test de correspondance avec le contenu du champ `title` de la **même ligne**
(qui n'est jamais tronqué — vérifié : 0 des 216 lignes n'a de troncature dans `title`,
`expectedEvidence`, `conformityCriteria` ou `risk`). Si le fragment tronqué est un préfixe exact
du contenu de `title` (après retrait du préfixe "Art. X — " / "7.5.2 — " etc.), la question est
reconstructible mécaniquement : on régénère la phrase avec le `title` complet, sans troncature
artificielle.

| Catégorie | Nombre | % de 216 | Traitement |
|---|---|---|---|
| **Mécanique** — fragment tronqué = préfixe exact du `title` complet de la même ligne | **147** | 68 % | Script : réinjecter le `title` complet dans le même gabarit, aucune rédaction humaine |
| **Manuel** — ne correspond pas à une simple troncature du `title` | **69** | 32 % | Lecture humaine requise |

**Répartition du "manuel" par référentiel** (le "mécanique" en creux) :

| Référentiel | Mécanique | Manuel | Total tronqué |
|---|---|---|---|
| MDSAP | 33 | 2 | 35 |
| MDR | 28 | 6 | 34 |
| ISO13485 | 27 | 6 | 33 |
| FDA_QMSR | 19 | 7 | 26 |
| ISO14971 | 18 | **27** | 45 |
| IVDR | 15 | 7 | 22 |
| ISO9001 | 7 | **14** | 21 |

**ISO14971 et ISO9001 concentrent le gros du "manuel"** (27 et 14 sur 69, soit 59 % du total à
elles deux) — cohérent avec leur taux de troncature déjà le plus élevé trouvé en section I.2.

**Détail des 69 "manuels", deux sous-causes distinctes trouvées en creusant (pas une seule) :**
- **≈19 sont en fait un bug de connecteur, pas une vraie troncature de contenu** : le `title`
  complet est bel et bien présent en entier dans le texte, mais suivi d'un "est…" mal formé avant
  la clôture fixe "est la preuve." (ex. `Q-13485-PP-4306` : "...maîtrise de contamination
  **est…** est la preuve." — le titre est intégral, c'est juste un verbe de liaison manquant).
  **Aucune perte de contenu ici non plus** — correction mécanique par suppression du fragment
  cassé ("est…"), pas de rédaction nécessaire.
- **≈19 sont de vraies paraphrases raccourcies** (pas une troncature mécanique du `title`,  ex.
  `Q-FDA-N-2561` : titre "demande de classification De Novo (FD&C 513(f)(2)) pour dispositif
  nouveau à risque faible/modéré sans predicate légalement commercialisé..." → texte "voie De
  Novo pour dispositif nouveau à risque faible/modéré sans…" — un résumé différent du titre, pas
  un simple préfixe) — **celles-ci nécessitent une vraie rédaction humaine**, la variable
  d'origine (probablement un "titre court" distinct, non conservé dans le JSON final) n'existe
  plus.
- Le reste (~31) n'a pas été sous-catégorisé plus finement — nécessite un passage script
  supplémentaire pour affiner, mais reste dans le tas "manuel" par prudence.

**Chiffre demandé, révisé à la baisse par rapport à une lecture rapide : sur 216 questions
atteintes, au moins 147 (68 %) — et probablement ~166 (77 %) une fois le sous-cas "connecteur
cassé" ajouté — sont réparables par script sans aucune rédaction humaine. Le vrai résidu
éditorial (paraphrase à refaire) est de l'ordre de 50-69 questions, pas 216.**

### J.2 La source amont existe-t-elle ?

**Oui, pour la majorité — dans la même ligne de la base, pas ailleurs.** Le `title` de chaque
question est **toujours complet, jamais tronqué** (vérifié : 0/473). C'est la source directe
pour les 147 (+ ~19) cas mécaniques ci-dessus — **"revue éditoriale" devient "régénération
depuis `title`"** pour ces cas, exactement comme tu l'anticipais.

**Pour les ~50-69 cas de vraie paraphrase**, en revanche, la source courte n'existe nulle part
ailleurs que je puisse trouver :
- **Fichier source `questions_import_ready.json`** : structure plate, un objet complet par
  question, aucun champ "titre court" ou "label" distinct de `title` — la variable utilisée pour
  générer ces paraphrases n'a pas été conservée telle quelle.
- **Historique git** : un seul commit a jamais touché ce fichier (`60fda8a3`), aucune version
  antérieure à comparer.
- **Champs riches de la même ligne** (`expectedEvidence`, `conformityCriteria`, `risk`,
  `officialSource`) : présents et complets (aucune troncature), et **utilisables comme matière
  première pour la reformulation humaine/IA-assistée** de ces ~50-69 cas — pas une source
  "prête à copier", mais un point d'ancrage réglementaire fiable pour rédiger une reformulation
  fidèle sans inventer.

**Conclusion : la "reconstruction depuis la source" s'applique à 68-77 % des 216, pas à la
totalité — mais elle s'applique bien à la majorité, ce qui change effectivement la nature du
travail restant d'une réécriture générale à une réécriture ciblée sur un sous-ensemble plus
restreint.**

### J.3 Charge estimée de la passe éditoriale, par référentiel

**Hypothèse de méthode (à valider) : rédaction assistée par IA (ancrée sur `title` +
`expectedEvidence` + `officialSource` de la ligne), validation/correction humaine ligne par
ligne — pas une rédaction manuelle from scratch.** Sans cette assistance, doubler les estimées
ci-dessous.

Périmètre de la charge éditoriale réelle (après déduction du mécanique) :
- 69 questions à texte cassé nécessitant une vraie reformulation (J.1)
- 71 groupes de la zone intermédiaire nécessitant une lecture + décision fusion/conservation
  (section H) — **NB : chevauchement partiel possible avec les 69 ci-dessus si une question
  cassée appartient aussi à un groupe divergent ; traité comme une seule revue combinée dans ce
  cas, pas additionné deux fois dans le temps réel**
- 21 groupes à criticité divergente (19 tranchables rapidement, 2 nécessitant réflexion — section
  D.1/G)

| Référentiel | Textes cassés à réécrire | Groupes zone intermédiaire | Total items à traiter | Temps estimé |
|---|---|---|---|---|
| ISO14971 | 27 | 13 | 40 | ~6 h |
| MDR | 6 | 14 | 20 | ~3 h |
| IVDR | 7 | 12 | 19 | ~2,75 h |
| ISO13485 | 6 | 12 | 18 | ~2,5 h |
| ISO9001 | 14 | 2 | 16 | ~2,25 h |
| MDSAP | 2 | 14 | 16 | ~2,25 h |
| FDA_QMSR | 7 | 4 | 11 | ~1,5 h |
| **Total** | **69** | **71** | **140** | **~20,25 h** |

Temps par item estimé à ~8-9 minutes en moyenne (proposition IA + lecture + décision + correction
éventuelle), incluant le changement de contexte entre items. **Plus, hors référentiel (coût fixe
partagé, pas par référentiel) :**
- Construction + test du script de réparation mécanique (147+19 cas) : ~3-4 h
- Validation par échantillon du résultat mécanique (pas ligne à ligne, un échantillon
  représentatif par référentiel avant application générale) : ~2 h
- Passe de vérification finale post-corrections (comptages, un test de création d'audit par
  référentiel dans l'app) : ~2-3 h

**Total estimé : ~27-29 heures de travail effectif, soit environ 3,5 à 4 jours ouvrés à temps
plein — pas des semaines.** C'est un chantier court, à condition de garder l'assistance IA
encadrée comme méthode (une rédaction 100 % manuelle sans assistance porterait ça plutôt vers
6-8 jours ouvrés). ISO14971 concentre à elle seule presque un quart de la charge éditoriale — si
tu veux un gain visible rapide sur un seul référentiel avant de t'engager sur le reste, c'est
celui à traiter en premier après la passe mécanique.

## F. Ce qui reste

Le sous-ensemble exact des ~31 questions "manuel non sous-catégorisé" (J.1) n'a pas été affiné
plus finement faute de script supplémentaire — à faire si tu veux une répartition exacte
connecteur-cassé/paraphrase avant de lancer la passe éditoriale. Sinon, cadrage complet livré :
prêt pour ta décision sur le lancement de la passe mécanique (gain rapide, quasi sans risque) et
l'organisation de la passe éditoriale (méthode IA-assistée + validation humaine, ~27-29h,
ISO14971 en premier).
