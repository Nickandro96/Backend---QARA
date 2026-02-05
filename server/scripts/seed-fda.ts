import { drizzle } from "drizzle-orm/mysql2";
import { referentials, processes, questions } from "../../drizzle/schema";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = drizzle(process.env.DATABASE_URL!);

// Mapping des sections vers processus et métadonnées
interface QuestionMetadata {
  process: string;
  reference: string;
  referential: string;
  criticality: "high" | "medium" | "low";
  role: string;
  evidence: string[];
  risks: string;
  actionPlan: string;
  aiPrompt: string;
}

const sectionMetadata: Record<string, QuestionMetadata> = {
  "1.1": {
    process: "Gouvernance & stratégie réglementaire",
    reference: "FDA General - Roles & Responsibilities",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Organigramme réglementaire", "Matrice de responsabilités FDA", "Quality Manual", "Contrats de sous-traitance"],
    risks: "Confusion des responsabilités FDA. Non-conformité lors d'inspection. Impossibilité de démontrer la chaîne de responsabilité.",
    actionPlan: "1. Définir clairement le rôle FDA de l'entité. 2. Documenter dans le Quality Manual. 3. Créer une matrice de responsabilités FDA. 4. Former les équipes. 5. Auditer l'application.",
    aiPrompt: "Expliquez les différents rôles FDA (manufacturer, specification developer, contract manufacturer). Quelles sont les responsabilités de chaque rôle ?"
  },
  "2.1": {
    process: "Système de management de la qualité (QMS)",
    reference: "21 CFR 820 / QMSR - QMS Structure",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Quality Manual", "QMS Scope Statement", "Cartographie des processus", "Plan de transition QMSR"],
    risks: "Périmètre QMS flou. Processus critiques non couverts. Non-conformité QMSR après 2 février 2026.",
    actionPlan: "1. Définir le périmètre du QMS FDA. 2. Cartographier tous les processus. 3. Planifier la transition QMSR. 4. Former les équipes. 5. Auditer la conformité.",
    aiPrompt: "Qu'est-ce que le QMSR FDA (date d'effet 2 février 2026) ? Quelles sont les différences avec le 21 CFR Part 820 ? Comment planifier la transition ?"
  },
  "2.2": {
    process: "Gouvernance & stratégie réglementaire",
    reference: "21 CFR 820.20 - Management Responsibility",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Organigramme", "Job descriptions", "Management Review records", "Communication interne FDA"],
    risks: "Direction non engagée. Décisions FDA non documentées. Observation lors d'inspection.",
    actionPlan: "1. Définir les responsabilités management FDA. 2. Établir des revues de direction FDA. 3. Documenter les décisions. 4. Communiquer aux équipes. 5. Auditer l'engagement.",
    aiPrompt: "Quelles sont les responsabilités du management selon 21 CFR 820.20 ? Comment démontrer l'engagement de la direction vis-à-vis du QMS FDA ?"
  },
  "2.3": {
    process: "Système de management de la qualité (QMS)",
    reference: "21 CFR 820.40 - Document & Record Controls",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "tous",
    evidence: ["Document Control Procedure", "Master List of Documents", "Change History", "Record Retention Policy", "Archive System"],
    risks: "Documents obsolètes en production. Enregistrements perdus. Non-conformité FDA majeure.",
    actionPlan: "1. Créer une procédure de contrôle documentaire FDA. 2. Établir une Master List. 3. Définir les durées de conservation. 4. Mettre en place un système d'archivage. 5. Former les équipes. 6. Auditer l'application.",
    aiPrompt: "Quelles sont les exigences FDA pour le contrôle des documents et enregistrements (21 CFR 820.40) ? Quelles durées de conservation sont requises ?"
  },
  "2.4": {
    process: "Conception & développement",
    reference: "21 CFR 820.30 - Design Controls",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Design History File (DHF)", "Design Plan", "Design Inputs/Outputs", "Verification/Validation Reports", "Design Reviews", "Design Change Records"],
    risks: "Design non maîtrisé. Rejet de soumission 510(k)/PMA. Observation FDA majeure. Rappel post-market.",
    actionPlan: "1. Créer une Design Control Procedure. 2. Établir un DHF pour chaque dispositif. 3. Définir les Design Inputs/Outputs. 4. Conduire V&V. 5. Gérer les changements. 6. Auditer les design controls.",
    aiPrompt: "Expliquez les Design Controls selon 21 CFR 820.30. Qu'est-ce qu'un Design History File (DHF) ? Quelle est la différence entre Verification et Validation ?"
  },
  "2.5": {
    process: "Gestion des risques (ISO 14971)",
    reference: "FDA Risk Management Expectations",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Risk Management File (ISO 14971)", "Risk Analysis", "Risk Evaluation", "Risk Control Measures", "Residual Risk Justification", "Post-market Risk Review"],
    risks: "Risques non identifiés. Incidents patients. Rappel. Observation FDA.",
    actionPlan: "1. Établir un Risk Management Process (ISO 14971). 2. Conduire l'analyse des risques. 3. Définir les mesures de contrôle. 4. Justifier les risques résiduels. 5. Réévaluer post-market. 6. Intégrer dans design et CAPA.",
    aiPrompt: "Quelles sont les attentes FDA en matière de gestion des risques ? Comment intégrer ISO 14971 dans le QMS FDA ? Comment justifier les risques résiduels ?"
  },
  "2.6": {
    process: "Achats & fournisseurs",
    reference: "21 CFR 820.50 - Purchasing Controls",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Supplier Control Procedure", "Approved Supplier List", "Supplier Qualification Records", "Purchase Orders with FDA requirements", "Supplier Audits", "Incoming Inspection Records"],
    risks: "Fournisseurs non qualifiés. Composants non conformes. Défaillances produit. Observation FDA.",
    actionPlan: "1. Créer une procédure de contrôle fournisseurs. 2. Qualifier tous les fournisseurs critiques. 3. Transmettre les exigences FDA. 4. Auditer les fournisseurs. 5. Contrôler les réceptions. 6. Réévaluer périodiquement.",
    aiPrompt: "Quelles sont les exigences FDA pour le contrôle des fournisseurs (21 CFR 820.50) ? Comment qualifier un fournisseur critique ? Que doit contenir un Quality Agreement ?"
  },
  "2.7": {
    process: "Production & validation des procédés",
    reference: "21 CFR 820.70 - Production & Process Controls",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Manufacturing Procedures", "Device Master Record (DMR)", "Process Validation (IQ/OQ/PQ)", "Batch Records", "Equipment Calibration", "Environmental Controls"],
    risks: "Procédés non maîtrisés. Variabilité de production. Produits non conformes. Observation FDA majeure.",
    actionPlan: "1. Créer des procédures de fabrication détaillées. 2. Établir un DMR pour chaque dispositif. 3. Valider tous les procédés critiques (IQ/OQ/PQ). 4. Calibrer les équipements. 5. Contrôler l'environnement. 6. Auditer la production.",
    aiPrompt: "Quelles sont les exigences FDA pour les contrôles de production (21 CFR 820.70) ? Qu'est-ce qu'un Device Master Record (DMR) ? Quand faut-il valider un procédé ?"
  },
  "2.8": {
    process: "Production & validation des procédés",
    reference: "21 CFR 820.60 - Identification & Traceability",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Traceability Procedure", "Lot/Serial Number System", "Traceability Matrix", "Distribution Records", "Recall Simulation"],
    risks: "Impossibilité de tracer les dispositifs. Rappel inefficace. Observation FDA majeure.",
    actionPlan: "1. Établir un système d'identification unique. 2. Définir la traçabilité lot/série. 3. Lier production-distribution-réclamations. 4. Tester la traçabilité (recall simulation). 5. Former les équipes. 6. Auditer la traçabilité.",
    aiPrompt: "Quelles sont les exigences FDA pour l'identification et la traçabilité (21 CFR 820.60) ? Comment assurer une traçabilité complète du lot à la distribution ?"
  },
  "2.9": {
    process: "Non-conformités & CAPA",
    reference: "21 CFR 820.90 - Nonconforming Product",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Nonconforming Product Procedure", "NC Log", "Disposition Records", "Rework Procedures", "NC Analysis", "CAPA Links"],
    risks: "Produits NC non identifiés. Libération de produits défectueux. Incidents patients. Observation FDA.",
    actionPlan: "1. Créer une procédure de gestion des NC. 2. Identifier et isoler les produits NC. 3. Définir les dispositions (rebut/retouche/dérogation). 4. Analyser les tendances. 5. Alimenter les CAPA. 6. Auditer la gestion des NC.",
    aiPrompt: "Comment gérer les produits non conformes selon 21 CFR 820.90 ? Quelles dispositions sont acceptables ? Comment lier NC et CAPA ?"
  },
  "2.10": {
    process: "Non-conformités & CAPA",
    reference: "21 CFR 820.100 - Corrective and Preventive Action",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["CAPA Procedure", "CAPA Log", "Root Cause Analysis", "Effectiveness Checks", "Trend Analysis", "CAPA Closure Records"],
    risks: "Problèmes récurrents. Incidents patients. Rappel. Observation FDA majeure (CAPA est un point critique FDA).",
    actionPlan: "1. Créer une CAPA Procedure robuste. 2. Identifier toutes les sources CAPA (NC, réclamations, audits). 3. Conduire des analyses de causes racines. 4. Définir des actions correctives/préventives. 5. Vérifier l'efficacité. 6. Analyser les tendances. 7. Auditer le système CAPA.",
    aiPrompt: "Qu'est-ce que le système CAPA selon 21 CFR 820.100 ? Comment conduire une analyse de cause racine ? Comment vérifier l'efficacité d'une CAPA ?"
  },
  "2.11": {
    process: "PMS & vigilance",
    reference: "21 CFR 820.198 - Complaint Files",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Complaint Handling Procedure", "Complaint Log", "Complaint Investigation Reports", "Trend Analysis", "MDR Evaluation", "CAPA Links"],
    risks: "Réclamations non traitées. MDR non reportés. Incidents patients. Observation FDA majeure.",
    actionPlan: "1. Créer une Complaint Handling Procedure. 2. Établir un registre des réclamations. 3. Investiguer toutes les réclamations. 4. Évaluer pour MDR reporting. 5. Analyser les tendances. 6. Alimenter les CAPA. 7. Auditer le système.",
    aiPrompt: "Quelles sont les exigences FDA pour le traitement des réclamations (21 CFR 820.198) ? Comment évaluer si une réclamation est reportable (MDR) ?"
  },
  "2.12": {
    process: "PMS & vigilance",
    reference: "21 CFR 803 - Medical Device Reporting",
    referential: "FDA_POSTMARKET",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["MDR Procedure", "MDR Reports Submitted", "MDR Evaluation Records", "FDA Acknowledgments", "CAPA Links"],
    risks: "MDR non reportés dans les délais. Sanctions FDA. Incidents patients non traités. Observation majeure.",
    actionPlan: "1. Créer une MDR Procedure. 2. Former les équipes sur les critères de reportabilité. 3. Établir un processus d'évaluation rapide. 4. Respecter les délais FDA (5-day, 30-day). 5. Documenter tous les rapports. 6. Lier MDR et CAPA. 7. Auditer le système MDR.",
    aiPrompt: "Qu'est-ce que le Medical Device Reporting (MDR) selon 21 CFR 803 ? Quels événements sont reportables ? Quels sont les délais FDA (5-day vs 30-day reports) ?"
  },
  "3": {
    process: "Affaires réglementaires & interaction ON",
    reference: "21 CFR 807 - Establishment Registration & Device Listing",
    referential: "FDA_807",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["FDA Registration Certificate", "Device Listing Evidence", "Annual Update Records", "Change Notifications"],
    risks: "Enregistrement expiré. Listing non à jour. Impossibilité de commercialiser. Sanctions FDA.",
    actionPlan: "1. Enregistrer l'établissement auprès de la FDA. 2. Lister tous les dispositifs commercialisés. 3. Mettre à jour annuellement. 4. Notifier les changements. 5. Maintenir les preuves. 6. Auditer la conformité.",
    aiPrompt: "Quelles sont les exigences d'enregistrement et de listing FDA (21 CFR 807) ? Comment effectuer la mise à jour annuelle ? Quels changements doivent être notifiés ?"
  },
  "4": {
    process: "Affaires réglementaires & interaction ON",
    reference: "FDA Device Classification",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Classification Justification", "Classification Database Search", "FDA Guidance Documents", "Predicate Research"],
    risks: "Classification erronée. Voie réglementaire inappropriée. Rejet FDA. Retard de commercialisation.",
    actionPlan: "1. Rechercher la classification FDA du dispositif. 2. Consulter la base de données FDA. 3. Identifier les predicates si applicable. 4. Justifier la classification. 5. Documenter la décision. 6. Valider avec un expert RA.",
    aiPrompt: "Comment classifier un dispositif médical selon la FDA (Class I/II/III) ? Où trouver la classification ? Comment gérer les cas ambigus ?"
  },
  "5": {
    process: "Affaires réglementaires & interaction ON",
    reference: "21 CFR 807 Subpart E - 510(k)",
    referential: "FDA_510K",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["510(k) Submission", "Predicate Comparison", "Substantial Equivalence Justification", "FDA Clearance Letter", "Post-clearance Change Evaluation"],
    risks: "Rejet 510(k). Retard de commercialisation. Substantial equivalence non démontrée. Observation FDA.",
    actionPlan: "1. Identifier un predicate approprié. 2. Conduire une comparaison technologique détaillée. 3. Démontrer la substantial equivalence. 4. Préparer le dossier 510(k). 5. Soumettre à la FDA. 6. Gérer les changements post-clearance. 7. Maintenir la cohérence produit-510(k).",
    aiPrompt: "Qu'est-ce qu'un 510(k) ? Comment démontrer la substantial equivalence ? Comment choisir un predicate approprié ? Quels changements nécessitent un nouveau 510(k) ?"
  },
  "6": {
    process: "Affaires réglementaires & interaction ON",
    reference: "21 CFR 860 - De Novo Classification",
    referential: "FDA_DE_NOVO",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["De Novo Request", "No Predicate Justification", "Risk Assessment", "Special Controls Definition", "FDA De Novo Grant"],
    risks: "Rejet De Novo. Retard de commercialisation. Contrôles spéciaux inadéquats. Observation FDA.",
    actionPlan: "1. Justifier l'absence de predicate. 2. Démontrer le risque faible/modéré. 3. Définir les contrôles spéciaux nécessaires. 4. Préparer la demande De Novo. 5. Soumettre à la FDA. 6. Intégrer les contrôles dans le QMS. 7. Maintenir la conformité.",
    aiPrompt: "Qu'est-ce qu'une demande De Novo ? Quand l'utiliser ? Comment définir les contrôles spéciaux ? Quelle est la différence avec un 510(k) ?"
  },
  "7": {
    process: "Affaires réglementaires & interaction ON",
    reference: "21 CFR 814 - Premarket Approval",
    referential: "FDA_PMA",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["PMA Application", "Clinical Data", "Non-clinical Testing", "Manufacturing Information", "FDA Approval Letter", "PMA Supplements"],
    risks: "Rejet PMA. Retard majeur de commercialisation. Données cliniques insuffisantes. Observation FDA.",
    actionPlan: "1. Préparer le dossier PMA complet. 2. Conduire les études cliniques nécessaires. 3. Compiler les données non-cliniques. 4. Documenter la fabrication. 5. Soumettre à la FDA. 6. Gérer les PMA supplements pour les changements. 7. Maintenir la conformité post-approval.",
    aiPrompt: "Qu'est-ce qu'un PMA ? Quand est-il requis (Class III) ? Quelles données cliniques sont nécessaires ? Comment gérer les PMA supplements ?"
  },
  "8": {
    process: "Conception & développement",
    reference: "FDA Software Guidance",
    referential: "FDA_QMSR",
    criticality: "high",
    role: "manufacturer_us",
    evidence: ["Software Documentation", "Software Development Plan", "Software Requirements", "Software V&V", "Cybersecurity Documentation", "Software Updates Procedure"],
    risks: "Logiciel non validé. Défaillances logicielles. Incidents patients. Cybersécurité compromise. Observation FDA.",
    actionPlan: "1. Qualifier le logiciel comme dispositif médical. 2. Déterminer le niveau de risque (Level of Concern). 3. Établir un Software Development Plan. 4. Définir les exigences logicielles. 5. Conduire V&V. 6. Assurer la cybersécurité. 7. Gérer les mises à jour. 8. Documenter dans le DHF.",
    aiPrompt: "Comment la FDA régule-t-elle les logiciels médicaux (SaMD) ? Qu'est-ce que le Level of Concern ? Quelles sont les attentes en matière de cybersécurité ?"
  },
  "9": {
    process: "Production & validation des procédés",
    reference: "21 CFR 801 / 830 - Labeling & UDI",
    referential: "FDA_LABELING_UDI",
    criticality: "medium",
    role: "manufacturer_us",
    evidence: ["Labeling Documentation", "Instructions for Use (IFU)", "UDI Assignment", "GUDID Registration", "Labeling Validation"],
    risks: "Étiquetage non conforme. UDI manquant. Impossibilité de commercialiser. Observation FDA.",
    actionPlan: "1. Créer la documentation d'étiquetage conforme FDA. 2. Rédiger les Instructions for Use (IFU). 3. Attribuer un UDI. 4. Enregistrer dans GUDID. 5. Valider l'étiquetage. 6. Maintenir la cohérence UDI-production. 7. Auditer la conformité.",
    aiPrompt: "Quelles sont les exigences FDA pour l'étiquetage (21 CFR 801) ? Qu'est-ce que l'UDI et comment l'attribuer ? Qu'est-ce que le GUDID ?"
  }
};

