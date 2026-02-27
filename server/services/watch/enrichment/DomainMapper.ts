import type { ImpactedDomain, UpdateTag } from "../types";
import { safeText } from "../utils";

type Rule = {
  domain: ImpactedDomain;
  patterns: RegExp[];
  tags?: string[];
};

const RULES: Rule[] = [
  {
    domain: "PMS",
    patterns: [/\bPMS\b/i, /post[- ]market/i, /surveillance\s+apres\s+commercialisation/i],
    tags: ["pms"],
  },
  {
    domain: "PMCF",
    patterns: [/\bPMCF\b/i, /post[- ]market\s+clinical\s+follow[- ]up/i],
    tags: ["pmcf"],
  },
  {
    domain: "ClinicalEvaluation",
    patterns: [/clinical\s+evaluation/i, /\bCER\b/i, /\bCEP\b/i],
    tags: ["clinical"],
  },
  {
    domain: "Vigilance",
    patterns: [/\bvigilance\b/i, /incident/i, /serious\s+incident/i, /FSCA/i, /recall/i],
    tags: ["vigilance"],
  },
  {
    domain: "UDI",
    patterns: [/\bUDI\b/i, /unique\s+device\s+ident/i, /EUDAMED/i],
    tags: ["udi"],
  },
  {
    domain: "Labeling",
    patterns: [/label/i, /labelling/i, /IFU/i, /instructions\s+for\s+use/i, /UFI/i],
    tags: ["labeling"],
  },
  {
    domain: "RiskManagement",
    patterns: [/risk\s+management/i, /\bISO\s*14971\b/i, /hazard/i, /FMEA/i],
    tags: ["risk"],
  },
  {
    domain: "QMS",
    patterns: [/\bQMS\b/i, /quality\s+management/i, /\bISO\s*13485\b/i, /\bISO\s*9001\b/i],
    tags: ["qms"],
  },
  {
    domain: "Supplier",
    patterns: [/supplier/i, /subcontract/i, /outsourc/i],
    tags: ["supplier"],
  },
  {
    domain: "Software",
    patterns: [/software/i, /SaMD/i, /\bIEC\s*62304\b/i, /cyber/i, /\bAI\b/i],
    tags: ["software"],
  },
  {
    domain: "Usability",
    patterns: [/usability/i, /\bIEC\s*62366\b/i, /human\s+factors/i],
    tags: ["usability"],
  },
  {
    domain: "Biocompatibility",
    patterns: [/\bISO\s*10993\b/i, /biocompat/i, /toxic/i],
    tags: ["biocompatibility"],
  },
  {
    domain: "Sterilization",
    patterns: [/steril/i, /aseptic/i, /\bEO\b/i],
    tags: ["sterile"],
  },
  {
    domain: "PerformanceSafety",
    patterns: [/performance/i, /safety/i, /GSPR/i],
    tags: ["gspr"],
  },
];

export function mapDomains(input: { title: string; tags?: UpdateTag[] }): ImpactedDomain[] {
  const text = safeText(`${input.title} ${(input.tags ?? []).map((t) => `${t.key}:${t.value ?? ""}`).join(" ")}`);
  const found = new Set<ImpactedDomain>();

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) found.add(rule.domain);
    if (rule.tags && input.tags) {
      const tagKeys = new Set(input.tags.map((t) => t.key.toLowerCase()));
      if (rule.tags.some((t) => tagKeys.has(t))) found.add(rule.domain);
    }
  }

  if (found.size === 0) found.add("Other");
  return Array.from(found);
}
