/**
 * Fallback data for the QARA platform
 * Fully aligned with the "RAPPORT-AUDIT-COMPLET" and user instructions.
 * Structured to be ultra-tolerant and prevent frontend crashes.
 */

export const FALLBACK_REFERENTIALS = [
  { code: 'MDR', name: 'Règlement (UE) 2017/745 (MDR)', description: 'Règlement relatif aux dispositifs médicaux', version: '2017/745' },
  { code: 'ISO_13485', name: 'ISO 13485:2016', description: 'Dispositifs médicaux - Systèmes de management de la qualité', version: '2016' },
  { code: 'FDA_820', name: 'FDA 21 CFR Part 820 (QSR)', description: 'Quality System Regulation', version: 'Part 820' }
];

export const FALLBACK_PROCESSES = [
  { id: "gov_strat", name: "Gouvernance & stratégie réglementaire", description: "Pilotage et stratégie", displayOrder: 1, icon: "LayoutDashboard" },
  { id: "ra", name: "Affaires réglementaires (RA)", description: "Conformité et enregistrements", displayOrder: 2, icon: "FileText" },
  { id: "qms", name: "Système de management qualité (QMS)", description: "Maîtrise du SMQ", displayOrder: 3, icon: "ClipboardCheck" },
  { id: "risk_mgmt", name: "Gestion des risques (ISO 14971)", description: "Analyse des risques", displayOrder: 4, icon: "AlertTriangle" },
  { id: "design_dev", name: "Conception & développement", description: "R&D et validation", displayOrder: 5, icon: "Lightbulb" },
  { id: "purchasing_suppliers", name: "Achats & fournisseurs", description: "Maîtrise des approvisionnements", displayOrder: 6, icon: "ShoppingCart" },
  { id: "production_sub", name: "Production & sous-traitance", description: "Fabrication et opérations", displayOrder: 7, icon: "Factory" },
  { id: "traceability_udi", name: "Traçabilité & UDI", description: "Identification et suivi", displayOrder: 8, icon: "Barcode" },
  { id: "pms_pmcf", name: "PMS / PMCF", description: "Surveillance après-vente", displayOrder: 9, icon: "Activity" },
  { id: "vigilance_incidents", name: "Vigilance & incidents", description: "Gestion des événements indésirables", displayOrder: 10, icon: "Bell" },
  { id: "distribution_logistics", name: "Distribution & logistique", description: "Stockage et expédition", displayOrder: 11, icon: "Truck" },
  { id: "importation", name: "Importation", description: "Maîtrise des flux import", displayOrder: 12, icon: "Globe" },
  { id: "tech_doc", name: "Documentation technique", description: "Dossiers techniques DM", displayOrder: 13, icon: "BookOpen" },
  { id: "audits_compliance", name: "Audits & conformité", description: "Vérifications et inspections", displayOrder: 14, icon: "Search" },
  { id: "it_data_cyber", name: "IT / données / cybersécurité (si applicable)", description: "Sécurité des systèmes", displayOrder: 15, icon: "Shield" }
];

