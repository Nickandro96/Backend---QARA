/**
 * Script de conversion des questions FDA en format structuré JSON
 * Convertit les questions brutes en format compatible avec la base de données
 */

interface FdaQuestion {
  referential: string;
  process: string;
  reference: string;
  role: string;
  question: string;
  evidence: string[];
  criticality: "high" | "medium" | "low";
  risks: string;
  action_plan: string;
  ai_prompt: string;
}

// Mapping des sections vers processus et références
const sectionMapping: Record<string, { process: string; reference: string; criticality: "high" | "medium" | "low" }> = {
  "role_responsibilities": { process: "Gouvernance & Management", reference: "FDA General", criticality: "high" },
  "qms_structure": { process: "Système Qualité", reference: "21 CFR 820 / QMSR", criticality: "high" },
  "management_responsibility": { process: "Gouvernance & Management", reference: "21 CFR 820.20", criticality: "high" },
  "document_control": { process: "Gestion documentaire", reference: "21 CFR 820.40", criticality: "high" },
  "design_controls": { process: "Design & Development", reference: "21 CFR 820.30", criticality: "high" },
  "risk_management": { process: "Gestion des risques", reference: "FDA Risk Management", criticality: "high" },
  "supplier_controls": { process: "Achats & Fournisseurs", reference: "21 CFR 820.50", criticality: "high" },
  "production_controls": { process: "Production & Fabrication", reference: "21 CFR 820.70", criticality: "high" },
  "identification_traceability": { process: "Production & Fabrication", reference: "21 CFR 820.60", criticality: "high" },
  "nonconforming_product": { process: "Non-conformités", reference: "21 CFR 820.90", criticality: "high" },
  "capa": { process: "CAPA", reference: "21 CFR 820.100", criticality: "high" },
  "complaint_handling": { process: "Réclamations & PMS", reference: "21 CFR 820.198", criticality: "high" },
  "mdr_reporting": { process: "Réclamations & PMS", reference: "21 CFR 803", criticality: "high" },
  "registration_listing": { process: "Enregistrement & Listing", reference: "21 CFR 807", criticality: "high" },
  "classification": { process: "Classification US", reference: "FDA Classification", criticality: "high" },
  "510k": { process: "510(k) Premarket", reference: "21 CFR 807 Subpart E", criticality: "high" },
  "de_novo": { process: "De Novo Request", reference: "21 CFR 860", criticality: "high" },
  "pma": { process: "PMA", reference: "21 CFR 814", criticality: "high" },
  "software": { process: "Logiciel médical", reference: "FDA Software Guidance", criticality: "high" },
  "labeling_udi": { process: "Étiquetage & UDI", reference: "21 CFR 801 / 830", criticality: "medium" },
};

