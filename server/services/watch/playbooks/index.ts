import type { ActionItem, ImpactedDomain } from "../types";
import { pmsPlaybook } from "./pms";
import { vigilancePlaybook } from "./vigilance";
import { udiPlaybook } from "./udi";
import { labelingPlaybook } from "./labeling";
import { riskPlaybook } from "./risk";
import { softwarePlaybook } from "./software";

export function buildActions(domains: ImpactedDomain[], title: string): ActionItem[] {
  const actions: ActionItem[] = [];

  const add = (items: ActionItem[]) => {
    for (const it of items) actions.push(it);
  };

  for (const d of domains) {
    switch (d) {
      case "PMS":
      case "PMCF":
      case "ClinicalEvaluation":
        add(pmsPlaybook(title));
        break;
      case "Vigilance":
        add(vigilancePlaybook(title));
        break;
      case "UDI":
        add(udiPlaybook(title));
        break;
      case "Labeling":
        add(labelingPlaybook(title));
        break;
      case "RiskManagement":
        add(riskPlaybook(title));
        break;
      case "Software":
      case "Usability":
        add(softwarePlaybook(title));
        break;
      default:
        break;
    }
  }

  // De-duplicate by id
  const byId = new Map<string, ActionItem>();
  for (const a of actions) byId.set(a.id, a);
  return Array.from(byId.values());
}

export function evidenceTemplates(domains: ImpactedDomain[]): string[] {
  const evidence = new Set<string>();

  const add = (...items: string[]) => items.forEach((x) => evidence.add(x));

  // Always useful
  add(
    "Change Control record (impact assessment + approvals)",
    "Updated SOP/PROC (controlled copy + revision history)",
    "Training record (targeted personnel)",
    "Management review / QMS communication evidence"
  );

  for (const d of domains) {
    switch (d) {
      case "PMS":
      case "PMCF":
        add("Updated PMS Plan", "PSUR/PMCF evaluation record", "PMS reports / trend analysis evidence");
        break;
      case "ClinicalEvaluation":
        add("Updated Clinical Evaluation Plan (CEP)", "Updated Clinical Evaluation Report (CER)");
        break;
      case "Vigilance":
        add("Vigilance SOP update", "Incident reporting records", "FSCA communication templates");
        break;
      case "UDI":
        add("UDI SOP / procedure", "UDI assignment records", "Label artwork control evidence", "EUDAMED registration evidence (if applicable)");
        break;
      case "Labeling":
        add("Updated labels/IFU masters", "Artwork approval workflow record", "Translation review evidence");
        break;
      case "RiskManagement":
        add("ISO 14971 Risk Management Plan", "Hazard analysis / FMEA", "Risk-benefit analysis", "Traceability matrix (risks ↔ controls ↔ verification)");
        break;
      case "Software":
        add(
          "IEC 62304 software development plan",
          "Software requirements/specs (SRS)",
          "Verification & validation protocol + report",
          "Cybersecurity risk assessment",
          "Software change log + release notes"
        );
        break;
      case "Usability":
        add("IEC 62366 usability engineering file", "Summative evaluation protocol + report");
        break;
      case "Biocompatibility":
        add("ISO 10993 evaluation plan", "Biological evaluation report");
        break;
      case "Sterilization":
        add("Sterilization validation protocol + report", "Packaging validation", "Bioburden / EO residuals records");
        break;
      default:
        break;
    }
  }

  return Array.from(evidence);
}