async function seedFdaReferentials() {
  console.log("🔄 Seeding FDA referentials...");
  
  const fdaReferentials = [
    {
      code: "FDA_QMSR",
      name: "FDA Quality Management System Regulation (QMSR)",
      description: "Nouvelle réglementation FDA alignée sur ISO 13485, en vigueur à partir du 2 février 2026",
      version: "2026"
    },
    {
      code: "FDA_820",
      name: "21 CFR Part 820 - Quality System Regulation",
      description: "Réglementation historique du système qualité FDA",
      version: "Current"
    },
    {
      code: "FDA_807",
      name: "21 CFR Part 807 - Establishment Registration & Device Listing",
      description: "Exigences d'enregistrement des établissements et de listing des dispositifs",
      version: "Current"
    },
    {
      code: "FDA_510K",
      name: "510(k) Premarket Notification",
      description: "Voie réglementaire pour démontrer la substantial equivalence",
      version: "Current"
    },
    {
      code: "FDA_DE_NOVO",
      name: "De Novo Classification Request",
      description: "Voie réglementaire pour dispositifs nouveaux sans prédicat",
      version: "Current"
    },
    {
      code: "FDA_PMA",
      name: "Premarket Approval (PMA)",
      description: "Processus d'approbation pour dispositifs de Classe III",
      version: "Current"
    },
    {
      code: "FDA_POSTMARKET",
      name: "FDA Postmarket Requirements",
      description: "Exigences post-commercialisation (MDR, recalls, corrections)",
      version: "Current"
    },
    {
      code: "FDA_LABELING_UDI",
      name: "FDA Labeling and UDI Requirements",
      description: "Exigences d'étiquetage et Unique Device Identification",
      version: "Current"
    }
  ];

  for (const ref of fdaReferentials) {
    await db.insert(referentials).values(ref).onDuplicateKeyUpdate({ set: { name: ref.name } });
  }

  console.log(`✅ Inserted ${fdaReferentials.length} FDA referentials`);
}

