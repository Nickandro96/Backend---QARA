import fs from "node:fs";
import path from "node:path";

const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const summary = JSON.parse(fs.readFileSync(path.join(out, "corpus-analysis.json"), "utf8"));
const date = "2026-10-05";
const disclaimer = `> **Statut de cette revue.** Persona experte simulée par une IA à des fins de contre-recette interne. Ce document n'est ni une approbation d'un organisme notifié, ni une certification IRCA, FDA ou MDSAP. Les constats réglementaires doivent être validés par un professionnel habilité avant décision externe.`;

const evidence = `## Base probante commune

- Code audité : backend \`63f366c\`, frontend \`06feee36\` (les SHA du prompt sont obsolètes).
- Population analysée ligne par ligne : **473 questions versionnées**, et non 426 : MDR 80, IVDR 72, FDA QMSR 43, MDSAP 74, ISO 13485 93, ISO 14971 67, ISO 9001 44.
- Fichier exhaustif : \`corpus-question-by-question.csv\` (une ligne par question).
- Contrôles automatiques : 473/473 références présentes, 473/473 preuves attendues présentes, 473/473 critères de conformité/NC présents, 473/473 explications pédagogiques présentes, 379/473 liens vers une source publique officielle détectés; ISO 13485 s'appuie sur le texte client fourni plutôt que sur une URL publique.
- Dette éditoriale : 444/473 questions utilisent au moins une formulation générique récurrente; 141 groupes de titres répétés (356 lignes) et 49 groupes de textes strictement identiques (99 lignes). Ces répétitions peuvent représenter des angles d'audit différents, mais elles doivent être justifiées par un champ « intention/variante » ou fusionnées.
- Tests backend : **186/186 réussis**. Build local non concluant : \`node_modules\` pointe vers un ancien dossier hors espace autorisé; ce défaut de reproductibilité n'est pas un échec fonctionnel de production.
- Parcours UI réellement exécutés, en lecture seule : Analytique Vue globale, Site, Processus, Référentiel, Clause, Exigence, Constat. Les changements d'onglet fonctionnent. Les valeurs affichées (Paris, Lyon, Bordeaux, Munich, Boston; constats F-2026-001…) sont des données de démonstration codées en dur dans le frontend, donc non opposables.
- Parcours non exécutés : création des audits nommés, saisie de 473 réponses, génération CAPA IA et PDF en production. Motif : le prompt ne fournit aucun mot de passe et l'audit interdit l'accès aux secrets; aucune donnée de production n'a été créée artificiellement.`;

function write(name, title, body) {
  fs.writeFileSync(path.join(out, name), `# ${title}\n\n${disclaimer}\n\n${evidence}\n\n${body.trim()}\n`, "utf8");
}

write(`RAPPORT-AMARA-DIALLO-QARA-${date}.md`, "Rapport Amara Diallo — MDR / IVDR", `
## 1. Verdict BSI simulé

| Domaine | Note | Verdict |
|---|---:|---|
| MDR | 7,6/10 | Couverture réglementaire large; spécificité classe III encore insuffisamment explicite. |
| IVDR | 7,5/10 | Bon socle, mais EQA, bases de référence et PMPF doivent devenir des sous-parcours visibles. |
| Outil | 6,8/10 | Conditionnel avant usage de préparation ON : analytique non probante et essais CAPA/PDF live non exécutés. |

Recommandation fabricant classe III : **CONDITIONNELLE**.

## 2. Évaluation exhaustive MDR (80 lignes)

Le détail question par question est dans le CSV. Points forts : Art. 10/UDI/PRRC/PMS/vigilance/GSPR/documentation technique couverts, références et preuves présentes. Points à reformuler : remplacer les canevas génériques par des questions ciblées classe III demandant CEAP, CER, PMCF, PSUR annuel, SSCP, communication ON et traçabilité implant. Ajouter un critère explicite : NC majeure si absence systémique ou impact patient/réglementaire non maîtrisé; mineure si dossier ponctuellement incomplet avec impact maîtrisé.

## 3. Évaluation exhaustive IVDR (72 lignes)

Performance evaluation, études, PMS, PSUR, vigilance et classification existent. Rendre explicites PSP/PSR, performance analytique et clinique, PMPF, EQA, représentativité des bases et RSP. Éviter les formulations transposées du MDR sans terminologie IVD.

## 4. Fonctionnalités manquantes BSI — Top 10

1. Dossier de preuves par exigence (8 h/audit, P0). 2. Mode classe III (6 h, P0). 3. Chaîne CER–PMCF–PSUR–risques (8 h, P0). 4. Grille NC NBOG (3 h, P1). 5. Échantillonnage documenté (2 h, P1). 6. Calendrier obligations classe/acteur (4 h, P1). 7. Revue ON avec verrouillage (3 h, P1). 8. Matrice GSPR (6 h, P1). 9. Exports de preuves (4 h, P1). 10. Historique opposable et signatures (5 h, P0).

## 5. Vision

QARA deviendrait indispensable s'il reliait chaque réponse à une preuve, une exigence exacte, un risque, une action et une décision de clôture, avec un mode de préparation ON spécifique à la classe du dispositif et sans métriques de démonstration présentées comme réelles.`);

