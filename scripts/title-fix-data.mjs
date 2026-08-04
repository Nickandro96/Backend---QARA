/**
 * QARA — Correction des 24 `title` tronqués silencieusement (coupés à 250
 * caractères dans le JSON source, sans marqueur "…", donc jamais détectés
 * par le diagnostic initial qui ne cherchait que ce marqueur). Voir
 * VALIDATION-titres-tronques.md.
 *
 * 13 de ces lignes ont déjà eu leur `questionText` corrigé lors de la passe
 * éditoriale (scripts/editorial-pass-data.mjs) en s'appuyant sur le texte
 * réglementaire réel complété ici. 11 sont hors du scope des 45 : leur
 * `questionText` était déjà correct (jamais tronqué), seul `title` est
 * réparé ici.
 *
 * Complétude ancrée sur le texte réglementaire réel et vérifié — jamais
 * inventée : 21 CFR 820.35(a)/807.81(a)(3)/860 Subpart D/820.10, guidance
 * FDA « Deciding When to Submit a 510(k) for a Change to an Existing
 * Device », FD&C 524B, ISO 9001 Amd.1:2024, MDR Art. 32/10(14)/Annexe XIII,
 * MDSAP AU P0002, ISO 14971 §10.2.
 */
export const TITLE_FIXES = [
  // --- Déjà dans les 45 (questionText corrigé), title encore à réparer ---
  { questionKey: "Q-FDA-N-2561", title: "21 CFR 860 Subpart D (§§860.200–860.260) — demande de classification De Novo (FD&C 513(f)(2)) pour dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : contenu, recevabilité, délais et effets de l'ordre de classification (contrôles spéciaux applicables, base pour de futurs 510(k))." },
  { questionKey: "Q-FDA-N-1933", title: "21 CFR 860 Subpart D (§§860.200–860.260) — demande de classification De Novo (FD&C 513(f)(2)) pour dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : contenu, recevabilité, délais et effets de l'ordre de classification (contrôles spéciaux applicables, base pour de futurs 510(k))." },
  { questionKey: "Q-FDA-N-6492", title: "21 CFR 860 Subpart D (§§860.200–860.260) — demande de classification De Novo (FD&C 513(f)(2)) pour dispositif nouveau à risque faible/modéré sans predicate légalement commercialisé : contenu, recevabilité, délais et effets de l'ordre de classification (contrôles spéciaux applicables, base pour de futurs 510(k))." },
  { questionKey: "Q-FDA-SQ-5662", title: "QMSR 21 CFR 820.10 — maîtrise des achats et des fournisseurs via ISO 13485 7.4 incorporée par référence (§820.7) : critères d'évaluation/sélection/surveillance proportionnés au risque, informations d'achat, vérification du produit acheté ; les rapports de performance fournisseur documentés." },
  { questionKey: "Q-FDA-SC-6736", title: "FD&C section 524B — exigences cybersécurité pour les « cyber devices » (plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, SBOM) dans les soumissions premarket ; intégration au design control ISO 13485 7.3 (gestion du cycle de vie du logiciel)." },
  { questionKey: "Q-FDA-SC-4677", title: "FD&C section 524B — exigences cybersécurité pour les « cyber devices » (plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, SBOM) dans les soumissions premarket ; intégration au design control ISO 13485 7.3 (gestion du cycle de vie du logiciel)." },
  { questionKey: "Q-9001-CLO-5514", title: "4.1 — détermination et surveillance des enjeux externes et internes pertinents pour la finalité, l'orientation stratégique et les résultats attendus du SMQ, y compris la détermination de la pertinence des changements climatiques comme enjeu (Amd.1:2024)." },
  { questionKey: "Q-9001-PS-7808", title: "4.3 — détermination du domaine d'application du SMQ (enjeux 4.1, parties intéressées 4.2, produits/services) et justification documentée de toute exigence jugée non applicable, sans incidence sur la conformité des produits/services ni la satisfaction client." },
  { questionKey: "Q-9001-L-0975", title: "5.1 — leadership et engagement démontrés de la direction (responsabilité de l'efficacité du SMQ, intégration aux processus métiers, ressources) incluant l'orientation client (5.1.2 : exigences déterminées et satisfaites, risques/opportunités sur la conformité traités)." },
  { questionKey: "Q-MDR-S-3363", title: "Art. 32 — résumé des caractéristiques de sécurité et des performances cliniques (SSCP) pour les dispositifs implantables et de classe III (hors sur mesure et investigation), validé par l'organisme notifié et téléversé dans Eudamed, rédigé de manière compréhensible pour l'utilisateur prévu (et le grand public le cas échéant)." },
  { questionKey: "Q-MDR-S-5062", title: "Art. 32 — résumé des caractéristiques de sécurité et des performances cliniques (SSCP) pour les dispositifs implantables et de classe III (hors sur mesure et investigation), validé par l'organisme notifié et téléversé dans Eudamed, rédigé de manière compréhensible pour l'utilisateur prévu (et le grand public le cas échéant)." },
  { questionKey: "Q-MDR-SM-0792", title: "Art. 10(14) — obligation du fabricant de coopérer avec l'autorité compétente : fournir sur demande motivée toutes les informations et la documentation démontrant la conformité (dans une langue officielle acceptée), donner accès et remettre des échantillons si demandés." },
  { questionKey: "Q-MDSAP-PL-3453", title: "MDSAP AU P0002 (Audit Approach) — exploitation des liaisons inter-processus : les informations issues d'un processus (ex. NC, réclamations, données de surveillance) orientent l'échantillonnage et la profondeur d'audit des processus liés, conformément à l'approche d'audit MDSAP." },

  // --- Hors des 45 (questionText déjà correct), title seul à réparer ---
  { questionKey: "Q-FDA-CMC-0807", title: "QMSR 21 CFR 820.35(a) — exigences d'enregistrement des réclamations (revue, évaluation, investigation, UDI) en complément d'ISO 13485 8.2.2 incorporée par référence (§820.7/820.10) ; boucle avec le reporting MDR (21 CFR 803), les corrections/removals et les CAPA associées." },
  { questionKey: "Q-FDA-CMC-1104", title: "QMSR 21 CFR 820.35(a) — exigences d'enregistrement des réclamations (revue, évaluation, investigation, UDI) en complément d'ISO 13485 8.2.2 incorporée par référence (§820.7/820.10) ; boucle avec le reporting MDR (21 CFR 803), les corrections/removals et les CAPA associées." },
  { questionKey: "Q-FDA-CMC-4738", title: "QMSR 21 CFR 820.35(a) — exigences d'enregistrement des réclamations (revue, évaluation, investigation, UDI) en complément d'ISO 13485 8.2.2 incorporée par référence (§820.7/820.10) ; boucle avec le reporting MDR (21 CFR 803), les corrections/removals et les CAPA associées." },
  { questionKey: "Q-FDA-DCS-2444", title: "21 CFR 807.81(a)(3) — nouveau 510(k) requis pour tout changement/modification significatif du dispositif ou de son étiquetage susceptible d'affecter sécurité ou efficacité (guidance FDA « Deciding When to Submit a 510(k) for a Change to an Existing Device »)." },
  { questionKey: "Q-FDA-DCS-2147", title: "21 CFR 807.81(a)(3) — nouveau 510(k) requis pour tout changement/modification significatif du dispositif ou de son étiquetage susceptible d'affecter sécurité ou efficacité (guidance FDA « Deciding When to Submit a 510(k) for a Change to an Existing Device »)." },
  { questionKey: "Q-FDA-SQ-4087", title: "QMSR 21 CFR 820.10 — maîtrise des achats et des fournisseurs via ISO 13485 7.4 incorporée par référence (§820.7) : critères d'évaluation/sélection/surveillance proportionnés au risque, informations d'achat, vérification du produit acheté ; les rapports de performance fournisseur documentés." },
  { questionKey: "Q-FDA-SC-8311", title: "FD&C section 524B — exigences cybersécurité pour les « cyber devices » (plan de surveillance et de correction des vulnérabilités, processus assurant la cybersécurité, SBOM) dans les soumissions premarket ; intégration au design control ISO 13485 7.3 (gestion du cycle de vie du logiciel)." },
  { questionKey: "Q-14971-CIP-2019", title: "10.2 — collecte des informations selon les six sources exigées : production/surveillance du procédé, utilisateurs, installation/utilisation/maintenance, chaîne d'approvisionnement, informations publiques, état de l'art généralement admis (+ veille active de l'état de l'art)." },
  { questionKey: "Q-9001-OA-2015", title: "10.1 — détermination et sélection des opportunités d'amélioration et actions pour satisfaire aux exigences client et accroître la satisfaction : amélioration des produits/services (incluant besoins et attentes futurs), correction/prévention/réduction des effets indésirables, amélioration de la performance et de l'efficacité du SMQ." },
  { questionKey: "Q-MDR-S-1304", title: "Art. 32 — résumé des caractéristiques de sécurité et des performances cliniques (SSCP) pour les dispositifs implantables et de classe III (hors sur mesure et investigation), validé par l'organisme notifié et téléversé dans Eudamed, rédigé de manière compréhensible pour l'utilisateur prévu (et le grand public le cas échéant)." },
  { questionKey: "Q-MDR-DSM-0911", title: "Annexe XIII — procédure pour les dispositifs sur mesure : déclaration (section 1) accompagnant le dispositif et mise à disposition du patient/utilisateur identifié (Art. 21(2)), documentation (section 2) établie, tenue à jour et tenue à disposition des autorités compétentes." },
];
