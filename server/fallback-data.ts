
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
  // CHAPITRE I & II - OBLIGATIONS GÉNÉRALES
  { id: "mdr-art1-q1", article: "Article 1", questionText: "Le dispositif entre-t-il dans le champ d'application du MDR ?", questionShort: "Champ d'application", criticality: "critical", economicRole: "fabricant", processCategory: "Affaires réglementaires (RA)", applicableRoles: ["fabricant"], applicableProcesses: ["gov_strat", "ra"], displayOrder: 1, isActive: true },
  { id: "mdr-art10-q1", article: "Article 10", questionText: "Le fabricant a-t-il établi, documenté et mis en œuvre un système de gestion des risques ?", questionShort: "Gestion des risques", criticality: "critical", economicRole: "fabricant", processCategory: "Gestion des risques", applicableRoles: ["fabricant"], applicableProcesses: ["risk_mgmt"], displayOrder: 2, isActive: true },
  { id: "mdr-art10-q2", article: "Article 10", questionText: "Le système de management de la qualité (QMS) est-il conforme à l'Article 10(9) ?", questionShort: "QMS", criticality: "critical", economicRole: "fabricant", processCategory: "QMS", applicableRoles: ["fabricant"], applicableProcesses: ["qms"], displayOrder: 3, isActive: true },
  { id: "mdr-art11-q1", article: "Article 11", questionText: "Le mandataire a-t-il été désigné par écrit par le fabricant hors UE ?", questionShort: "Mandataire", criticality: "critical", economicRole: "mandataire", processCategory: "Gouvernance", applicableRoles: ["mandataire"], applicableProcesses: ["gov_strat"], displayOrder: 4, isActive: true },
  { id: "mdr-art13-q1", article: "Article 13", questionText: "L'importateur vérifie-t-il que le dispositif porte le marquage CE ?", questionShort: "Importateur", criticality: "high", economicRole: "importateur", processCategory: "Importation", applicableRoles: ["importateur"], applicableProcesses: ["importation"], displayOrder: 5, isActive: true },
  { id: "mdr-art14-q1", article: "Article 14", questionText: "Le distributeur vérifie-t-il que les informations accompagnant le dispositif sont fournies ?", questionShort: "Distributeur", criticality: "medium", economicRole: "distributeur", processCategory: "Distribution", applicableRoles: ["distributeur"], applicableProcesses: ["distribution_logistics"], displayOrder: 6, isActive: true },
  { id: "mdr-art15-q1", article: "Article 15", questionText: "L'organisation dispose-t-elle d'au moins une PRRC (Personne Responsable du Respect de la Réglementation) ?", questionShort: "PRRC", criticality: "critical", economicRole: "fabricant", processCategory: "Gouvernance", applicableRoles: ["fabricant"], applicableProcesses: ["gov_strat", "ra"], displayOrder: 7, isActive: true },

  // CHAPITRE III - IDENTIFICATION & TRAÇABILITÉ
  { id: "mdr-art24-q1", article: "Article 24", questionText: "Disposez-vous d'une procédure UDI documentée ?", questionShort: "Procédure UDI", criticality: "critical", economicRole: "fabricant", processCategory: "Traçabilité", applicableRoles: ["fabricant"], applicableProcesses: ["traceability_udi"], displayOrder: 8, isActive: true },
  { id: "mdr-art25-q1", article: "Article 25", questionText: "Comment identifiez-vous les opérateurs économiques dans la chaîne d'approvisionnement ?", questionShort: "Opérateurs économiques", criticality: "medium", economicRole: "fabricant", processCategory: "Supply Chain", applicableRoles: ["fabricant"], applicableProcesses: ["purchasing_suppliers"], displayOrder: 9, isActive: true },
  { id: "mdr-art27-q1", article: "Article 27", questionText: "Comment est intégré l'UDI dans la PMS et la vigilance ?", questionShort: "UDI/PMS", criticality: "high", economicRole: "fabricant", processCategory: "PMS", applicableRoles: ["fabricant"], applicableProcesses: ["pms_pmcf", "vigilance_incidents"], displayOrder: 10, isActive: true },
  { id: "mdr-art30-q1", article: "Article 30", questionText: "La traçabilité permet-elle une identification rapide des lots/séries ?", questionShort: "Traçabilité lots", criticality: "critical", economicRole: "fabricant", processCategory: "Traçabilité", applicableRoles: ["fabricant"], applicableProcesses: ["traceability_udi"], displayOrder: 11, isActive: true },

  // CHAPITRE IV - ORGANISMES NOTIFIÉS
  { id: "mdr-art38-q1", article: "Article 38", questionText: "La procédure d'évaluation de conformité est-elle documentée ?", questionShort: "Évaluation conformité", criticality: "critical", economicRole: "fabricant", processCategory: "RA", applicableRoles: ["fabricant"], applicableProcesses: ["ra"], displayOrder: 12, isActive: true },
  { id: "mdr-art40-q1", article: "Article 40", questionText: "Les certificats CE MDR sont-ils valides et à jour ?", questionShort: "Certificats CE", criticality: "critical", economicRole: "fabricant", processCategory: "RA", applicableRoles: ["fabricant"], applicableProcesses: ["ra"], displayOrder: 13, isActive: true },

  // CHAPITRE VI & VII - CLINIQUE, PMS, VIGILANCE
  { id: "mdr-art41-q1", article: "Article 41", questionText: "Disposez-vous d'une procédure d'évaluation clinique conforme MDR ?", questionShort: "Évaluation clinique", criticality: "critical", economicRole: "fabricant", processCategory: "Clinique", applicableRoles: ["fabricant"], applicableProcesses: ["pms_pmcf"], displayOrder: 14, isActive: true },
  { id: "mdr-art49-q1", article: "Article 49", questionText: "Disposez-vous d'un plan PMS conforme MDR ?", questionShort: "Plan PMS", criticality: "critical", economicRole: "fabricant", processCategory: "PMS", applicableRoles: ["fabricant"], applicableProcesses: ["pms_pmcf"], displayOrder: 15, isActive: true },
  { id: "mdr-art51-q1", article: "Article 51", questionText: "Disposez-vous d'une procédure de vigilance conforme MDR ?", questionShort: "Vigilance", criticality: "critical", economicRole: "fabricant", processCategory: "Vigilance", applicableRoles: ["fabricant"], applicableProcesses: ["vigilance_incidents"], displayOrder: 16, isActive: true },
  { id: "mdr-art52-q1", article: "Article 52", questionText: "Les délais de déclaration réglementaires des incidents graves sont-ils maîtrisés ?", questionShort: "Délais vigilance", criticality: "critical", economicRole: "fabricant", processCategory: "Vigilance", applicableRoles: ["fabricant"], applicableProcesses: ["vigilance_incidents"], displayOrder: 17, isActive: true },

  // ANNEXES MDR
  { id: "mdr-ann1-q1", article: "Annexe I", questionText: "Disposez-vous d'une matrice GSPR complète et justifiée point par point ?", questionShort: "Matrice GSPR", criticality: "critical", economicRole: "fabricant", processCategory: "Documentation technique", applicableRoles: ["fabricant"], applicableProcesses: ["tech_doc"], displayOrder: 18, isActive: true },
  { id: "mdr-ann2-q1", article: "Annexe II", questionText: "La documentation technique est-elle complète et cohérente ?", questionShort: "Documentation Technique", criticality: "critical", economicRole: "fabricant", processCategory: "Documentation technique", applicableRoles: ["fabricant"], applicableProcesses: ["tech_doc"], displayOrder: 19, isActive: true }
];