write(`RAPPORT-SARAH-OBRIEN-QARA-${date}.md`, "Rapport Sarah O'Brien — FDA QMSR", `
## 1. Verdict FDA

Note corpus FDA QMSR : **7,8/10**. Les 43 questions ont une référence, une preuve et une source FDA/eCFR. Le détecteur n'a trouvé aucune référence ancienne §820.30/50/70/75/100/198 dépourvue de contexte QMSR/ISO 13485. Le QMSR est effectif depuis le 2 février 2026 et l'inspection FDA suit désormais CP 7382.850; la terminologie produit doit refléter ce changement.

## 2. Évaluation exhaustive

Le CSV couvre les 43 lignes. Points forts : applicability, incorporation ISO 13485, MDR reporting, corrections/removals, registration/listing, 510(k), UDI, De Novo, complaint→MDR→CAPA, supplier et software/cyber. À renforcer : Part 11 et signatures électroniques; procédure for-cause; distinction record review pré/post-2026; délais et preuves de 21 CFR 803; lien Part 807; scénario de vérification d'efficacité CAPA mesurable.

## 3. QARA face aux eQMS US

Avantage : corpus prêt à l'emploi, pédagogie, CAPA assistée et rapport. Lacunes : document control, training, e-signature Part 11, validation informatique, audit trail et workflow configurables.

## 4. Top 5 FDA

1. Signature Part 11 et audit trail (P0). 2. Inspection readiness CP 7382.850 (P0). 3. Complaint/MDR decision tree (P0). 4. Design-history traçable ISO 13485/QMSR (P1). 5. Dossier réponse 483 avec échéance/efficacité (P1).

## 5. Vision US

Commercialisation US conditionnelle à la validation des workflows électroniques, au mapping officiel QMSR et à une contre-recette live complaint→MDR→CAPA→rapport.`);

write(`RAPPORT-HIROSHI-TANAKA-QARA-${date}.md`, "Rapport Hiroshi Tanaka — MDSAP / ISO 14971", `
## 1. Verdict MDSAP

MDSAP **7,3/10**; ISO 14971 **7,7/10**. Corpus MDSAP : 74 questions et 10 groupes de processus. Le champ « NC Grading » existe, mais l'interface n'a pas été démontrée comme implémentant opérationnellement le grading réglementaire. Couverture fonctionnelle des grands processus : présente; profondeur pays par pays : partielle.

## 2. Analyse par processus

Management (12), Measurement/Analysis/Improvement (12), Design (15), Production/Service (8), Purchasing (7), Market authorization/facility registration (6), adverse events/advisory notices (10), linkage (1), grading (1), country-specific (2). Le prompt parle de sept chapitres, tandis que le modèle officiel actuel est process-based : conserver la terminologie officielle et versionner le modèle.

## 3. Marchés

Le corpus mentionne trois signaux multi-marchés et quatre LATAM : insuffisant pour démontrer une couverture opérationnelle PMDA, TGA, ANVISA, Health Canada. Ajouter matrices pays, formulaires, délais, langue, responsables locaux et preuves de soumission.

## 4. Vision multi-marchés

Un « regulatory graph » exigence commune ↔ variante pays ↔ preuve unique éviterait la ressaisie tout en conservant la traçabilité juridictionnelle.`);

