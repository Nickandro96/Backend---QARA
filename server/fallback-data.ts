
/**
 * Fallback data for the QARA platform
 * Used when the database is empty or unavailable
 */

export const FALLBACK_REFERENTIALS = [
  { code: 'MDR', name: 'Règlement (UE) 2017/745 (MDR)', description: 'Règlement relatif aux dispositifs médicaux', version: '2017/745' },
  { code: 'ISO_13485', name: 'ISO 13485:2016', description: 'Dispositifs médicaux - Systèmes de management de la qualité', version: '2016' },
  { code: 'ISO_9001', name: 'ISO 9001:2015', description: 'Systèmes de management de la qualité', version: '2015' },
  { code: 'FDA_820', name: 'FDA 21 CFR Part 820 (QSR)', description: 'Quality System Regulation', version: 'Part 820' },
  { code: 'FDA_807', name: 'FDA 21 CFR Part 807', description: 'Establishment Registration and Device Listing', version: 'Part 807' },
  { code: 'FDA_510K', name: '510(k)', description: 'Premarket Notification', version: '510(k)' },
  { code: 'FDA_LABELING', name: 'FDA Labeling', description: 'Device Labeling Requirements', version: 'Part 801' }
];

export const FALLBACK_PROCESSES = [
  { id: 1, name: "Gouvernance & Management", description: "Responsabilité de la direction et stratégie", displayOrder: 1, icon: "LayoutDashboard" },
  { id: 2, name: "Système de Management de la Qualité", description: "Documentation et maîtrise du SMQ", displayOrder: 2, icon: "FileText" },
  { id: 3, name: "Conception & Développement", description: "Maîtrise de la conception des dispositifs", displayOrder: 3, icon: "Lightbulb" },
  { id: 4, name: "Gestion des Risques", description: "Analyse et maîtrise des risques", displayOrder: 4, icon: "AlertTriangle" },
  { id: 5, name: "Achats & Fournisseurs", description: "Maîtrise des fournisseurs et sous-traitants", displayOrder: 5, icon: "ShoppingCart" },
  { id: 6, name: "Production & Prestation de service", description: "Maîtrise de la fabrication", displayOrder: 6, icon: "Factory" },
  { id: 7, name: "Surveillance Après-Vente", description: "PMS et vigilance", displayOrder: 7, icon: "Activity" }
];

export const FALLBACK_MDR_QUESTIONS = [
  { id: 1, externalId: "MDR-1", article: "Art. 10", questionText: "Le fabricant a-t-il établi un système de gestion des risques ?", criticality: "critical", economicRole: "fabricant", processCategory: "QMS", displayOrder: 1, isActive: true },
  { id: 2, externalId: "MDR-2", article: "Art. 15", questionText: "La personne chargée du respect de la réglementation est-elle désignée ?", criticality: "high", economicRole: "fabricant", processCategory: "RA", displayOrder: 2, isActive: true },
  { id: 3, externalId: "MDR-3", article: "Annexe IX", questionText: "La documentation technique est-elle tenue à jour ?", criticality: "critical", economicRole: "fabricant", processCategory: "Technical", displayOrder: 3, isActive: true },
  { id: 4, externalId: "MDR-4", article: "Art. 13", questionText: "L'importateur a-t-il vérifié le marquage CE du dispositif ?", criticality: "high", economicRole: "importateur", processCategory: "Logistics", displayOrder: 4, isActive: true },
  { id: 5, externalId: "MDR-5", article: "Art. 14", questionText: "Le distributeur a-t-il vérifié les conditions de stockage ?", criticality: "medium", economicRole: "distributeur", processCategory: "Logistics", displayOrder: 5, isActive: true }
];

export const FALLBACK_ISO_QUESTIONS = [
  { id: 101, externalId: "ISO-1", standard: "13485", clauseTitle: "SMQ", questionText: "L'organisme a-t-il établi un SMQ ?", criticality: "high", applicability: "all", processCategory: "QMS", displayOrder: 1 },
  { id: 102, externalId: "ISO-2", standard: "13485", clauseTitle: "Production", questionText: "Les processus de production sont-ils validés ?", criticality: "critical", applicability: "manufacturers_only", processCategory: "Production", displayOrder: 2 },
  { id: 103, externalId: "ISO-3", standard: "9001", clauseTitle: "Leadership", questionText: "La direction démontre-t-elle son engagement ?", criticality: "medium", applicability: "all", processCategory: "Management", displayOrder: 3 }
];

export const FALLBACK_FDA_QUESTIONS = [
  { id: 201, externalId: "FDA-1", frameworkCode: "FDA_820", questionShort: "QSR Compliance", questionDetailed: "Does the manufacturer establish and maintain a quality system?", criticality: "critical", applicabilityType: "ALL", process: "Management" },
  { id: 202, externalId: "FDA-2", frameworkCode: "FDA_807", questionShort: "Registration", questionDetailed: "Is the establishment registered with the FDA?", criticality: "high", applicabilityType: "ALL", process: "Registration" },
  { id: 203, externalId: "FDA-3", frameworkCode: "FDA_820", questionShort: "Design Controls", questionDetailed: "Are design control procedures established?", criticality: "critical", applicabilityType: "SPECIFIC", process: "Design" }
];