async function parseFdaQuestionsFile(): Promise<any[]> {
  const filePath = "/home/ubuntu/upload/pasted_content_7.txt";
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const fdaQuestions: any[] = [];
  let currentSection = "";
  let currentSectionKey = "";
  let questionBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect section headers (both "2.1 Title" and "3️⃣ Title")
    if (line.match(/^[0-9]+(\.[0-9]+)?/) || line.match(/^[0-9]+️⃣/)) {
      currentSection = line;
      // Extract section key (e.g., "2.4" from "2.4 Design controls" or "3" from "3️⃣")
      const matchSubsection = line.match(/^([0-9]+\.[0-9]+)/);
      const matchMainSection = line.match(/^([0-9]+)️⃣/);
      currentSectionKey = matchSubsection ? matchSubsection[1] : (matchMainSection ? matchMainSection[1] : line.split(" ")[0]);
      continue;
    }

    // Detect questions (lines ending with ?)
    if (line.endsWith("?") && line.length > 10) {
      questionBuffer.push(line);
    }

    // Empty line might indicate end of section
    if (line === "" && questionBuffer.length > 0) {
      // Process buffered questions
      const metadata = sectionMetadata[currentSectionKey] || {
        process: "Système de management de la qualité (QMS)",
        reference: "FDA General",
        referential: "FDA_QMSR",
        criticality: "high" as const,
        role: "manufacturer_us",
        evidence: ["Documentation FDA", "Procédures", "Enregistrements"],
        risks: "Non-conformité FDA. Observation lors d'inspection.",
        actionPlan: "1. Créer la documentation nécessaire. 2. Former les équipes. 3. Auditer l'application.",
        aiPrompt: "Expliquez les exigences FDA pour cette section."
      };

      for (const question of questionBuffer) {
        fdaQuestions.push({
          referentialCode: metadata.referential,
          processName: metadata.process,
          article: metadata.reference,
          economicRole: metadata.role,
          questionText: question,
          expectedEvidence: JSON.stringify(metadata.evidence),
          criticality: metadata.criticality,
          risks: metadata.risks,
          actionPlan: metadata.actionPlan,
          aiPrompt: metadata.aiPrompt,
          displayOrder: fdaQuestions.length
        });
      }

      questionBuffer = [];
    }
  }

  // Process any remaining questions
  if (questionBuffer.length > 0) {
    const metadata = sectionMetadata[currentSectionKey] || {
      process: "Système de management de la qualité (QMS)",
      reference: "FDA General",
      referential: "FDA_QMSR",
      criticality: "high" as const,
      role: "manufacturer_us",
      evidence: ["Documentation FDA", "Procédures", "Enregistrements"],
      risks: "Non-conformité FDA. Observation lors d'inspection.",
      actionPlan: "1. Créer la documentation nécessaire. 2. Former les équipes. 3. Auditer l'application.",
      aiPrompt: "Expliquez les exigences FDA pour cette section."
    };

    for (const question of questionBuffer) {
      fdaQuestions.push({
        referentialCode: metadata.referential,
        processName: metadata.process,
        article: metadata.reference,
        economicRole: metadata.role,
        questionText: question,
        expectedEvidence: JSON.stringify(metadata.evidence),
        criticality: metadata.criticality,
        risks: metadata.risks,
        actionPlan: metadata.actionPlan,
        aiPrompt: metadata.aiPrompt,
        displayOrder: fdaQuestions.length
      });
    }
  }

  return fdaQuestions;
}