export const fdaQuestions: FdaQuestion[] = [
  // 1. RÔLE & RESPONSABILITÉS
  {
    referential: "FDA_QMSR",
    process: "Gouvernance & Management",
    reference: "FDA General",
    role: "manufacturer_us",
    question: "Où est documentée la responsabilité réglementaire FDA de l'entité (manufacturer vs specification developer) ?",
    evidence: ["Organigramme réglementaire", "Matrice de responsabilités FDA", "Quality Manual", "Regulatory Affairs Charter"],
    criticality: "high",
    risks: "Confusion des responsabilités FDA. Non-conformité lors d'inspection. Impossibilité de démontrer la chaîne de responsabilité.",
    action_plan: "1. Définir clairement le rôle FDA de l'entité (manufacturer, specification developer, contract manufacturer). 2. Documenter dans le Quality Manual. 3. Créer une matrice de responsabilités FDA. 4. Former les équipes concernées. 5. Communiquer aux autorités si nécessaire.",
    ai_prompt: "Expliquez la différence entre 'manufacturer' et 'specification developer' selon la FDA. Quelles sont les responsabilités de chaque rôle ? Comment documenter ces responsabilités ?"
  },
  {
    referential: "FDA_QMSR",
    process: "Gouvernance & Management",
    reference: "FDA General",
    role: "manufacturer_us",
    question: "Quelle preuve démontre que les responsabilités FDA sont connues, communiquées et comprises ?",
    evidence: ["Formation réglementaire FDA", "Attestations de formation", "Job descriptions avec responsabilités FDA", "Communication interne FDA"],
    criticality: "high",
    risks: "Personnel non formé aux exigences FDA. Erreurs réglementaires. Observation FDA lors d'inspection.",
    action_plan: "1. Créer un programme de formation FDA pour tous les rôles clés. 2. Intégrer les responsabilités FDA dans les job descriptions. 3. Organiser des sessions de sensibilisation. 4. Documenter les formations. 5. Évaluer la compréhension.",
    ai_prompt: "Quelles formations FDA sont nécessaires pour les différents rôles (design, production, qualité, RA) ? Comment évaluer la compréhension des responsabilités FDA ?"
  },
  {
    referential: "FDA_QMSR",
    process: "Gouvernance & Management",
    reference: "FDA General",
    role: "manufacturer_us",
    question: "Comment est assurée la responsabilité FDA lorsque la fabrication est sous-traitée ?",
    evidence: ["Contrat de sous-traitance avec clauses FDA", "Quality Agreement", "Audits de sous-traitants", "Matrice de responsabilités contractuelles"],
    criticality: "high",
    risks: "Responsabilité FDA floue. Non-conformité du sous-traitant non détectée. Observation FDA majeure.",
    action_plan: "1. Établir un Quality Agreement définissant les responsabilités FDA. 2. Inclure des clauses FDA dans les contrats. 3. Auditer les sous-traitants sur les exigences FDA. 4. Maintenir la surveillance continue. 5. Documenter la chaîne de responsabilité.",
    ai_prompt: "Quelles sont les responsabilités FDA d'un specification developer qui sous-traite la fabrication ? Que doit contenir un Quality Agreement FDA ?"
  },
  {
    referential: "FDA_QMSR",
    process: "Gouvernance & Management",
    reference: "FDA General",
    role: "specification_developer",
    question: "Où est décrite l'interface réglementaire entre specification developer et contract manufacturer ?",
    evidence: ["Interface Agreement", "Quality Agreement", "Matrice RACI FDA", "Procédure de gestion de l'interface"],
    criticality: "high",
    risks: "Gaps dans les responsabilités FDA. Conflits lors d'inspection. Non-conformité non détectée.",
    action_plan: "1. Créer un Interface Agreement détaillant les responsabilités de chaque partie. 2. Définir les points de contrôle FDA. 3. Établir un processus de communication réglementaire. 4. Auditer l'interface régulièrement. 5. Documenter toutes les décisions FDA.",
    ai_prompt: "Comment structurer l'interface réglementaire entre specification developer et contract manufacturer ? Quels sont les points critiques à définir ?"
  },
  {
    referential: "FDA_QMSR",
    process: "Gouvernance & Management",
    reference: "FDA General",
    role: "tous",
    question: "Comment sont gérées les décisions réglementaires critiques (classification, voie, changements) ?",
    evidence: ["Procédure de décision réglementaire", "Comité réglementaire", "Registre des décisions FDA", "Justifications documentées"],
    criticality: "high",
    risks: "Décisions FDA non documentées. Impossibilité de justifier les choix lors d'inspection. Risque de non-conformité.",
    action_plan: "1. Créer un comité de décision réglementaire. 2. Établir une procédure de prise de décision FDA. 3. Documenter toutes les décisions critiques avec justifications. 4. Maintenir un registre des décisions. 5. Réviser périodiquement les décisions.",
    ai_prompt: "Comment structurer un processus de décision réglementaire FDA ? Quelles décisions doivent être documentées ? Proposez un template de justification de décision FDA."
  },

  // 2. QMS FDA - STRUCTURE
  {
    referential: "FDA_QMSR",
    process: "Système Qualité",
    reference: "21 CFR 820 / QMSR",
    role: "manufacturer_us",
    question: "Où est défini le périmètre du QMS FDA ?",
    evidence: ["Quality Manual", "QMS Scope Statement", "Cartographie des processus FDA", "Exclusions justifiées"],
    criticality: "high",
    risks: "Périmètre QMS flou. Processus critiques non couverts. Observation FDA lors d'inspection.",
    action_plan: "1. Définir le périmètre du QMS FDA dans le Quality Manual. 2. Lister tous les processus couverts. 3. Justifier les exclusions éventuelles. 4. Cartographier les processus FDA. 5. Communiquer le périmètre à toutes les équipes.",
    ai_prompt: "Comment définir le périmètre d'un QMS FDA ? Quels processus doivent obligatoirement être couverts ? Comment justifier des exclusions ?"
  },
  {
    referential: "FDA_QMSR",
    process: "Système Qualité",
    reference: "21 CFR 820 / QMSR",
    role: "manufacturer_us",
    question: "Comment démontrez-vous que le QMS couvre l'ensemble du cycle de vie du dispositif ?",
    evidence: ["Cartographie cycle de vie", "Matrice processus × phases", "Procédures par phase", "Revues de phase"],
    criticality: "high",
    risks: "Gaps dans la couverture du cycle de vie. Phases critiques non maîtrisées. Non-conformité FDA.",
    action_plan: "1. Cartographier le cycle de vie complet (design, production, distribution, post-market). 2. Identifier les processus FDA pour chaque phase. 3. Créer une matrice de couverture. 4. Combler les gaps identifiés. 5. Auditer la couverture régulièrement.",
    ai_prompt: "Quelles sont les phases du cycle de vie d'un dispositif médical selon la FDA ? Quels processus QMS doivent être en place pour chaque phase ?"
  },
  {
    referential: "FDA_QMSR",
    process: "Système Qualité",
    reference: "21 CFR 820 / QMSR",
    role: "manufacturer_us",
    question: "Quelle cartographie montre l'interaction entre les processus FDA critiques ?",
    evidence: ["Cartographie des processus", "Diagramme d'interaction", "Matrice des interfaces", "Process Map"],
    criticality: "medium",
    risks: "Interfaces processus mal définies. Gaps entre processus. Inefficacité du QMS.",
    action_plan: "1. Créer une cartographie des processus FDA. 2. Identifier les interfaces critiques. 3. Définir les inputs/outputs de chaque processus. 4. Documenter les interactions. 5. Réviser lors des changements.",
    ai_prompt: "Comment cartographier les interactions entre processus FDA (design, production, CAPA, complaints) ? Proposez un diagramme d'interaction."
  },
  {
    referential: "FDA_QMSR",
    process: "Système Qualité",
    reference: "QMSR Transition",
    role: "manufacturer_us",
    question: "Comment assurez-vous l'alignement entre ISO 13485 et les exigences FDA additionnelles ?",
    evidence: ["Matrice ISO 13485 vs FDA", "Gap analysis", "Procédures additionnelles FDA", "Formation sur les différences"],
    criticality: "high",
    risks: "Gaps entre ISO 13485 et FDA. Non-conformité FDA malgré certification ISO. Observation lors d'inspection.",
    action_plan: "1. Réaliser un gap analysis ISO 13485 vs FDA (820/QMSR). 2. Identifier les exigences FDA additionnelles. 3. Créer des procédures complémentaires. 4. Former les équipes sur les différences. 5. Auditer la conformité FDA spécifique.",
    ai_prompt: "Quelles sont les principales différences entre ISO 13485 et les exigences FDA (Part 820/QMSR) ? Quelles exigences FDA sont additionnelles à ISO 13485 ?"
  },
  {
    referential: "FDA_QMSR",
    process: "Système Qualité",
    reference: "QMSR Transition",
    role: "manufacturer_us",
    question: "Quelle preuve montre la transition QMSR planifiée avant le 2 février 2026 ?",
    evidence: ["Plan de transition QMSR", "Gap analysis Part 820 vs QMSR", "Roadmap de mise en conformité", "Formation QMSR", "Audits de transition"],
    criticality: "high",
    risks: "Non-conformité QMSR après le 2 février 2026. Observation FDA majeure. Impossibilité de commercialiser.",
    action_plan: "1. Réaliser un gap analysis Part 820 vs QMSR. 2. Créer un plan de transition détaillé. 3. Identifier les changements nécessaires (procédures, formations, audits). 4. Mettre en œuvre les changements avant février 2026. 5. Auditer la conformité QMSR. 6. Documenter la transition.",
    ai_prompt: "Qu'est-ce que le QMSR FDA et quelle est sa date d'effet (2 février 2026) ? Quelles sont les principales différences avec le 21 CFR Part 820 ? Comment planifier la transition ?"
  }
];

console.log(`Generated ${fdaQuestions.length} FDA questions`);
console.log(JSON.stringify(fdaQuestions, null, 2));
