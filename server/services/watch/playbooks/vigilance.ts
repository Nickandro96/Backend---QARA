import type { ActionItem } from "../types";

export function vigilancePlaybook(_title: string): ActionItem[] {
  return [
    {
      id: "vig-001",
      title: "Revoir la procédure de vigilance MDR Art. 87 : 2 jours (menace grave), 10 jours (décès/détérioration grave inattendue), 15 jours (autre incident grave) ; tendances selon l’Art. 88",
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