export const FALLBACK_ISO_QUESTIONS = [
  { id: "iso-4-1-q1", article: "Clause 4.1", questionText: "Le système de management de la qualité est-il documenté et maintenu ?", questionShort: "Documentation SMQ", criticality: "high", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["qms"] },
  { id: "iso-7-3-q1", article: "Clause 7.3", questionText: "Existe-t-il un plan de développement documenté intégrant les exigences MDR ?", questionShort: "Plan développement", criticality: "critical", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["design_dev"] },
  { id: "iso-7-4-q1", article: "Clause 7.4", questionText: "Les fournisseurs critiques sont-ils évalués et sélectionnés selon une procédure ?", questionShort: "Sélection fournisseurs", criticality: "high", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["purchasing_suppliers"] },
  { id: "iso-8-2-q1", article: "Clause 8.2", questionText: "Existe-t-il un programme d'audit interne basé sur le risque ?", questionShort: "Audit interne", criticality: "critical", economicRole: "fabricant", applicableRoles: ["fabricant"], applicableProcesses: ["audits_compliance"] }
];

export const FALLBACK_FDA_QUESTIONS = [
  { id: "fda-820-q1", externalId: "FDA-1", frameworkCode: "FDA_820", questionShort: "QSR Compliance", questionDetailed: "Does the manufacturer establish and maintain a quality system?", criticality: "critical", applicabilityType: "ALL", process: "Système de management qualité (QMS)" },
  { id: "fda-807-q1", externalId: "FDA-2", frameworkCode: "FDA_807", questionShort: "Registration", questionDetailed: "Is the establishment registered with the FDA?", criticality: "high", applicabilityType: "ALL", process: "Affaires réglementaires (RA)" }
];
