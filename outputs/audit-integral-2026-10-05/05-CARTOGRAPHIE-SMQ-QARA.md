# Cartographie SMQ QARA

Chaîne cible : **Exigence → Processus → Risque → Question → Preuve → Constat → CAPA → Contrôle d'efficacité → Indicateur → Revue de direction**.

## État prouvé

Le schéma et les tests couvrent les questions, réponses, constats, CAPA, rapports, scoring et certains agrégats analytiques. La matrice source associe 473 questions à 233 couples référentiel–processus.

## Ruptures à traiter

- version du référentiel non structurée uniformément dans le JSON source ;
- sous-processus souvent non explicite ;
- règle d'applicabilité parfois implicite ;
- absence de preuve ici d'un propriétaire de processus pour chaque processus ;
- lien risque–PMS–CAPA non démontré bout en bout en production ;
- contrôle d'efficacité protégé par tests unitaires, mais non rejoué sur trois organisations live ;
- indicateurs analytiques disponibles, mais décision de revue de direction non matérialisée systématiquement.