// CRITICAL: Every question MUST have an ID and economicRole (never undefined)
export const FALLBACK_MDR_QUESTIONS = [
  { 
    id: "mdr-art1-q1", 
    article: "Article 1", 
    questionText: "Comment avez-vous déterminé que vos produits relèvent du champ MDR ?", 
    questionShort: "Qualification du champ d'application",
    criticality: "high", 
    economicRole: "fabricant", 
    processCategory: "Affaires réglementaires (RA)", 
    applicableRoles: ["fabricant"],
    applicableProcesses: ["gov_strat", "ra"],
    displayOrder: 1, 
    isActive: true 
  },
  { 
    id: "mdr-art1-q2", 
    article: "Article 1", 
    questionText: "Disposez-vous d'une justification écrite de qualification réglementaire ?", 
    questionShort: "Justification de qualification",
    criticality: "high", 
    economicRole: "fabricant", 
    processCategory: "Affaires réglementaires (RA)", 
    applicableRoles: ["fabricant"],
    applicableProcesses: ["gov_strat", "ra"],
    displayOrder: 2, 
    isActive: true 
  },
  { 
    id: "mdr-art1-q3", 
    article: "Article 1", 
    questionText: "Comment traitez-vous les produits frontières (logiciel, accessoire, service associé) ?", 
    questionShort: "Produits frontières",
    criticality: "high", 
    economicRole: "fabricant", 
    processCategory: "Affaires réglementaires (RA)", 
    applicableRoles: ["fabricant"],
    applicableProcesses: ["gov_strat", "ra"],
    displayOrder: 3, 
    isActive: true 
  },
  { 
    id: "mdr-art1-q4", 
    article: "Article 1", 
    questionText: "Qui valide formellement la qualification DM ?", 
    questionShort: "Validation qualification DM",
    criticality: "high", 
    economicRole: "fabricant", 
    processCategory: "Affaires réglementaires (RA)", 
    applicableRoles: ["fabricant"],
    applicableProcesses: ["gov_strat", "ra"],
    displayOrder: 4, 
    isActive: true 
  },
  { 
    id: "mdr-art1-q5", 
    article: "Article 1", 
    questionText: "Comment assurez-vous une veille réglementaire sur l'évolution du champ MDR ?", 
    questionShort: "Veille réglementaire",
    criticality: "medium", 
    economicRole: "fabricant", 
    processCategory: "Affaires réglementaires (RA)", 
    applicableRoles: ["fabricant"],
    applicableProcesses: ["gov_strat", "ra"],
    displayOrder: 5, 
    isActive: true 
  },
  {
    id: "mdr-art2-q1",
    article: "Article 2",
    questionText: "Où sont formalisées les définitions réglementaires clés ?",
    questionShort: "Définitions réglementaires",
    criticality: "medium",
    economicRole: "fabricant",
    processCategory: "Gouvernance QMS",
    applicableRoles: ["fabricant", "importateur", "distributeur"],
    applicableProcesses: ["qms", "tech_doc"],
    displayOrder: 6,
    isActive: true
  },
  {
    id: "mdr-art2-q2",
    article: "Article 2",
    questionText: "Comment assurez-vous l'alignement du vocabulaire interne avec le MDR ?",
    questionShort: "Alignement vocabulaire MDR",
    criticality: "medium",
    economicRole: "fabricant",
    processCategory: "Gouvernance QMS",
    applicableRoles: ["fabricant", "importateur", "distributeur"],
    applicableProcesses: ["qms", "tech_doc"],
    displayOrder: 7,
    isActive: true
  },
  {
    id: "mdr-art2-q3",
    article: "Article 2",
    questionText: "Les formations internes couvrent-elles les termes critiques MDR ?",
    questionShort: "Formations internes MDR",
    criticality: "medium",
    economicRole: "fabricant",
    processCategory: "Gouvernance QMS",
    applicableRoles: ["fabricant", "importateur", "distributeur"],
    applicableProcesses: ["qms", "tech_doc"],
    displayOrder: 8,
    isActive: true
  },
  {
    id: "mdr-art2-q4",
    article: "Article 2",
    questionText: "Comment évitez-vous les interprétations divergentes entre services ?",
    questionShort: "Interprétations divergentes",
    criticality: "medium",
    economicRole: "fabricant",
    processCategory: "Gouvernance QMS",
    applicableRoles: ["fabricant", "importateur", "distributeur"],
    applicableProcesses: ["qms", "tech_doc"],
    displayOrder: 9,
    isActive: true
  },
  {
    id: "mdr-art10-q1",
    article: "Article 10",
    questionText: "Votre QMS couvre-t-il l'intégralité des exigences MDR ?",
    questionShort: "Couverture QMS / MDR",
    criticality: "critical",
    economicRole: "fabricant",
    processCategory: "QMS",
    applicableRoles: ["fabricant"],
    applicableProcesses: ["qms", "ra", "pms_pmcf", "risk_mgmt"],
    displayOrder: 36,
    isActive: true
  },
  {
    id: "mdr-art10-q2",
    article: "Article 10",
    questionText: "Comment démontrez-vous la conformité sur tout le cycle de vie ?",
    questionShort: "Conformité cycle de vie",
    criticality: "critical",
    economicRole: "fabricant",
    processCategory: "QMS",
    applicableRoles: ["fabricant"],
    applicableProcesses: ["qms", "ra", "pms_pmcf", "risk_mgmt"],
    displayOrder: 37,
    isActive: true
  },
  {
    id: "mdr-art13-q1",
    article: "Article 13",
    questionText: "Comment l'importateur vérifie-t-il la conformité MDR avant mise sur le marché ?",
    questionShort: "Vérification Importateur",
    criticality: "critical",
    economicRole: "importateur",
    processCategory: "Importation",
    applicableRoles: ["importateur"],
    applicableProcesses: ["importation", "qms"],
    displayOrder: 52,
    isActive: true
  },
  {
    id: "mdr-art14-q1",
    article: "Article 14",
    questionText: "Comment le distributeur vérifie-t-il la conformité des DM reçus ?",
    questionShort: "Vérification Distributeur",
    criticality: "critical",
    economicRole: "distributeur",
    processCategory: "Distribution",
    applicableRoles: ["distributeur"],
    applicableProcesses: ["distribution_logistics", "qms"],
    displayOrder: 57,
    isActive: true
  },
  {
    id: "mdr-art15-q1",
    article: "Article 15",
    questionText: "Une PRRC est-elle formellement désignée ?",
    questionShort: "Désignation PRRC",
    criticality: "critical",
    economicRole: "fabricant",
    processCategory: "Gouvernance",
    applicableRoles: ["fabricant", "mandataire"],
    applicableProcesses: ["gov_strat", "ra"],
    displayOrder: 62,
    isActive: true
  },
  {
    id: "mdr-ann1-q1",
    article: "Annexe I",
    questionText: "Disposez-vous d'une matrice GSPR complète et justifiée point par point ?",
    questionShort: "Matrice GSPR",
    criticality: "critical",
    economicRole: "fabricant",
    processCategory: "Documentation technique",
    applicableRoles: ["fabricant"],
    applicableProcesses: ["tech_doc"],
    displayOrder: 100,
    isActive: true
  },
  {
    id: "mdr-ann2-q1",
    article: "Annexe II",
    questionText: "La documentation technique est-elle complète et cohérente ?",
    questionShort: "Documentation Technique",
    criticality: "critical",
    economicRole: "fabricant",
    processCategory: "Documentation technique",
    applicableRoles: ["fabricant"],
    applicableProcesses: ["tech_doc"],
    displayOrder: 101,
    isActive: true
  }
];

