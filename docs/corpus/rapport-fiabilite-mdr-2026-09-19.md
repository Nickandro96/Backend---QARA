# Rapport de fiabilité du corpus MDR — 2026-09-19

## Périmètre et garde-fous

Les contrôles ont été exécutés sur la base Railway de production avec des requêtes `SELECT` uniquement. Aucune question n'a été modifiée, désactivée ou insérée. Les résultats ci-dessous sont des candidats à une revue éditoriale humaine : la détection par préfixe commun peut produire des rapprochements qui ne sont pas de vrais doublons réglementaires.

## Paires candidates au doublonnage

La requête prescrite a retourné 5 lignes :

| Question | Candidate associée | Analyse préalable |
|---|---|---|
| `Q-MDR-S-1304` | `Q-MDR-EC-5618` | Même gabarit de formulation, objets réglementaires différents ; ne pas désactiver automatiquement. |
| `Q-MDR-P-2575` | `Q-MDR-RP-7041` | Même gabarit de formulation, PMS système vs rapport PMS ; ne pas désactiver automatiquement. |
| `Q-MDR-TR-8417` | `Q-MDR-AIF-2405` | Même gabarit de formulation, tendance vs investigation d'incident ; ne pas désactiver automatiquement. |
| `Q-MDR-VIGF-6541` | `Q-MDR-TR-8417` | Thèmes proches de vigilance, mais obligations distinctes ; revue éditoriale requise. |
| `Q-MDR-VIGF-6541` | `Q-MDR-AIF-2405` | Thèmes proches de vigilance, mais déclaration vs investigation ; revue éditoriale requise. |

Conclusion : la requête démontre surtout une redondance de gabarits. Elle ne suffit pas à autoriser une désactivation. Les cinq paires doivent être comparées sur l'article, la preuve attendue et le rôle économique avant décision.

## Questions actives sans aucune réponse

La requête prescrite a retourné 5 questions :

| Question | Processus | Criticité | Début de l'intitulé observé |
|---|---:|---|---|
| `Q-MDR-EO-7256` | 2 | medium | Prenez un dossier de lot récent : montrez-moi comment enregistrement fabricant/mandataire/importateur… |
| `Q-MDR-M-1555` | 2 | medium | Montrez-moi, sur un cas réel récent, comment mandat écrit et obligations du mandataire UE maîtrisés… |
| `Q-MDR-AIF-2405` | 10 | critical | Montrez-moi, sur un cas daté, comment vous respectez investigation, analyse et suivi des incidents graves… |
| `Q-MDR-I-5980` | 12 | medium | Montrez-moi, sur un cas réel récent, comment vérifications importateur avant mise sur le marché… |
| `Q-MDR-I-6277` | 12 | medium | Déroulez un cas concret concerné par vérifications importateur avant mise sur le marché et traçabilité… |

Ces questions sont seulement candidates à reformulation ou désactivation. Leur absence de réponse ne prouve pas qu'elles sont inutiles : elle peut venir du périmètre des audits réalisés. Aucune désactivation n'est proposée sans validation métier explicite.

## Questions manquantes proposées

Les six clés ci-dessous ont été vérifiées absentes de production (0 ligne). Les processus ont également été confirmés en production.

| questionKey | questionText | referentialId | criticality | processSlug | isActive | economicRole |
|---|---|---:|---|---|---|---|
| `Q-MDR-RISK-ISO14971-2026` | Votre analyse de risques fait-elle référence à la norme ISO 14971:2019 et à ses annexes informatives ZA et ZB ? | 3 | high | `risk_management` | true | fabricant |
| `Q-MDR-RISK-BENEFIT-2026` | Le rapport bénéfice/risque est-il documenté et justifié pour chaque destination d'usage ? | 3 | critical | `risk_management` | true | fabricant |
| `Q-MDR-PMS-PSUR-2026` | Avez-vous établi un PSUR (Periodic Safety Update Report) pour vos dispositifs classe IIa et supérieure ? | 3 | critical | `pms_pmcf` | true | fabricant |
| `Q-MDR-PMS-PSR-2026` | Votre PSR (Post-Market Summary Report) est-il mis à jour annuellement pour vos dispositifs classe I ? | 3 | high | `pms_pmcf` | true | fabricant |
| `Q-MDR-UDI-EUDAMED-2026` | L'UDI-DI de chaque dispositif est-il enregistré dans EUDAMED ? | 3 | high | `traceability_udi` | true | fabricant |
| `Q-MDR-UDI-AIDC-HRI-2026` | Le support UDI physique (étiquette) est-il conforme aux exigences de format (AIDC + HRI) ? | 3 | high | `traceability_udi` | true | fabricant |

Le script préparé, mais non exécuté, se trouve dans `scripts/corpus/proposals/add-mdr-reliability-questions.sql`.

## Décision requise

1. Faire valider les six formulations et criticités par un expert MDR.
2. Décider séparément du sort des cinq questions sans réponse.
3. Ne désactiver aucune paire candidate avant une comparaison de la base réglementaire et des preuves attendues.
4. Exécuter le SQL d'insertion uniquement après validation explicite et sauvegarde de la base.