async function seedFdaQuestions() {
  console.log("🔄 Parsing and seeding FDA questions...");

  const fdaQuestions = await parseFdaQuestionsFile();
  console.log(`📊 Parsed ${fdaQuestions.length} FDA questions`);

  // Get referential and process IDs
  const allReferentials = await db.select().from(referentials);
  const allProcesses = await db.select().from(processes);

  const refMap = new Map(allReferentials.map(r => [r.code, r.id]));
  const processMap = new Map(allProcesses.map(p => [p.name, p.id]));

  let inserted = 0;
  for (const q of fdaQuestions) {
    const referentialId = refMap.get(q.referentialCode);
    const processId = processMap.get(q.processName);

    if (!referentialId) {
      console.warn(`⚠️  Referential not found: ${q.referentialCode}`);
      continue;
    }
    if (!processId) {
      console.warn(`⚠️  Process not found: ${q.processName}`);
      continue;
    }

    await db.insert(questions).values({
      referentialId,
      processId,
      article: q.article,
      economicRole: q.economicRole,
      questionText: q.questionText,
      expectedEvidence: q.expectedEvidence,
      criticality: q.criticality,
      risks: q.risks,
      actionPlan: q.actionPlan,
      aiPrompt: q.aiPrompt,
      displayOrder: q.displayOrder
    });

    inserted++;
  }

  console.log(`✅ Inserted ${inserted} FDA questions`);
}

async function main() {
  console.log("🚀 Starting FDA seed...");
  
  await seedFdaReferentials();
  await seedFdaQuestions();
  
  console.log("✅ FDA seed completed!");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ FDA seed failed:", error);
  process.exit(1);
});
