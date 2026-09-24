# Désactivation non destructive des questions en doublon

## Décision

Aucune question n'est supprimée et aucun `questionKey` n'est modifié. Les réponses d'audit, actions CAPA et rapports historiques restent rattachés à leur clé d'origine.

Le lot 1 validé est enregistré dans `approved-retirements-lot-1.json`. Ce fichier est documentaire et n'a aucun effet sur l'application tant que l'implémentation ci-dessous n'est pas validée et déployée.

## Modèle proposé

Migration additive uniquement :

- `questions.isActive BOOLEAN NOT NULL DEFAULT TRUE`
- `questions.supersededByQuestionKey VARCHAR(255) NULL`
- index sur `isActive`
- aucun `DELETE`, aucune modification de `questionKey`

Le corpus source porte la même information dans un registre versionné. L'import reste idempotent et ne réactive pas silencieusement une question remplacée.

## Comportement attendu

### Nouveaux audits

Les listes et tirages de nouvelles questions ne sélectionnent que `isActive = TRUE`. Une question remplacée n'est donc plus posée et ne pèse plus dans le score.

### Audits existants

Toute question déjà référencée par `audit_responses.questionKey` reste lisible, même inactive. Les rapports historiques doivent charger l'union :

1. des questions actives du périmètre ;
2. des questions inactives effectivement référencées par les réponses de l'audit consulté.

Aucune réponse existante n'est déplacée vers la clé canonique : cela modifierait l'histoire de l'audit.

### Import

L'import applique explicitement l'état du registre :

- clé canonique ou non listée : active ;
- clé remplacée : inactive et `supersededByQuestionKey` renseigné.

Le garde-fou `IMPORT_CORPUS_ON_RELEASE` reste inchangé.

## Contrôles obligatoires avant fusion

- 473 lignes et 473 clés uniques après migration ;
- 8 clés du lot 1 présentes mais inactives ;
- 0 clé orpheline dans `audit_responses` et `capa_actions` ;
- un nouvel audit n'affiche aucune clé inactive ;
- un audit historique contenant une clé inactive reste consultable et exportable ;
- score calculé uniquement sur les questions réellement présentées ;
- import exécuté deux fois sur une base de test : résultat identique.

## Séquençage

1. Adapter les lectures et ajouter les tests sur une branche.
2. Préparer la migration additive et les requêtes avant/après.
3. Contrôle utilisateur du lot et de la migration.
4. Sauvegarde de production.
5. Déploiement backend.
6. Application du lot approuvé.
7. Vérifications fonctionnelles et SQL.

Aucune étape de production n'est autorisée pendant la phase de préparation.