write(`RAPPORT-FATIMA-ALRASHID-QARA-${date}.md`, "Rapport Fatima Al-Rashid — ISO 13485 / multi-marchés", `
## 1. Verdict

ISO 13485 **7,9/10**; ergonomie internationale **5,8/10**; recommandation multi-marchés **conditionnelle**.

## 2. ISO 13485 exhaustif

93 questions, 59 processus, références/preuves/pédagogie/gradation renseignées à 100 %. §5.6, §7 et §8 sont présents. Les 87 formulations génériques détectées réduisent toutefois le pouvoir discriminant métier. Les sources reposent légitimement sur un texte normatif fourni, mais le produit doit afficher version, licence et date de vérification.

## 3. Marchés émergents

CCG/SFDA/DOH/Inde/Afrique ne sont pas couverts de manière démontrable par le corpus. Ajouter packs juridictionnels maintenus, mappings et échéanciers.

## 4. Top 10 multi-marchés

Interface/rapport anglais, packs pays, mapping entre référentiels, profils importateur/distributeur/mandataire, calendrier réglementaire, traduction contrôlée, preuves réutilisables, tableaux consolidés réels, revue locale, export bilingue.

## 5. Vision

La valeur mondiale vient d'une même preuve réutilisée avec des écarts locaux explicites, pas d'une juxtaposition de questionnaires.`);

write(`RAPPORT-JP-MOREAU-QARA-${date}.md`, "Rapport Jean-Pierre Moreau — ISO 9001 / PME", `
## 1. Verdict PME

ISO 9001 **7,8/10**; double certification **5,9/10**; utilisable pour une PME après ajout d'un audit combiné et d'un accompagnement.

## 2. ISO 9001 exhaustif

44 questions, 35 processus; contexte §4, leadership §5, risques/opportunités §6 et amélioration sont présents. 41 formulations génériques doivent être adaptées au vocabulaire PME. Les références sont 2015/Amd.1:2024, sans signal 2008 détecté par l'inventaire.

## 3. Cohérence inter-référentiels

Les champs \`mappings\` existent dans le corpus, mais aucun parcours UI combiné ISO 9001↔ISO 13485 n'a été démontré. Risque actuel : doubler questions et preuves au lieu de mutualiser.

## 4. Valeur PME

Proposer un diagnostic initial de 60 minutes, un audit combiné, une bibliothèque de preuves, un CAPA guidé « objectifs qualité §6.2 », un plan 90 jours et un rapport direction en langage simple.`);

write(`RAPPORT-ELENA-VOLKOVA-QARA-${date}.md`, "Rapport Elena Volkova — SaMD", `
## 1. Verdict SaMD

Couverture SaMD **3,8/10**; recommandation startup SaMD : **NON en l'état comme outil principal**, oui comme socle SMQ.

## 2. Questions manquantes

Le détecteur trouve 9 mentions SaMD/logiciel/cyber au total (FDA 3, ISO 14971 6), aucune dans MDR et ISO 13485. Ajouter IEC 62304 §5–9, IEC 62366-1, classification logicielle MDR règle 11 et MDCG 2019-11, cybersécurité MDCG 2019-16 rev.1, gestion des changements IA/ML, données d'entraînement, biais, performance et surveillance post-marché.

## 3. Top 10 fonctions SaMD

Traçabilité exigences-tests-risques; versions/releases; SOUP/SBOM; anomalies; cybersécurité/vulnérabilités; usability; validation; données IA; PCCP/changement; intégration Jira/Git.

## 4. Vision

QARA doit devenir la couche de traçabilité réglementaire au-dessus des outils développeurs, et non tenter de les remplacer.`);

