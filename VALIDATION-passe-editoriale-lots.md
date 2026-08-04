# QARA — Validation de la passe éditoriale par lots

## Statut

Document de contrôle réglementaire. Aucun contenu de ce document ne doit être déployé ou appliqué
en base avant validation explicite du lot concerné.

Source de comparaison :
- état actuellement déployable : `claude/qara-compliance-audit-qitbxl` ;
- propositions : `claude/qara-corpus-mechanical-pass-x12719` ;
- source officielle publique : ISO 14971:2019, édition 3, confirmée en 2025
  (https://www.iso.org/standard/72704.html) ;
- contrôle détaillé des paragraphes : texte NF EN ISO 14971:2019 déclaré vérifié dans le corpus.
  La page ISO publique ne reproduit pas le texte normatif complet.

---

## Lot 1 — ISO 14971 §7.1–7.2 (6 questions) — ✅ VALIDÉ LE 2026-08-04

### 1. Q-14971-MR-4038

- Référence : 7.1 — Maîtrise des risques
- Criticité : high
- Texte production : « Choisissons un danger réel concerné par identification et sélection des
  mesures de maîtrise des risques :… estimation, sa maîtrise et le risque résiduel retenu. »
- Proposition : « Choisissons un danger réel concerné par l'analyse des options de maîtrise des
  risques et la détermination des mesures appropriées pour ramener ce risque à un niveau
  acceptable : déroulez son identification, son estimation, sa maîtrise et le risque résiduel
  retenu. »
- Ancrage : titre 7.1 ; dossier de gestion des risques ; décision documentée et approuvée ;
  traçabilité danger → estimation → maîtrise → risque résiduel.
- Nature : reconstruction de troncature, sans changement de `questionKey`.

### 2. Q-14971-MR-9272

- Référence : 7.1 — Maîtrise des risques
- Criticité : high
- Texte production : identique et tronqué comme Q-14971-MR-4038.
- Proposition : « Montrez-moi comment l'analyse des options de maîtrise des risques et la
  détermination des mesures appropriées pour ramener ce risque à un niveau acceptable relie votre
  analyse de risques à une décision concrète sur le produit. »
- Ancrage : même exigence 7.1 ; angle distinct centré sur la décision produit et sa traçabilité.
- Nature : reconstruction éditoriale ; conservation comme sonde distincte à réexaminer lors du
  chantier des groupes divergents.

### 3. Q-14971-AOM-0896

- Référence : 7.1 — Analyse des options de maîtrise
- Criticité : high
- Texte production : « Choisissons un danger réel concerné par priorisation des options de maîtrise
  du risque selon approche… : déroulez son identification, son estimation, sa maîtrise et le risque
  résiduel retenu. »
- Proposition : « Choisissons un danger réel concerné par l'ordre de priorité des options de
  maîtrise du risque — sécurité inhérente à la conception et à la fabrication, puis mesures de
  protection, puis information pour la sécurité — : déroulez son identification, son estimation,
  sa maîtrise et le risque résiduel retenu. »
- Ancrage : titre 7.1 ; ordre des options de maîtrise ; dossier de risques et justification du choix.
- Nature : reconstruction de troncature.

### 4. Q-14971-AOM-5470

- Référence : 7.1 — Analyse des options de maîtrise
- Criticité : high
- Texte production : « Montrez-moi comment priorisation des options de maîtrise du risque selon
  approche… relie votre analyse de risques à une décision concrète sur le produit. »
- Proposition : « Montrez-moi comment l'ordre de priorité des options de maîtrise du risque —
  sécurité inhérente à la conception, mesures de protection, puis information pour la sécurité —
  relie votre analyse de risques à une décision concrète sur le produit. »
- Ancrage : même exigence 7.1 ; angle décisionnel distinct.
- Nature : reconstruction de troncature.

### 5. Q-14971-AOM-2955

- Référence : 7.1 — Analyse des options de maîtrise
- Criticité : high
- Texte production : même troncature générique que Q-14971-AOM-0896.
- Proposition : « Déroulez un cas concret concerné par l'ordre de priorité des options de maîtrise
  du risque — sécurité inhérente à la conception et à la fabrication, mesures de protection,
  information pour la sécurité — : quelle décision, par qui, sur quelle preuve, avec quel contrôle
  d'efficacité ? »
- Ancrage : ordre des options ; preuve, approbation et efficacité sur un cas réel.
- Nature : reconstruction éditoriale ; angle de preuve/efficacité.

### 6. Q-14971-MŒC-8079

- Référence : 7.2 — Mise en œuvre des mesures de maîtrise
- Criticité : medium
- Texte production : « Montrez-moi, sur un cas réel récent, comment mise en œuvre et vérification
  des mesures de maîtrise sélectionnées… est la preuve. »
- Proposition : « Montrez-moi, sur un cas réel récent, comment la mesure de maîtrise retenue a fait
  l'objet des deux vérifications distinctes exigées par la norme : la vérification que la mesure a
  bien été mise en œuvre, et la vérification indépendante de son efficacité. »
- Ancrage : titre 7.2 ; preuves distinctes de mise en œuvre et d'efficacité.
- Point à valider explicitement : le mot « indépendante » est plus fort que « distincte ». Confirmer
  qu'une indépendance organisationnelle est réellement exigée par le texte applicable ; sinon
  remplacer par « distincte » pour éviter une sur-exigence.
- Nature : reconstruction avec réserve réglementaire.

## Décision attendue sur le lot 1

- approuvé sans modification ;
- **Décision reçue : approuvé avec remplacement de « vérification indépendante » par « vérification distincte » dans Q-14971-MŒC-8079. Correction appliquée aux sources et SQL préparatoires ; aucun déploiement.**
- corrections demandées, à détailler par `questionKey`.

Aucune approbation de ce lot ne vaut approbation des autres lots.


---

## Lot 2 — ISO 14971 §7.4–7.6 (6 questions) — ✅ VALIDÉ LE 2026-08-04 EN LANGAGE SIMPLE

### 1. Q-14971-ABR-2180

- Référence : 7.4 — Analyse bénéfice-risque
- Criticité : high
- Texte production : « Choisissons un danger réel concerné par analyse bénéfice-risque lorsque le risque résiduel n’est pas… : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu. »
- Proposition : « Choisissons un danger réel dont le risque résiduel individuel n'est pas acceptable et pour lequel aucune réduction supplémentaire n'est réalisable : déroulez l'analyse bénéfice-risque menée, son identification, son estimation, sa maîtrise et le risque résiduel retenu. »
- Ancrage : titre et référence 7.4 ; décision bénéfice-risque documentée ; risque résiduel individuel.
- Nature : reconstruction de troncature.

### 2. Q-14971-ABR-5814

- Référence : 7.4 — Analyse bénéfice-risque
- Criticité : high
- Texte production : « Montrez-moi comment analyse bénéfice-risque lorsque le risque résiduel n’est pas… relie votre analyse de risques à une décision concrète sur le produit. »
- Proposition : « Montrez-moi comment l'analyse bénéfice-risque, menée lorsque le risque résiduel individuel n'est pas acceptable et qu'aucune réduction supplémentaire n'est réalisable, relie votre analyse de risques à une décision concrète sur le produit. »
- Ancrage : même exigence ; angle centré sur la décision produit.
- Nature : reconstruction de troncature.

### 3. Q-14971-ABR-6111

- Référence : 7.4 — Analyse bénéfice-risque
- Criticité : high
- Texte production : même texte tronqué que Q-14971-ABR-2180.
- Proposition : « Déroulez un cas concret où le risque résiduel individuel n'a pas été jugé acceptable malgré l'impossibilité de réduction supplémentaire : quelle décision, par qui, sur quelle preuve, avec quel contrôle d'efficacité ? »
- Ancrage : décision, approbation, preuves et contrôle d'efficacité.
- Nature : reconstruction éditoriale ; sonde de traçabilité décisionnelle.

### 4. Q-14971-RIC-1049

- Référence : 7.5 — Risques découlant des mesures de maîtrise
- Criticité : high
- Texte production : « Choisissons un danger réel concerné par évaluation des nouveaux risques introduits par les mesures de… estimation, sa maîtrise et le risque résiduel retenu. »
- Proposition : « Choisissons un danger réel concerné par l'examen des risques découlant des mesures de maîtrise retenues — nouveaux dangers ou situations dangereuses introduits, ou impact sur des risques déjà estimés : déroulez son identification, son estimation, sa maîtrise et le risque résiduel retenu. »
- Ancrage : titre et référence 7.5 ; nouveaux dangers/situations dangereuses et modification des risques existants.
- Nature : reconstruction de troncature.

### 5. Q-14971-RIC-7118

- Référence : 7.5 — Risques découlant des mesures de maîtrise
- Criticité : high
- Texte production : même texte tronqué que Q-14971-RIC-1049.
- Proposition : « Montrez-moi comment l'examen des risques découlant des mesures de maîtrise retenues — nouveaux dangers ou impact sur des risques déjà estimés — relie votre analyse de risques à une décision concrète sur le produit. »
- Ancrage : même exigence ; angle de décision produit.
- Nature : reconstruction éditoriale.

### 6. Q-14971-CM-1778

- Référence : 7.6 — Complétude de la maîtrise
- Criticité actuelle : low
- Texte production : « Montrez-moi, sur un cas réel récent, comment vérification que toutes les situations dangereuses identifiées sont… est la preuve. »
- Proposition : « Montrez-moi, sur un cas réel récent, comment vous vérifiez que toutes les situations dangereuses identifiées ont été traitées et que toutes les activités de gestion des risques prévues sont achevées. »
- Ancrage : titre et référence 7.6 ; preuve de complétude des activités prévues.
- Nature : reconstruction de troncature.
- Réserve hors reformulation : la criticité `low` paraît potentiellement sous-évaluée pour une exigence de complétude de la maîtrise des risques. Ne pas la changer dans ce lot ; la traiter avec les 21 criticités divergentes au point de contrôle dédié.

## Décision du lot 2

Validé en langage simple le 2026-08-04. Les six formulations approuvées ont été appliquées au JSON, aux données éditoriales et aux SQL préparatoires. Aucun déploiement ni SQL de production.

Aucune approbation de ce lot ne vaut approbation des lots suivants.


---

## Révision en langage simple du lot 1 — ✅ VALIDÉE LE 2026-08-04

Cette révision remplace les formulations longues précédemment approuvées. Elle ne sera appliquée
qu'après accord explicite.

1. **Q-14971-MR-4038 — 7.1**  
   « Prenez un risque réel. Quelles mesures avez-vous envisagées, laquelle avez-vous retenue et pourquoi ? Montrez que le risque restant est acceptable. »

2. **Q-14971-MR-9272 — 7.1**  
   « Montrez-moi un exemple où l'analyse des risques a conduit à une décision ou à une modification du dispositif. Quelle preuve garde la trace de cette décision ? »

3. **Q-14971-AOM-0896 — 7.1**  
   « Pour un risque réel, avez-vous d'abord cherché à le réduire par la conception, puis par une protection, et enfin par une information de sécurité ? Montrez votre choix. »

4. **Q-14971-AOM-5470 — 7.1**  
   « Montrez-moi un exemple où vous avez suivi l'ordre prévu pour réduire un risque. Pourquoi avez-vous retenu cette solution ? »

5. **Q-14971-AOM-2955 — 7.1**  
   « Qui a choisi la mesure utilisée pour réduire le risque ? Montrez les preuves utilisées et comment son efficacité a été vérifiée. »

6. **Q-14971-MŒC-8079 — 7.2**  
   « Pour une mesure destinée à réduire un risque, montrez qu'elle a bien été mise en place et qu'elle réduit réellement ce risque. »

### Décision

Révision simple approuvée le 2026-08-04 et appliquée au JSON, aux données éditoriales et aux SQL préparatoires. Aucun déploiement ni SQL de production.


---

## Lot 3 — ISO 14971 §8, §9 et §10.3 (6 questions) — ✅ VALIDÉ LE 2026-08-04

1. **Q-14971-RRG-7446 — §8 — critical**  
   Production tronquée : évaluation de l'acceptabilité du risque résiduel global.  
   Proposition simple : « Avant la mise sur le marché, comment avez-vous vérifié que l'ensemble des risques restant sur le dispositif était acceptable ? Montrez le résultat de cette évaluation. »

2. **Q-14971-RRG-3515 — §8 — critical**  
   Production tronquée : même exigence.  
   Proposition simple : « Qui a validé que l'ensemble des risques restant sur le dispositif était acceptable ? Montrez les données utilisées et la décision prise. »

3. **Q-14971-RGR-9160 — §9 — high**  
   Production tronquée : revue de gestion des risques avant libération commerciale.  
   Proposition simple : « Pour le dernier dispositif libéré, montrez la revue des risques réalisée avant sa libération et la conclusion obtenue. »

4. **Q-14971-RGR-3091 — §9 — high**  
   Production tronquée : même exigence.  
   Proposition simple : « Qui a autorisé la libération du dispositif après la revue des risques ? Montrez les preuves et l'approbation. »

5. **Q-14971-RIPP-2086 — §10.3 — high**  
   Production tronquée : examen des informations de production et post-production.  
   Proposition simple : « Prenez une réclamation, un retour du terrain ou une nouvelle publication. Comment avez-vous vérifié si cette information révélait un nouveau risque ou modifiait un risque connu ? »

6. **Q-14971-RIPP-4764 — §10.3 — high**  
   Production tronquée : même exigence.  
   Proposition simple : « Montrez-moi un exemple où une information venant du terrain a conduit à modifier le dossier de risques ou le dispositif. »

### Décision du lot 3

Validé le 2026-08-04 et appliqué au JSON, aux données éditoriales et aux SQL préparatoires. Aucun déploiement ni SQL de production.


---

## Lot 4 — ISO 14971 §10.4 et risques d'utilisation/logiciel (7 questions) — ✅ VALIDÉ LE 2026-08-04

1. **Q-14971-APP-5733 — §10.4 — high**  
   « Prenez une information reçue après la production qui concernait la sécurité. Quelles actions avez-vous prises sur le dossier de risques et sur les dispositifs déjà sur le marché ? »

2. **Q-14971-APP-7458 — §10.4 — high**  
   « Montrez-moi un exemple où une information venant du terrain a conduit à une décision sur le dispositif. Qui a décidé et pourquoi ? »

3. **Q-14971-APP-9033 — §10.4 — high**  
   « Après une alerte de sécurité venant du terrain, comment avez-vous vérifié que les actions prises étaient efficaces ? Montrez-moi un cas réel. »

4. **Q-14971-LRU-1486 — §5.4 avec §5.2 — high**  
   « Prenez une erreur d'utilisation possible du dispositif. Comment l'avez-vous identifiée et comment avez-vous réduit le risque associé ? »

5. **Q-14971-LRU-3545 — §5.4 avec §5.2 — high**  
   « Comment prenez-vous en compte les mauvaises utilisations que vous pouvez raisonnablement prévoir ? Montrez-moi un exemple. »

6. **Q-14971-LRL-8098 — §5.4 avec domaine d'application — high**  
   « Prenez un risque lié au logiciel ou à la sécurité des données. Montrez comment vous l'avez identifié, évalué et réduit. »

7. **Q-14971-LRL-4167 — §5.4 avec domaine d'application — high**  
   « Comment vérifiez-vous que les risques liés au logiciel et à la cybersécurité sont inclus dans votre analyse des risques ? Montrez-moi un exemple. »

### Décision du lot 4

Validé le 2026-08-04 et appliqué au JSON, aux données éditoriales et aux SQL préparatoires. ISO 14971 : 25/25 finalisées en langage simple. Aucun déploiement ni SQL de production.


---

# Reformulations restantes — langage simple

## Lot 5 — ISO 9001 (6 questions)

1. **Q-9001-PI-3467 — parties intéressées**  
   « Quelles personnes ou organisations peuvent influencer votre système qualité, et qu'attendent-elles de vous ? Montrez comment vous suivez l'évolution de leurs attentes. »

2. **Q-9001-RO-2538 — risques et opportunités**  
   « Prenez un risque ou une opportunité pour votre système qualité. Qu'avez-vous décidé de faire et comment avez-vous vérifié que cela fonctionnait ? »

3. **Q-9001-RO-9521 — intégration des actions**  
   « Comment les actions liées aux risques et aux opportunités sont-elles intégrées au travail quotidien ? Montrez-moi un exemple. »

4. **Q-9001-CLO-5514 — contexte et climat**  
   « Quels changements internes ou externes peuvent affecter votre système qualité ? Montrez comment vous avez déterminé si le changement climatique est un sujet important pour votre activité. »

5. **Q-9001-PS-7808 — périmètre du système qualité**  
   « Quels sites, activités, produits et services sont couverts par votre système qualité ? Montrez comment vous avez justifié ce qui n'est pas couvert. »

6. **Q-9001-L-0975 — engagement de la direction**  
   « Comment la direction montre-t-elle qu'elle est responsable du système qualité ? Donnez un exemple de décision prise ou de ressource accordée. »

Référence officielle : ISO 9001:2015 et amendement ISO 9001:2015/Amd 1:2024, publié en février 2024. Une nouvelle édition ISO 9001 est en cours de publication mais n'est pas encore la version publiée applicable au moment de cette validation.

## Lot 6 — IVDR (3 questions)

1. **Q-IVDR-MSMI-5641 — mise sur le marché**  
   « Avant de mettre un DIV sur le marché, quels contrôles réalisez-vous pour vérifier qu'il respecte l'IVDR et qu'il est utilisé comme prévu ? Montrez un dossier réel. »

2. **Q-IVDR-PI-0993 — PSUR, article 81**  
   « Pour votre dernier rapport périodique de sécurité applicable, montrez qu'il a été mis à jour, approuvé et transmis comme prévu. »

3. **Q-IVDR-GIUI-6261 — étiquetage et notice**  
   « Prenez un DIV commercialisé. Montrez que son étiquette et sa notice sont lisibles, conformes et approuvées avant utilisation. »

## Lot 7 — FDA (7 questions)

1. **Q-FDA-5K-1069 — 510(k)**  
   « Pour un dossier 510(k) récent, pourquoi avez-vous choisi le dispositif de comparaison et quelles preuves montrent que votre dispositif est aussi sûr et efficace ? »

2. **Q-FDA-N-2561 — De Novo**  
   « Pour un dossier De Novo, pourquoi cette voie a-t-elle été choisie et pourquoi aucun dispositif de comparaison adapté n'existait-il ? »

3. **Q-FDA-N-1933 — décision De Novo**  
   « Qui a validé le choix de la voie De Novo ? Montrez l'analyse des risques et les preuves utilisées pour cette décision. »

4. **Q-FDA-N-6492 — résultat De Novo**  
   « Pour un dossier De Novo accepté, montrez la décision de la FDA et les contrôles particuliers que vous devez maintenant respecter. »

5. **Q-FDA-SQ-5662 — fournisseur critique**  
   « Prenez un fournisseur critique. Comment l'avez-vous choisi, contrôlé et suivi ? Montrez les résultats les plus récents. »

6. **Q-FDA-SC-6736 — cybersécurité avant mise sur le marché**  
   « Pour un dispositif connecté récent, montrez comment la cybersécurité a été prise en compte depuis la conception jusqu'à la validation, y compris la liste des composants logiciels. »

7. **Q-FDA-SC-4677 — vulnérabilités après mise sur le marché**  
   « Comment surveillez-vous et corrigez-vous les failles de cybersécurité après la mise sur le marché ? Montrez-moi un exemple réel. »

Références officielles vérifiées : FDA 510(k), De Novo, FD&C Act §524B et documentation FDA sur les cyber devices. Depuis le 1er octobre 2025, les demandes De Novo sont en principe soumises électroniquement avec eSTAR, sauf exemption.

## Lot 8 — MDR et MDSAP (4 questions)

1. **Q-MDR-S-3363 — SSCP**  
   « Pour un dispositif implantable ou de classe III, montrez que le résumé de sécurité et de performances est compréhensible, validé par l'organisme notifié et publié dans Eudamed. »

2. **Q-MDR-S-5062 — mise à jour du SSCP**  
   « Qui vérifie et met à jour le résumé de sécurité et de performances ? Montrez la dernière version et son approbation. »

3. **Q-MDR-SM-0792 — demande d'une autorité**  
   « Montrez la dernière demande reçue d'une autorité et votre réponse. Avez-vous fourni tous les documents et échantillons demandés dans la langue acceptée ? »

4. **Q-MDSAP-PL-3453 — liens entre processus**  
   « Montrez-moi un exemple où un problème trouvé dans un processus a conduit à contrôler plus en détail un autre processus lié. »

Références officielles vérifiées : MDR article 32 et article 10(14) ; MDSAP AU P0002, approche par processus et liens entre processus.

## Validation finale — ✅ OBTENUE LE 2026-08-04

Les lots 5 à 8 ont été validés globalement par l'utilisateur. La passe éditoriale est donc clôturée : 45/45 formulations approuvées en langage simple. Contrôle après intégration : 473 lignes, 473 `questionKey` uniques, 45 correspondances exactes entre le JSON, `editorial-pass-data.mjs`, `editorial-pass.sql` et `final-pass.sql`, 0 `questionText` avec « … », 0 `title` avec « … » et 0 titre de longueur 250. Cette validation de contenu ne vaut pas autorisation de déploiement ni d'écriture en production.
