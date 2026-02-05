import { drizzle } from "drizzle-orm/mysql2";
import { referentials, processes, mandatoryDocuments } from "../../drizzle/schema";

const db = drizzle(process.env.DATABASE_URL!);

const fdaDocuments = [
  // QMS/QMSR Documents
  {
    referential: "FDA_QMSR",
    process: "Système de management de la qualité (QMS)",
    role: "manufacturer_us",
    documentName: "Quality Manual",
    reference: "21 CFR 820.20 / QMSR",
    status: "obligatoire",
    objective: "Document central du QMS FDA définissant le périmètre, les processus, les responsabilités et l'engagement de la direction vis-à-vis de la qualité.",
    minimumContent: JSON.stringify([
      "Scope du QMS (produits, sites, processus couverts)",
      "Organigramme et responsabilités qualité",
      "Cartographie des processus QMS",
      "Politique qualité et objectifs",
      "Références aux procédures QMS",
      "Engagement de la direction",
      "Plan de transition QMSR (si applicable)"
    ]),
    auditorExpectations: "L'auditeur FDA vérifiera que le Quality Manual reflète fidèlement le QMS en place, que toutes les exigences Part 820/QMSR sont couvertes, et que la direction est activement engagée.",
    commonErrors: "Quality Manual générique non adapté à l'organisation. Absence de lien avec les procédures réelles. Pas de mise à jour pour la transition QMSR.",
    aiPrompt: "Générez un Quality Manual FDA conforme QMSR pour un fabricant de dispositifs médicaux. Incluez le scope, l'organigramme, la cartographie des processus, la politique qualité, et le plan de transition QMSR."
  },
  {
    referential: "FDA_QMSR",
    process: "Système de management de la qualité (QMS)",
    role: "tous",
    documentName: "Document Control Procedure",
    reference: "21 CFR 820.40",
    status: "obligatoire",
    objective: "Procédure définissant comment les documents et enregistrements sont créés, approuvés, distribués, modifiés, archivés et détruits.",
    minimumContent: JSON.stringify([
      "Processus de création et approbation des documents",
      "Système de numérotation et versioning",
      "Distribution et accès aux documents",
      "Gestion des changements documentaires",
      "Master List of Documents",
      "Durées de conservation (Device History Record: lifetime + 2 years minimum)",
      "Archivage et destruction",
      "Contrôle des documents obsolètes"
    ]),
    auditorExpectations: "L'auditeur vérifiera que seuls les documents approuvés et à jour sont utilisés en production, que les enregistrements sont conservés selon les durées FDA, et que les documents obsolètes sont retirés.",
    commonErrors: "Documents obsolètes encore accessibles en production. Durées de conservation non conformes FDA. Pas de Master List à jour.",
    aiPrompt: "Rédigez une procédure de contrôle documentaire FDA conforme 21 CFR 820.40. Incluez la création, approbation, distribution, modification, archivage et les durées de conservation FDA."
  },
  {
    referential: "FDA_QMSR",
    process: "Conception & développement",
    documentName: "Design Control Procedure",
    reference: "21 CFR 820.30",
    status: "obligatoire",
    objective: "Procédure définissant le processus de conception et développement des dispositifs médicaux selon les exigences FDA.",
    minimumContent: JSON.stringify([
      "Design Planning (plan de développement)",
      "Design Inputs (exigences utilisateur, réglementaires, risques)",
      "Design Outputs (spécifications, dessins, code)",
      "Design Reviews (revues de conception)",
      "Design Verification (tests, simulations)",
      "Design Validation (essais cliniques si applicable)",
      "Design Transfer (transfert en production)",
      "Design Changes (gestion des modifications)",
      "Design History File (DHF) structure"
    ]),
    auditorExpectations: "L'auditeur vérifiera que tous les dispositifs ont un DHF complet, que V&V sont documentés, que les changements sont maîtrisés, et que le design est transféré correctement en production.",
    commonErrors: "DHF incomplet. Confusion entre Verification et Validation. Design Inputs non traçables aux Design Outputs. Changements non documentés.",
    aiPrompt: "Créez une Design Control Procedure FDA conforme 21 CFR 820.30. Couvrez le planning, inputs/outputs, reviews, V&V, transfer, changes, et la structure du DHF."
  },
  {
    referential: "FDA_QMSR",
    process: "Conception & développement",
    documentName: "Design History File (DHF)",
    reference: "21 CFR 820.30(j)",
    status: "obligatoire",
    objective: "Dossier contenant tous les enregistrements nécessaires pour démontrer que le design a été développé conformément au Design Control Procedure.",
    minimumContent: JSON.stringify([
      "Design Plan",
      "Design Inputs (exigences)",
      "Design Outputs (spécifications)",
      "Design Review records",
      "Verification protocols et reports",
      "Validation protocols et reports",
      "Design Transfer documentation",
      "Design Change records",
      "Risk Management File (ISO 14971)",
      "Traceability Matrix (Inputs → Outputs → V&V)"
    ]),
    auditorExpectations: "L'auditeur demandera le DHF pour chaque dispositif et vérifiera la traçabilité complète des exigences, la documentation V&V, et la cohérence avec le DMR.",
    commonErrors: "DHF incomplet ou désorganisé. Pas de Traceability Matrix. V&V non documentés. Changements non intégrés dans le DHF.",
    aiPrompt: "Générez un template de Design History File (DHF) FDA conforme 21 CFR 820.30(j). Incluez tous les éléments requis et une Traceability Matrix."
  },
  {
    referential: "FDA_QMSR",
    process: "Production & validation des procédés",
    documentName: "Device Master Record (DMR)",
    reference: "21 CFR 820.181",
    status: "obligatoire",
    objective: "Compilation de tous les documents et spécifications nécessaires pour fabriquer le dispositif médical.",
    minimumContent: JSON.stringify([
      "Device specifications (dimensions, matériaux, performances)",
      "Production process specifications",
      "Quality assurance procedures",
      "Packaging and labeling specifications",
      "Installation, maintenance, servicing procedures (si applicable)",
      "Bill of Materials (BOM)",
      "Manufacturing procedures",
      "Inspection and test procedures",
      "Equipment and tooling specifications"
    ]),
    auditorExpectations: "L'auditeur vérifiera que le DMR est complet, à jour, et cohérent avec le DHF. Toute production doit être conforme au DMR.",
    commonErrors: "DMR non synchronisé avec le DHF. Changements en production non reflétés dans le DMR. Procédures de fabrication manquantes.",
    aiPrompt: "Créez un template de Device Master Record (DMR) FDA conforme 21 CFR 820.181. Incluez toutes les spécifications et procédures de fabrication."
  },
  {
    referential: "FDA_QMSR",
    process: "Non-conformités & CAPA",
    documentName: "CAPA Procedure",
    reference: "21 CFR 820.100",
    status: "obligatoire",
    objective: "Procédure définissant le système d'actions correctives et préventives pour identifier, investiguer et résoudre les problèmes qualité.",
    minimumContent: JSON.stringify([
      "Sources CAPA (NC, réclamations, audits, données PMS, MDR)",
      "Processus d'ouverture CAPA",
      "Analyse de cause racine (méthodes: 5 Why, Ishikawa, FMEA)",
      "Définition des actions correctives/préventives",
      "Mise en œuvre et suivi",
      "Vérification de l'efficacité",
      "Analyse des tendances",
      "Clôture CAPA",
      "Lien avec Design Changes et Process Changes"
    ]),
    auditorExpectations: "L'auditeur FDA vérifiera que toutes les sources CAPA sont surveillées, que les analyses de causes racines sont robustes, que l'efficacité est vérifiée, et que les CAPA sont clôturées correctement.",
    commonErrors: "Analyses de causes racines superficielles. Pas de vérification d'efficacité. CAPA non liés aux changements design/process. Tendances non analysées.",
    aiPrompt: "Rédigez une CAPA Procedure FDA conforme 21 CFR 820.100. Couvrez les sources, l'analyse de cause racine, les actions, la vérification d'efficacité, et l'analyse des tendances."
  },
  {
    referential: "FDA_QMSR",
    process: "PMS & vigilance",
    documentName: "Complaint Handling Procedure",
    reference: "21 CFR 820.198",
    status: "obligatoire",
    objective: "Procédure définissant comment les réclamations sont reçues, enregistrées, investiguées, et traitées.",
    minimumContent: JSON.stringify([
      "Définition d'une réclamation FDA",
      "Processus de réception et enregistrement",
      "Complaint File requirements",
      "Investigation process",
      "Évaluation MDR reportability (21 CFR 803)",
      "Lien avec CAPA",
      "Analyse des tendances",
      "Réponse au plaignant",
      "Durée de conservation (lifetime of device + 2 years minimum)"
    ]),
    auditorExpectations: "L'auditeur vérifiera que toutes les réclamations sont enregistrées, investiguées, évaluées pour MDR, et que les Complaint Files sont complets et conservés selon les durées FDA.",
    commonErrors: "Réclamations non enregistrées. Pas d'évaluation MDR systématique. Investigations superficielles. Complaint Files incomplets.",
    aiPrompt: "Créez une Complaint Handling Procedure FDA conforme 21 CFR 820.198. Incluez la réception, l'investigation, l'évaluation MDR, et le lien avec CAPA."
  },
  {
    referential: "FDA_POSTMARKET",
    process: "PMS & vigilance",
    documentName: "MDR Reporting Procedure",
    reference: "21 CFR 803",
    status: "obligatoire",
    objective: "Procédure définissant comment identifier, évaluer et reporter les événements indésirables à la FDA selon les exigences MDR.",
    minimumContent: JSON.stringify([
      "Définitions MDR (death, serious injury, malfunction)",
      "Critères de reportabilité",
      "Délais FDA (5-day reports, 30-day reports)",
      "Processus d'évaluation MDR",
      "Formulaires FDA (3500A, 3500B)",
      "Soumission à FDA (eSubmitter)",
      "Follow-up reports",
      "Lien avec CAPA et Design Changes",
      "Records retention (2 years minimum)"
    ]),
    auditorExpectations: "L'auditeur vérifiera que tous les événements reportables sont identifiés, évalués correctement, et reportés dans les délais FDA. Les enregistrements MDR doivent être complets.",
    commonErrors: "Critères de reportabilité mal compris. Délais FDA non respectés. Pas de lien entre MDR et CAPA. Follow-up reports manquants.",
    aiPrompt: "Rédigez une MDR Reporting Procedure FDA conforme 21 CFR 803. Couvrez les critères de reportabilité, les délais (5-day/30-day), la soumission, et le lien avec CAPA."
  },
  {
    referential: "FDA_QMSR",
    process: "Achats & fournisseurs",
    documentName: "Supplier Control Procedure",
    reference: "21 CFR 820.50",
    status: "obligatoire",
    objective: "Procédure définissant comment les fournisseurs sont qualifiés, évalués, et contrôlés.",
    minimumContent: JSON.stringify([
      "Critères de sélection fournisseurs",
      "Processus de qualification (audit, évaluation)",
      "Approved Supplier List (ASL)",
      "Purchase Order requirements (transmission exigences FDA)",
      "Quality Agreements",
      "Incoming inspection",
      "Supplier performance monitoring",
      "Réévaluation périodique",
      "Gestion des NC fournisseurs"
    ]),
    auditorExpectations: "L'auditeur vérifiera que tous les fournisseurs critiques sont qualifiés, que les exigences FDA sont transmises, que les réceptions sont contrôlées, et que les performances sont surveillées.",
    commonErrors: "Fournisseurs non qualifiés. Exigences FDA non transmises. Pas de Quality Agreements. Incoming inspection insuffisant.",
    aiPrompt: "Créez une Supplier Control Procedure FDA conforme 21 CFR 820.50. Incluez la qualification, l'ASL, les Purchase Orders, les Quality Agreements, et le monitoring."
  },
  {
    referential: "FDA_QMSR",
    process: "Production & validation des procédés",
    documentName: "Process Validation Protocol & Report",
    reference: "21 CFR 820.75",
    status: "obligatoire",
    objective: "Documentation de la validation des procédés de fabrication (IQ/OQ/PQ) pour démontrer que les procédés produisent des résultats cohérents.",
    minimumContent: JSON.stringify([
      "Validation Master Plan",
      "Installation Qualification (IQ)",
      "Operational Qualification (OQ)",
      "Performance Qualification (PQ)",
      "Acceptance criteria",
      "Test methods",
      "Results and analysis",
      "Conclusion and approval",
      "Revalidation requirements"
    ]),
    auditorExpectations: "L'auditeur vérifiera que tous les procédés critiques sont validés (IQ/OQ/PQ), que les critères d'acceptation sont définis, et que les résultats démontrent la cohérence.",
    commonErrors: "Validation incomplète (IQ/OQ sans PQ). Critères d'acceptation flous. Pas de revalidation après changements. Validation non documentée.",
    aiPrompt: "Générez un template de Process Validation Protocol FDA conforme 21 CFR 820.75. Incluez IQ/OQ/PQ, critères d'acceptation, et plan de revalidation."
  },

  // Registration & Listing Documents
  {
    referential: "FDA_807",
    process: "Affaires réglementaires & interaction ON",
    documentName: "FDA Establishment Registration",
    reference: "21 CFR 807 Subpart A",
    status: "obligatoire",
    objective: "Enregistrement de l'établissement auprès de la FDA (obligatoire pour manufacturer, specification developer, contract manufacturer, initial importer).",
    minimumContent: JSON.stringify([
      "Registration Number (FEI)",
      "Establishment information (nom, adresse, contacts)",
      "Type d'établissement (manufacturer, etc.)",
      "Date d'enregistrement",
      "Mise à jour annuelle (October 1 - December 31)",
      "Change notifications"
    ]),
    auditorExpectations: "L'auditeur vérifiera que l'établissement est enregistré auprès de la FDA, que l'enregistrement est à jour, et que les changements sont notifiés.",
    commonErrors: "Enregistrement expiré. Mise à jour annuelle oubliée. Changements non notifiés (changement d'adresse, de propriétaire).",
    aiPrompt: "Expliquez le processus d'enregistrement FDA (21 CFR 807 Subpart A). Quelles informations sont requises ? Comment effectuer la mise à jour annuelle ?"
  },
  {
    referential: "FDA_807",
    process: "Affaires réglementaires & interaction ON",
    documentName: "FDA Device Listing",
    reference: "21 CFR 807 Subpart B",
    status: "obligatoire",
    objective: "Listing de tous les dispositifs médicaux commercialisés aux États-Unis.",
    minimumContent: JSON.stringify([
      "Device name (proprietary and common)",
      "Device classification",
      "Premarket submission number (510(k), PMA, De Novo)",
      "Listing Number",
      "Date of listing",
      "Updates (new devices, discontinued devices)"
    ]),
    auditorExpectations: "L'auditeur vérifiera que tous les dispositifs commercialisés sont listés auprès de la FDA, que les informations sont à jour, et que les changements sont notifiés.",
    commonErrors: "Dispositifs non listés. Informations obsolètes. Dispositifs discontinués non notifiés.",
    aiPrompt: "Expliquez le processus de listing FDA (21 CFR 807 Subpart B). Quelles informations sont requises ? Comment mettre à jour le listing ?"
  },

  // Premarket Documents
  {
    referential: "FDA_510K",
    process: "Affaires réglementaires & interaction ON",
    documentName: "510(k) Premarket Notification",
    reference: "21 CFR 807 Subpart E",
    status: "obligatoire",
    objective: "Soumission 510(k) pour démontrer la substantial equivalence à un predicate device.",
    minimumContent: JSON.stringify([
      "Device description",
      "Indications for use",
      "Predicate device identification",
      "Substantial equivalence comparison (technological characteristics)",
      "Performance data (bench testing, biocompatibility, clinical data si applicable)",
      "Labeling",
      "510(k) summary ou statement",
      "Truthful and accuracy statement"
    ]),
    auditorExpectations: "L'auditeur vérifiera que le 510(k) est approuvé (clearance letter), que le dispositif commercialisé est conforme au 510(k), et que les changements post-clearance sont évalués.",
    commonErrors: "Substantial equivalence non démontrée. Predicate inapproprié. Performance data insuffisantes. Dispositif commercialisé différent du 510(k).",
    aiPrompt: "Créez un template de 510(k) Premarket Notification FDA. Incluez la description du dispositif, la comparaison au predicate, les performance data, et le labeling."
  },
  {
    referential: "FDA_DE_NOVO",
    process: "Affaires réglementaires & interaction ON",
    documentName: "De Novo Classification Request",
    reference: "21 CFR 860",
    status: "obligatoire",
    objective: "Demande De Novo pour dispositifs nouveaux sans predicate, de risque faible/modéré.",
    minimumContent: JSON.stringify([
      "Device description",
      "Indications for use",
      "Justification de l'absence de predicate",
      "Risk assessment (démonstration risque faible/modéré)",
      "Special controls definition",
      "Performance data (bench testing, biocompatibility, clinical data si applicable)",
      "Labeling",
      "Benefit-risk analysis"
    ]),
    auditorExpectations: "L'auditeur vérifiera que la demande De Novo est approuvée (grant letter), que les special controls sont intégrés dans le QMS, et que le dispositif est conforme.",
    commonErrors: "Risque mal évalué (devrait être PMA). Special controls insuffisants. Performance data manquantes. Special controls non implémentés dans le QMS.",
    aiPrompt: "Générez un template de De Novo Classification Request FDA. Incluez la justification de l'absence de predicate, le risk assessment, les special controls, et les performance data."
  },
  {
    referential: "FDA_PMA",
    process: "Affaires réglementaires & interaction ON",
    documentName: "Premarket Approval (PMA) Application",
    reference: "21 CFR 814",
    status: "obligatoire",
    objective: "Dossier PMA complet pour dispositifs de Classe III (haut risque).",
    minimumContent: JSON.stringify([
      "Device description",
      "Indications for use",
      "Non-clinical testing (bench, animal, biocompatibility)",
      "Clinical data (clinical trials)",
      "Manufacturing information (facilities, processes, quality system)",
      "Labeling",
      "Risk analysis",
      "Benefit-risk analysis",
      "Bibliography"
    ]),
    auditorExpectations: "L'auditeur vérifiera que le PMA est approuvé (approval letter), que le dispositif commercialisé est conforme au PMA, et que les changements sont gérés via PMA supplements.",
    commonErrors: "Données cliniques insuffisantes. Manufacturing information incomplète. Dispositif commercialisé différent du PMA. PMA supplements manquants pour changements.",
    aiPrompt: "Créez un template de PMA Application FDA. Incluez la description, les données non-cliniques, les données cliniques, les manufacturing information, et le benefit-risk analysis."
  },

  // Labeling & UDI Documents
  {
    referential: "FDA_LABELING_UDI",
    process: "Production & validation des procédés",
    documentName: "Device Labeling",
    reference: "21 CFR 801",
    status: "obligatoire",
    objective: "Documentation de l'étiquetage du dispositif médical conforme aux exigences FDA.",
    minimumContent: JSON.stringify([
      "Device label (nom, fabricant, UDI)",
      "Instructions for Use (IFU)",
      "Warnings and precautions",
      "Indications for use",
      "Contraindications",
      "Adverse events",
      "Storage and handling",
      "Expiration date (si applicable)",
      "Lot/Serial number"
    ]),
    auditorExpectations: "L'auditeur vérifiera que l'étiquetage est conforme 21 CFR 801, que les IFU sont complets, et que l'étiquetage est cohérent avec le premarket submission.",
    commonErrors: "IFU incomplets. Warnings insuffisants. Étiquetage non cohérent avec 510(k)/PMA. UDI manquant.",
    aiPrompt: "Générez un template de Device Labeling FDA conforme 21 CFR 801. Incluez le label, les IFU, les warnings, les indications, et les contraindications."
  },
  {
    referential: "FDA_LABELING_UDI",
    process: "Production & validation des procédés",
    documentName: "UDI (Unique Device Identification)",
    reference: "21 CFR 830",
    status: "obligatoire",
    objective: "Attribution et enregistrement de l'UDI dans la base GUDID.",
    minimumContent: JSON.stringify([
      "UDI-DI (Device Identifier)",
      "UDI-PI (Production Identifier: lot, serial, expiration, manufacturing date)",
      "GUDID registration",
      "UDI on device label",
      "UDI on device package",
      "Issuing agency (GS1, HIBCC, ICCBBA)"
    ]),
    auditorExpectations: "L'auditeur vérifiera que l'UDI est attribué, enregistré dans GUDID, et présent sur le label et le package. L'UDI doit être cohérent avec le listing FDA.",
    commonErrors: "UDI non enregistré dans GUDID. UDI manquant sur le label. UDI-PI incomplet. Issuing agency non conforme.",
    aiPrompt: "Expliquez le système UDI FDA (21 CFR 830). Comment attribuer un UDI ? Comment enregistrer dans GUDID ? Quelles sont les exigences de marquage ?"
  }
];

