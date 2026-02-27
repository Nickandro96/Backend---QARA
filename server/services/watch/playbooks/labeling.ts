import type { ActionItem } from "../types";

export function labelingPlaybook(_title: string): ActionItem[] {
  return [
    {
      id: "lab-001",
      title: "Mettre à jour les masters d’étiquetage / IFU + workflow d’approbation",
      owner: "QA",
      dueDays: 30,
      deliverables: ["Labels/IFU masters", "Artwork control SOP", "Regulatory review checklist"],
      expectedEvidence: ["Controlled label masters", "Artwork approval records", "Translation verification records"],
    },
    {
      id: "lab-002",
      title: "Revoir l’impact multi-marchés (UE/CH/UK) sur les mentions obligatoires",
      owner: "RA",
      dueDays: 30,
      deliverables: ["Matrice des exigences d’étiquetage par marché", "Plan de mise en conformité"],
      expectedEvidence: ["Requirements matrix", "Change control", "Released artwork samples"],
    },
  ];
}
