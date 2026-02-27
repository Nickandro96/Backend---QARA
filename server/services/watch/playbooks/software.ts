import type { ActionItem } from "../types";

export function softwarePlaybook(_title: string): ActionItem[] {
  return [
    {
      id: "sw-001",
      title: "Revoir le SDLC / IEC 62304 (plans, classification, traceabilité, releases)",
      owner: "Engineering",
      dueDays: 30,
      deliverables: ["Software Development Plan", "Traceability matrix", "Release/change control"],
      expectedEvidence: ["IEC 62304 plan", "SRS", "Traceability matrix", "Release notes"],
    },
    {
      id: "sw-002",
      title: "Mettre à jour l’évaluation cybersécurité (menaces, vulnérabilités, mesures)",
      owner: "Engineering",
      dueDays: 60,
      deliverables: ["Cybersecurity risk assessment", "SBOM (si applicable)", "Pen-test/scan evidence"],
      expectedEvidence: ["Cybersecurity assessment", "SBOM", "Vulnerability management records"],
    },
    {
      id: "sw-003",
      title: "Vérifier l’Usability engineering file (IEC 62366) si l’update touche l’IFU / UI",
      owner: "QA",
      dueDays: 90,
      deliverables: ["UEF update", "Summative evaluation plan/report (si requis)"],
      expectedEvidence: ["UEF", "Summative test report"],
    },
  ];
}
