import type { ActionItem } from "../types";

export function pmsPlaybook(_title: string): ActionItem[] {
  return [
    {
      id: "pms-001",
      title: "Revoir et mettre à jour le PMS Plan (alignement MDR + guidance)",
      owner: "PMS",
      dueDays: 30,
      deliverables: ["PMS Plan révisé (version contrôlée)", "Impact assessment (change control)", "Communication interne"],
      expectedEvidence: [
        "PMS Plan (controlled document)",
        "Change control record (impact + approvals)",
        "Training/communication record",
      ],
    },
    {
      id: "pms-002",
      title: "Mettre à jour la stratégie PSUR (si applicable) + calendrier de production",
      owner: "PMS",
      dueDays: 60,
      deliverables: ["Procédure PSUR", "Modèle PSUR", "Planning (classe + périodicité)"],
      expectedEvidence: ["PSUR SOP/PROC", "PSUR template", "PSUR publication records"],
    },
    {
      id: "pms-003",
      title: "Recalibrer le trend analysis & signaux (critères, seuils, responsabilités)",
      owner: "QA",
      dueDays: 30,
      deliverables: ["Procédure trending", "Tableau de bord signaux", "Justification des seuils"],
      expectedEvidence: ["Trending SOP", "Trend reports", "Management review inputs"],
    },
  ];
}