write(`RAPPORT-CARLOS-MENDOZA-QARA-${date}.md`, "Rapport Carlos Mendoza — LATAM", `
## 1. Verdict LATAM

Pertinence **3,5/10**; non suffisant pour un fabricant exportant en LATAM sans conseil externe.

## 2. Lacunes

Seulement 5 signaux LATAM détectés (MDSAP 4, MDR 1), aucun dans FDA/ISO/IVDR. Ajouter RDC 665/2022, registro, DOU/portugais, responsable local, NOTIVISA, COFEPRIS/NOM, INVIMA, ANMAT, importateurs et renouvellements. Chaque pack doit être daté, sourcé et gouverné.

## 3. Vision marchés émergents

Une matrice d'accès au marché, obligations par acteur et calendrier local, avec traduction contrôlée et partenaires locaux, créerait une vraie différenciation.`);

write(`RAPPORT-MH-DUBOIS-QARA-${date}.md`, "Rapport Marie-Hélène Dubois — IVDR", `
## 1. Verdict IVDR

Corpus IVDR **7,5/10**; utilisable comme checklist préparatoire classe C, pas encore comme système complet de preuve.

## 2. Évaluation exhaustive

72 lignes, 37 processus. Les sections performance, documentation, études, PMS, PSUR, vigilance, GSPR et classification sont présentes. À renforcer : terminologie IVD spécifique, PSP/PSR, PMPF, RSP, EQA, bases de référence, performances analytique/clinique, incidents liés aux résultats erronés et règles de classe C/D.

## 3. Vision DMDIV

Créer un module « performance » reliant analyte, population, méthode, lots, critères, étude, EQA, PMPF, risque, RSP et PSUR.`);

write(`RAPPORT-THOMAS-WRIGHT-QARA-${date}.md`, "Rapport Thomas Wright — Enterprise / multi-sites", `
## 1. Verdict enterprise

Usage multi-sites **3,9/10**. QARA ne remplace pas MasterControl pour huit sites; il peut servir de cockpit d'audit préparatoire pour PME/ETI.

## 2. Comparaison (15 critères)

| Critère | QARA observé | MasterControl/Veeva attendu |
|---|---|---|
| Corpus intégré | Fort | Variable/configurable |
| Audits/CAPA/rapports | Présents | Matures |
| Document control | Non démontré | Mature |
| Versioning/approbation | Non démontré | Mature |
| Signature Part 11/eIDAS | Non démontrée | Mature |
| Training | Non démontré | Mature |
| Compétences | Non démontrées | Mature |
| Fournisseurs | Questionnaire partiel | Module complet |
| Multi-sites | Données de démo | Consolidation réelle |
| RBAC par site | Non démontré | Granulaire |
| Audit trail | Non démontré | Complet |
| Workflow | Peu configurable | Configurable |
| Veille | Différenciant | Souvent séparé |
| IA CAPA | Différenciant, tests sûrs | Variable |
| Analytics | UI riche mais démo | Données réelles |

## 3. Gap enterprise

P0 : analytics réelles, tenant/site RBAC, audit trail/signature, document control. P1 : training, suppliers, programme annuel, workflow/escalade, API/connecteurs.

## 4. IA 2030

Evidence graph, détection précoce d'écarts, simulation auditeur, impact analysis réglementaire, CAPA causale avec preuve et mesure d'efficacité.`);

write(`RAPPORT-AMINATA-KOUYATE-QARA-${date}.md`, "Rapport Aminata Kouyaté — pédagogie / marchés émergents", `
## 1. Verdict

Accessibilité **5,5/10**; pédagogie **7,5/10**. Impact positif possible si l'outil ajoute offline, langues et tarification adaptée.

## 2. Dix barrières

Connectivité, coût, anglais/français seulement, jargon, absence offline, manque de packs locaux, formation initiale, preuve documentaire complexe, faible accompagnement, incertitude sur maintenance réglementaire. Solutions : PWA offline, synchronisation différée, glossaire, mode apprentissage, packs pays, tarification solidaire, communauté et contrôle éditorial.

## 3. Top 5 impact social

Mode apprentissage; offline-first; traduction contrôlée; diagnostic minimal PME; réseau de mentors/partenaires locaux.

## 4. Vision bien public

Publier un noyau pédagogique gratuit et versionné, tout en monétisant workflows, preuves, équipe et automatisation. Mesurer l'impact par taux de clôture, temps de mise à niveau et baisse des écarts récurrents.`);