async function seedFdaDocuments() {
  console.log("🔄 Seeding FDA mandatory documents...");

  // Get referential and process IDs
  const allReferentials = await db.select().from(referentials);
  const allProcesses = await db.select().from(processes);

  const refMap = new Map(allReferentials.map(r => [r.code, r.id]));
  const processMap = new Map(allProcesses.map(p => [p.name, p.id]));

  let inserted = 0;
  for (const doc of fdaDocuments) {
    const referentialId = refMap.get(doc.referential);
    const processId = processMap.get(doc.process);

    if (!referentialId) {
      console.warn(`⚠️  Referential not found: ${doc.referential}`);
      continue;
    }
    if (!processId) {
      console.warn(`⚠️  Process not found: ${doc.process}`);
      continue;
    }

    await db.insert(mandatoryDocuments).values({
      referentialId,
      processId,
      role: doc.role as any,
      documentName: doc.documentName,
      reference: doc.reference,
      status: doc.status as any,
      objective: doc.objective,
      minimumContent: doc.minimumContent,
      auditorExpectations: doc.auditorExpectations,
      commonErrors: doc.commonErrors,
      linkedDocuments: null,
      linkedQuestions: null,
      templateUrl: null
    });

    inserted++;
  }

  console.log(`✅ Inserted ${inserted} FDA mandatory documents`);
}

async function main() {
  console.log("🚀 Starting FDA documents seed...");
  
  await seedFdaDocuments();
  
  console.log("✅ FDA documents seed completed!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ FDA documents seed failed:", error);
  process.exit(1);
});
