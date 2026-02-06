export interface MdrProcess {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
}

export const MDR_PROCESSES: MdrProcess[] = [
  { id: "gov_strat", name: "Gouvernance & stratégie réglementaire", displayOrder: 1 },
  { id: "ra", name: "Affaires réglementaires (RA)", displayOrder: 2 },
  { id: "qms", name: "Système de management qualité (QMS)", displayOrder: 3 },
  { id: "risk_mgmt", name: "Gestion des risques (ISO 14971)", displayOrder: 4 },
  { id: "design_dev", name: "Conception & développement", displayOrder: 5 },
  { id: "purchasing_suppliers", name: "Achats & fournisseurs", displayOrder: 6 },
  { id: "production_sub", name: "Production & sous-traitance", displayOrder: 7 },
  { id: "traceability_udi", name: "Traçabilité / UDI", displayOrder: 8 },
  { id: "pms_pmcf", name: "PMS / PMCF", displayOrder: 9 },
  { id: "vigilance_incidents", name: "Vigilance & incidents", displayOrder: 10 },
  { id: "distribution_logistics", name: "Distribution & logistique", displayOrder: 11 },
  { id: "importation", name: "Importation", displayOrder: 12 },
  { id: "tech_doc", name: "Documentation technique", displayOrder: 13 },
  { id: "audit_compliance", name: "Audits & conformité", displayOrder: 14 },
  { id: "it_cyber", name: "IT / Cybersécurité", displayOrder: 15 },
];