const notes = {
  "MDR": 7.6, "IVDR": 7.5, "FDA QMSR": 7.8, "MDSAP": 7.3,
  "ISO 13485": 7.9, "ISO 14971": 7.7, "ISO 9001": 7.8,
};
const top30 = [
  ["Analytics alimentées uniquement par agrégats réels", "P0"], ["Audit trail + signatures Part 11/eIDAS", "P0"], ["Graphe exigence-preuve-risque-NC-CAPA", "P0"], ["Document control", "P0"], ["RBAC tenant/site", "P0"], ["Mode classe III / IVDR C-D", "P0"], ["Complaint→MDR decision tree", "P0"], ["Chaîne CER-PMCF-PSUR", "P0"], ["Programme sauvegarde/restauration surveillé", "P0"], ["Validation live CAPA/PDF", "P0"],
  ["Audit combiné multi-référentiels", "P1"], ["Mapping juridictionnel", "P1"], ["Training/compétences", "P1"], ["Supplier management", "P1"], ["Programme annuel d'audit", "P1"], ["Workflow/escalade configurable", "P1"], ["Module SaMD IEC 62304", "P1"], ["Cybersécurité/SBOM", "P1"], ["Données IA/ML et changements", "P1"], ["Module performance IVDR", "P1"], ["Packs PMDA/TGA/Health Canada", "P1"], ["Packs LATAM", "P1"], ["Interface/exports anglais", "P1"], ["Version/licence des normes", "P1"],
  ["Mode apprentissage", "P2"], ["Offline/PWA", "P2"], ["Langues locales", "P2"], ["Tarification émergente", "P2"], ["Intégrations Jira/Git", "P2"], ["Benchmark anonymisé", "P2"],
];
const topTable = top30.map((x, i) => `| ${i + 1} | ${x[0]} | 4–10 profils | 7–10 | M à XL | ${x[1]} |`).join("\n");