export const FALLBACK_ISO_QUESTIONS = [
  { id: "iso-4-q1", externalId: "ISO-4", standard: "13485", clauseTitle: "Clause 4", questionText: "Le périmètre du QMS est-il clairement défini ?", criticality: "high", applicability: "all", processCategory: "Système de management qualité (QMS)", displayOrder: 1 },
  { id: "iso-5-q1", externalId: "ISO-5", standard: "13485", clauseTitle: "Clause 5", questionText: "La direction démontre-t-elle son engagement QMS ?", criticality: "high", applicability: "all", processCategory: "Gouvernance & stratégie réglementaire", displayOrder: 2 },
  { id: "iso-7-4-q1", externalId: "ISO-7.4", standard: "13485", clauseTitle: "Clause 7.4", questionText: "Comment sont évalués et qualifiés les fournisseurs critiques ?", criticality: "critical", applicability: "all", processCategory: "Achats & fournisseurs", displayOrder: 3 },
  { id: "iso-8-2-2-q1", externalId: "ISO-8.2.2", standard: "13485", clauseTitle: "Clause 8.2.2", questionText: "Existe-t-il un programme d'audit interne basé sur le risque ?", criticality: "high", applicability: "all", processCategory: "Audits & conformité", displayOrder: 4 }
];

export const FALLBACK_FDA_QUESTIONS = [
  { id: "fda-820-q1", externalId: "FDA-1", frameworkCode: "FDA_820", questionShort: "QSR Compliance", questionDetailed: "Does the manufacturer establish and maintain a quality system?", criticality: "critical", applicabilityType: "ALL", process: "Système de management qualité (QMS)" },
  { id: "fda-807-q1", externalId: "FDA-2", frameworkCode: "FDA_807", questionShort: "Registration", questionDetailed: "Is the establishment registered with the FDA?", criticality: "high", applicabilityType: "ALL", process: "Affaires réglementaires (RA)" }
];
