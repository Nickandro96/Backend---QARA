import type { ActionItem } from "../types";

export function udiPlaybook(_title: string): ActionItem[] {
  return [
    {
      id: "udi-001",
      title: "Mettre à jour la procédure UDI/EUDAMED (rôles, responsabilités, contrôles)",
      owner: "RA",
      dueDays: 30,
      deliverables: ["SOP UDI/EUDAMED révisée", "Matrice UDI par famille/variantes", "Plan de déploiement"],
      expectedEvidence: ["UDI SOP", "UDI assignment records", "Label/IFU artwork approvals"],
    },
    {
      id: "udi-002",
      title: "Vérifier la cohérence UDI ↔ étiquetage ↔ dossiers techniques",
      owner: "QA",
      dueDays: 30,
      deliverables: ["Checklist de cohérence", "Rapport d’audit interne UDI"],
      expectedEvidence: ["Audit checklist", "Audit report", "NC/CAPA (si écarts)"],
    },
  ];
}