write(`RAPPORT-AUDIT-MONDIAL-QARA-10-EXPERTS-${date}.md`, "Rapport audit mondial QARA — 10 personas expertes", `
## 0. Résumé exécutif

**Verdict : NO-GO commercial full pour une promesse eQMS mondiale/opposable; GO conditionnel pour pilotes encadrés de diagnostic et préparation d'audit.** Le socle technique et le corpus sont solides : 473 questions riches et 186 tests backend verts. Les deux obstacles majeurs sont (1) l'Analytique de production affiche encore des jeux de démonstration codés en dur; (2) les parcours CAPA/PDF/complete audit demandés n'ont pas été contre-recettés en production pendant cette passe. L'écart 473 versionné / 485 observé récemment en base / 426 annoncé par le prompt interdit de prétendre à une couverture 100 % du corpus de production sans export canonique.

## 1. Verdicts des 10 personas

| Persona simulée | Angle | Verdict |
|---|---|---|
| Diallo | ON MDR/IVDR | Conditionnel |
| O'Brien | FDA QMSR | Conditionnel |
| Tanaka | MDSAP | Conditionnel |
| Al-Rashid | ISO 13485/multi-marchés | Conditionnel |
| Moreau | ISO 9001/PME | Oui pour accompagnement, non pour certification autonome |
| Volkova | SaMD | Non comme outil principal |
| Mendoza | LATAM | Non sans pack local |
| Dubois | IVDR | Conditionnel |
| Wright | Enterprise | Non comme remplacement eQMS |
| Kouyaté | Pédagogie | Potentiel positif conditionnel |

## 2. Notes par référentiel

| Référentiel | Note simulée |
|---|---:|
${Object.entries(notes).map(([k,v]) => `| ${k} | ${v}/10 |`).join("\n")}

## 3. Corpus — résultat unifié

- Population : 473/473 lignes contrôlées mécaniquement; preuve détaillée dans le CSV.
- Qualité structurale forte : tous les champs essentiels sont renseignés.
- Dette P1 : 444 formulations génériques; 141 groupes de titres répétés; 49 groupes de textes identiques. La répétition peut refléter trois techniques d'audit mais doit être rendue explicite.
- FDA : bonne mise à niveau QMSR dans les données versionnées.
- MDSAP : processus présents, packs pays trop minces.
- SaMD/LATAM : insuffisance structurelle.
- Gouvernance : établir un export canonique daté de production et comparer les clés à Git avant chaque release.

## 4. Top 30 fonctionnalités

| # | Fonctionnalité | Mention | Valeur | Complexité | Priorité |
|---:|---|---|---:|---|---|
${topTable}

## 5. Vision mondiale

QARA doit devenir un graphe de conformité vivant : une exigence officielle versionnée, des preuves réutilisables, des risques, constats et CAPA liés, des variantes pays, et un « regard auditeur » explicable. Son avantage n'est pas une checklist supplémentaire, mais la réduction de l'écart entre texte, preuve et décision.

## 6. Feuille de route

**0–30 jours :** retirer/étiqueter toute donnée analytique de démonstration; réconcilier 473/485/426; exécuter CAPA/PDF live; corriger le build hermétique; mettre audit trail/signature au cadrage. **1–3 mois :** evidence graph, audit combiné, classe III/IVDR, QMSR inspection readiness, SaMD initial. **3–12 mois :** document control, training, fournisseurs, packs pays prioritaires, anglais. **3 ans :** plateforme multi-juridictionnelle prédictive, avec partenaires réglementaires locaux.

## 7. Unique et irremplaçable

Le positionnement unique crédible : « QARA pense comme un auditeur, exige une preuve, explique pourquoi elle suffit ou non, puis mesure l'efficacité ». Ce positionnement exige l'abandon des chiffres de démo en production et une traçabilité électronique opposable.

## 8. Signatures

Les dix noms correspondent à des **personas simulées**. Aucune signature professionnelle, FDA, IRCA ou organisme notifié n'est revendiquée. Approbation réelle requise auprès d'experts indépendants nommés et contractés.

## Décision et critères de sortie

GO full seulement après : zéro donnée de démo non étiquetée; corpus production réconcilié à 100 %; CAPA+PDF+audit complet réussis sur les 7 référentiels; audit trail/signatures validés selon périmètre; 14 jours sans P0; >95 % des parcours critiques; trois pilotes terminant audit+CAPA+PDF.`);

fs.writeFileSync(path.join(out, "MANIFESTE-LIVRABLES.md"), `# Manifeste\n\n- 10 rapports de personas simulées\n- 1 rapport mondial consolidé\n- 1 CSV exhaustif 473 lignes\n- 1 CSV des signaux à revoir\n- 1 JSON de métriques\n- 1 journal d'exécution\n\nAucun audit de production n'a été créé et aucun secret n'a été consulté.\n`, "utf8");

fs.writeFileSync(path.join(out, "JOURNAL-EXECUTION.md"), `# Journal d'exécution\n\n| Contrôle | Résultat | Nature |\n|---|---|---|\n| Lecture prompt 1 210 lignes | Terminé | Documentaire |\n| SHA backend/frontend | 63f366c / 06feee36 | Git local |\n| Corpus | 473 lignes | Analyse statique exhaustive |\n| Tests backend | 186/186 | Exécuté |\n| Build backend | Non concluant : dépendance liée hors workspace | Environnement local |\n| UI Analytique | 7 vues cliquées et changées | Exécuté en lecture seule |\n| Données Analytique | Jeu de démo hardcodé confirmé par UI + source | Constat P0 |\n| Création audits experts | Non exécutée | Pas d'identifiants fournis; éviter données artificielles |\n| CAPA/PDF production | Non exécuté | Nécessite audit live complet |\n| Paiement/suppression | Non exécuté | Conforme aux règles |\n`, "utf8");

console.log("Rapports générés dans", out);
