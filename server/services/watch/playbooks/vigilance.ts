import type { ActionItem } from "../types";

export function vigilancePlaybook(_title: string): ActionItem[] {
  return [
    {
      id: "vig-001",
      title: "Revoir la procédure de vigilance (délais, critères SI/NSI, reporting, FSCA)",
      owner: "Vigilance",
      dueDays: 30,
      deliverables: ["SOP vigilance mise à jour", "Workflow de déclaration", "Matrice de décision"],
      expectedEvidence: ["Vigilance SOP", "Decision tree", "Incident reporting logs"],
    },
    {
      id: "vig-002",
      title: "Vérifier l’alignement des templates (MIR, FSN, communication autorités)",
      owner: "RA",
      dueDays: 14,
      deliverables: ["Templates révisés", "Checklist de complétude"],
      expectedEvidence: ["Controlled templates", "Sample completed reports"],
    },
  ];
}
