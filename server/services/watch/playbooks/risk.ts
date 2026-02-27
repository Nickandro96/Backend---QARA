import type { ActionItem } from "../types";

export function riskPlaybook(_title: string): ActionItem[] {
  return [
    {
      id: "risk-001",
      title: "Mettre à jour le Risk Management Plan (ISO 14971) et les critères d’acceptabilité",
      owner: "QA",
      dueDays: 30,
      deliverables: ["RM Plan révisé", "Critères d’acceptabilité", "Change control"],
      expectedEvidence: ["RM Plan", "Approvals", "Training record"],
    },
    {
      id: "risk-002",
      title: "Mettre à jour l’analyse des dangers (HA/FMEA) + traceabilité risques↔mesures",
      owner: "Engineering",
      dueDays: 60,
      deliverables: ["Hazard analysis update", "Traceability matrix", "Verification evidence"],
      expectedEvidence: ["HA/FMEA", "Traceability matrix", "V&V reports"],
    },
  ];
}
