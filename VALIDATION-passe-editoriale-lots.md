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

## Lot 1 — ISO 14971 §7.1–7.2 (6 questions)

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
- approuvé sous réserve de remplacer « vérification indépendante » par « vérification distincte »
  dans Q-14971-MŒC-8079 ;
- corrections demandées, à détailler par `questionKey`.

Aucune approbation de ce lot ne vaut approbation des autres lots.
