
/**
 * Fallback data for the QARA platform
 * Fully aligned with the "RAPPORT-AUDIT-COMPLET" and user instructions.
 */

export const FALLBACK_REFERENTIALS = [
  { code: 'MDR', name: 'Règlement (UE) 2017/745 (MDR)', description: 'Règlement relatif aux dispositifs médicaux', version: '2017/745' },
  { code: 'ISO_13485', name: 'ISO 13485:2016', description: 'Dispositifs médicaux - Systèmes de management de la qualité', version: '2016' },
  { code: 'FDA_820', name: 'FDA 21 CFR Part 820 (QSR)', description: 'Quality System Regulation', version: 'Part 820' }
];

export const FALLBACK_PROCESSES = [
  { id: 1, name: "Gouvernance & stratégie réglementaire", description: "Pilotage et stratégie", displayOrder: 1, icon: "LayoutDashboard" },
  { id: 2, name: "Affaires réglementaires (RA)", description: "Conformité et enregistrements", displayOrder: 2, icon: "FileText" },
  { id: 3, name: "Système de management qualité (QMS)", description: "Maîtrise du SMQ", displayOrder: 3, icon: "ClipboardCheck" },
  { id: 4, name: "Gestion des risques (ISO 14971)", description: "Analyse des risques", displayOrder: 4, icon: "AlertTriangle" },
  { id: 5, name: "Conception & développement", description: "R&D et validation", displayOrder: 5, icon: "Lightbulb" },
  { id: 6, name: "Achats & fournisseurs", description: "Maîtrise des approvisionnements", displayOrder: 6, icon: "ShoppingCart" },
  { id: 7, name: "Production & sous-traitance", description: "Fabrication et opérations", displayOrder: 7, icon: "Factory" },
  { id: 8, name: "Traçabilité & UDI", description: "Identification et suivi", displayOrder: 8, icon: "Barcode" },
  { id: 9, name: "PMS / PMCF", description: "Surveillance après-vente", displayOrder: 9, icon: "Activity" },
  { id: 10, name: "Vigilance & incidents", description: "Gestion des événements indésirables", displayOrder: 10, icon: "Bell" },
  { id: 11, name: "Distribution & logistique", description: "Stockage et expédition", displayOrder: 11, icon: "Truck" },
  { id: 12, name: "Importation", description: "Maîtrise des flux import", displayOrder: 12, icon: "Globe" },
  { id: 13, name: "Documentation technique", description: "Dossiers techniques DM", displayOrder: 13, icon: "BookOpen" },
  { id: 14, name: "Audits & conformité", description: "Vérifications et inspections", displayOrder: 14, icon: "Search" },
  { id: 15, name: "IT / données / cybersécurité", description: "Sécurité des systèmes", displayOrder: 15, icon: "Shield" }
];

export const FALLBACK_MDR_QUESTIONS = [
  // LOT 1
  { id: 1, externalId: "MDR-Art1", article: "Art. 1", questionText: "Comment avez-vous déterminé que vos produits relèvent du champ MDR ?", criticality: "high", economicRole: "fabricant", processCategory: "Affaires réglementaires (RA)", displayOrder: 1, isActive: true },
  { id: 2, externalId: "MDR-Art10", article: "Art. 10", questionText: "Votre QMS couvre-t-il l’intégralité des exigences MDR ?", criticality: "critical", economicRole: "fabricant", processCategory: "Système de management qualité (QMS)", displayOrder: 2, isActive: true },
  // LOT 2
  { id: 3, externalId: "MDR-Art13", article: "Art. 13", questionText: "Comment l’importateur vérifie-t-il la conformité MDR avant mise sur le marché ?", criticality: "high", economicRole: "importateur", processCategory: "Importation", displayOrder: 3, isActive: true },
  { id: 4, externalId: "MDR-Art14", article: "Art. 14", questionText: "Comment le distributeur vérifie-t-il la conformité des DM reçus ?", criticality: "high", economicRole: "distributeur", processCategory: "Distribution & logistique", displayOrder: 4, isActive: true },
  { id: 5, externalId: "MDR-Art15", article: "Art. 15", questionText: "Une PRRC est-elle formellement désignée ?", criticality: "critical", economicRole: "fabricant", processCategory: "Gouvernance & stratégie réglementaire", displayOrder: 5, isActive: true },
  // ANNEXES
  { id: 6, externalId: "MDR-Ann1", article: "Annexe I", questionText: "Disposez-vous d’une matrice GSPR complète et justifiée point par point ?", criticality: "critical", economicRole: "fabricant", processCategory: "Documentation technique", displayOrder: 6, isActive: true },
  { id: 7, externalId: "MDR-Ann2", article: "Annexe II", questionText: "La documentation technique est-elle complète et cohérente ?", criticality: "critical", economicRole: "fabricant", processCategory: "Documentation technique", displayOrder: 7, isActive: true }
];

export const FALLBACK_ISO_QUESTIONS = [
  { id: 101, externalId: "ISO-4", standard: "13485", clauseTitle: "Clause 4", questionText: "Le périmètre du QMS est-il clairement défini ?", criticality: "high", applicability: "all", processCategory: "Système de management qualité (QMS)", displayOrder: 1 },
  { id: 102, externalId: "ISO-5", standard: "13485", clauseTitle: "Clause 5", questionText: "La direction démontre-t-elle son engagement QMS ?", criticality: "high", applicability: "all", processCategory: "Gouvernance & stratégie réglementaire", displayOrder: 2 },
  { id: 103, externalId: "ISO-7", standard: "13485", clauseTitle: "Clause 7.4", questionText: "Comment sont évalués et qualifiés les fournisseurs critiques ?", criticality: "critical", applicability: "all", processCategory: "Achats & fournisseurs", displayOrder: 3 },
  { id: 104, externalId: "ISO-8", standard: "13485", clauseTitle: "Clause 8.2.2", questionText: "Existe-t-il un programme d’audit interne basé sur le risque ?", criticality: "high", applicability: "all", processCategory: "Audits & conformité", displayOrder: 4 }
];

export const FALLBACK_FDA_QUESTIONS = [
  { id: 201, externalId: "FDA-1", frameworkCode: "FDA_820", questionShort: "QSR Compliance", questionDetailed: "Does the manufacturer establish and maintain a quality system?", criticality: "critical", applicabilityType: "ALL", process: "Système de management qualité (QMS)" },
  { id: 202, externalId: "FDA-2", frameworkCode: "FDA_807", questionShort: "Registration", questionDetailed: "Is the establishment registered with the FDA?", criticality: "high", applicabilityType: "ALL", process: "Affaires réglementaires (RA)" }
];
