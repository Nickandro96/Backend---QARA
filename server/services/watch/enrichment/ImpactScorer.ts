import type { ImpactLevel, ImpactedDomain, RegulatoryUpdateStatus, RegulatoryUpdateType } from "../types";

export type ImpactScoringInput = {
  type: RegulatoryUpdateType;
  status: RegulatoryUpdateStatus;
  title: string;
  impactedDomains: ImpactedDomain[];
  tags: { key: string; value?: string }[];
};

/**
 * Deterministic scoring (no LLM, no "hallucination").
 *
 * Rules (priority order):
 * 1) EU act amending MDR articles -> Critical
 * 2) Anything touching PMS/PMCF/Clinical/Vigilance/UDI -> at least High
 * 3) Harmonised standard replacement -> Medium/High
 * 4) Minor corrigendum -> Low
 */
export function scoreImpact(input: ImpactScoringInput): { level: ImpactLevel; reasons: string[] } {
  const reasons: string[] = [];
  const t = input.title.toLowerCase();

  const has = (d: ImpactedDomain) => input.impactedDomains.includes(d);

  // 1) Explicit amending language
  const amendsMdr =
    input.type === "REGULATION" &&
    (/(amend(ing|ment)|modif(i|y)|changes?\s+to)/i.test(input.title) || /\b(2017\/745|MDR)\b/i.test(input.title));

  if (amendsMdr && /(article\s*\d+|annex\s+[ivx]+)/i.test(input.title)) {
    reasons.push("Acte UE modifiant explicitement des articles/annexes MDR");
    return { level: "Critical", reasons };
  }

  // 2) High domains
  const highDomains: ImpactedDomain[] = ["PMS", "PMCF", "ClinicalEvaluation", "Vigilance", "UDI"];
  if (highDomains.some((d) => has(d))) {
    reasons.push("Impact sur PMS/PMCF/Clinical/Vigilance/UDI");
    // Corrigendum can still be lower if clearly minor
    if (input.status === "CORRIGENDUM" && /(typo|editorial|corrigendum)/i.test(t)) {
      reasons.push("Corrigendum qualifié comme éditorial / mineur");
      return { level: "Medium", reasons };
    }
    return { level: "High", reasons };
  }

  // 3) Standards: replacement / new version
  if (input.type === "STANDARD") {
    const replaces = input.tags.some((x) => x.key === "replaces" || x.key === "replacedBy");
    if (replaces) {
      reasons.push("Norme harmonisée : remplacement / nouvelle édition");
      return { level: "High", reasons };
    }
    reasons.push("Norme harmonisée : mise à jour / publication");
    return { level: "Medium", reasons };
  }

  // 4) Minor corrigendum
  if (input.status === "CORRIGENDUM") {
    reasons.push("Corrigendum");
    return { level: "Low", reasons };
  }

  // 5) Guidance: default medium
  if (input.type === "GUIDANCE") {
    if (/(psur|pms|pmcf|vigilance|incident)/i.test(t)) {
      reasons.push("Guidance orientée PMS/PSUR/PMCF/Vigilance");
      return { level: "High", reasons };
    }
    reasons.push("Guidance : impact généralement procédural");
    return { level: "Medium", reasons };
  }

  // 6) Quality news: ISO revisions may be medium
  if (input.type === "QUALITY") {
    if (/revision|draft|committee/i.test(t)) {
      reasons.push("Évolution ISO/IAF (révision / draft)");
      return { level: "Medium", reasons };
    }
    reasons.push("Information qualité");
    return { level: "Low", reasons };
  }

  return { level: "Low", reasons: reasons.length ? reasons : ["Règles : défaut"] };
}
