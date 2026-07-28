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

## F. Ce qui reste (Tâches 2 et 3 — pas commencées, en attente de ta validation sur la Tâche 1)

Tâche 2 (qualité de formulation, gabarits non substitués, schéma des suffixes de `questionKey`)
et Tâche 3 (provenance du corpus, verdict revue de fond) ne sont pas traitées dans cette version
du rapport — conformément à ta demande de commencer par la Tâche 1 et de valider la stratégie
type par type avant de poursuivre. Note en passant, déjà visible dans les exemples ci-dessus
(D.1) : le motif exact que tu avais repéré sur ISO13485 ("…est la preuve.", ellipse suivie de
"est" répété) apparaît identiquement sur au moins 3 des exemples MDR cités en D.1 — ce n'est
donc pas un cas isolé, ce qui confirme ton hypothèse d'un problème systémique de gabarit, à
creuser en Tâche 2.
