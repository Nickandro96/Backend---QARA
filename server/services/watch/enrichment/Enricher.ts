import type { EnrichmentResult, RegulatoryUpdate, EconomicRole, ImpactedDomain, MdrImpact } from "../types";
import { mapDomains } from "./DomainMapper";
import { scoreImpact } from "./ImpactScorer";
import { buildActions, evidenceTemplates } from "../playbooks";
import { safeText } from "../utils";

function inferRoles(domains: ImpactedDomain[]): EconomicRole[] {
  // Default: manufacturer always impacted in MDR context.
  const roles = new Set<EconomicRole>(["fabricant"]);
  if (domains.includes("Supplier")) roles.add("sous_traitant");
  if (domains.includes("UDI") || domains.includes("Labeling") || domains.includes("Vigilance")) {
    roles.add("importateur");
    roles.add("distributeur");
    roles.add("ar");
  }
  return Array.from(roles);
}

function inferMdrMapping(title: string): MdrImpact {
  // Deterministic: only detect explicit mentions.
  const articles = new Set<string>();
  const annexes = new Set<string>();

  const artMatches = title.match(/Article\s*(\d+)/gi) ?? [];
  for (const m of artMatches) {
    const n = m.match(/(\d+)/)?.[1];
    if (n) articles.add(n);
  }

  const annexMatches = title.match(/Annex\s*([IVX]+)/gi) ?? [];
  for (const m of annexMatches) {
    const roman = m.match(/([IVX]+)/i)?.[1];
    if (roman) annexes.add(roman.toUpperCase());
  }

  return { articles: Array.from(articles), annexes: Array.from(annexes) };
}

function risksByDomains(domains: ImpactedDomain[]): string[] {
  const r = new Set<string>();

  // Generic audit / compliance risks
  r.add("Non-conformité en audit Organisme Notifié (NC majeure/mineure)");
  r.add("Retard de mise sur le marché / blocage de certificats (si exigences non intégrées)");

  if (domains.includes("Vigilance")) {
    r.add("Déclaration tardive d’incident / FSCA → risque de mesures coercitives");
    r.add("Risque d’escalade en surveillance marché (autorités compétentes)");
  }
  if (domains.includes("PMS") || domains.includes("PMCF") || domains.includes("ClinicalEvaluation")) {
    r.add("PMS/PMCF insuffisant → remise en cause de l’évaluation clinique / GSPR");
    r.add("Risque de suspension de certificat si PSUR/PMS non conforme");
  }
  if (domains.includes("UDI") || domains.includes("Labeling")) {
    r.add("Non-conformité étiquetage/UDI → blocage import/distribution, rappels, actions autorités");
  }
  if (domains.includes("RiskManagement")) {
    r.add("Dossier de gestion des risques non à jour → non conformité MDR + ISO 14971");
  }
  if (domains.includes("Software")) {
    r.add("Non conformité IEC 62304/cybersécurité → NC majeure + exigences de sécurité et performance");
  }

  return Array.from(r);
}

function summarizeShort(input: { title: string; type: RegulatoryUpdate["type"]; status: RegulatoryUpdate["status"] }): string {
  if (input.type === "GUIDANCE" && input.status === "UPDATED") return "Guidance MDCG révisée : vérifier l’impact procédure & preuves.";
  if (input.type === "STANDARD" && input.status === "UPDATED") return "Norme harmonisée révisée : analyser la transition (ancienne → nouvelle) et planifier la mise à jour.";
  if (input.type === "REGULATION" && input.status === "CORRIGENDUM") return "Corrigendum officiel : vérifier si changements éditoriaux vs exigences.";
  return "Mise à jour réglementaire : analyser l’impact et déclencher les actions QMS nécessaires.";
}

function summarizeLong(input: {
  title: string;
  domains: ImpactedDomain[];
  type: RegulatoryUpdate["type"]; 
  status: RegulatoryUpdate["status"];
}): string {
  const parts: string[] = [];
  parts.push(`Titre: ${safeText(input.title)}`);
  parts.push(`Type: ${input.type} | Statut: ${input.status}`);
  parts.push(`Domaines impactés (détection déterministe): ${input.domains.join(", ")}`);
  parts.push(
    "Note: Cette analyse est basée sur des règles déterministes (mots-clés + tags) et nécessite une revue RA/QA pour validation finale."
  );
  return parts.join("\n");
}

export function enrichUpdate(
  base: Omit<RegulatoryUpdate, "summaryShort" | "summaryLong" | "impactedMdr" | "impactedDomains" | "impactedRoles" | "impactLevel" | "risks" | "recommendedActions" | "expectedEvidence">
): EnrichmentResult {
  const impactedDomains = mapDomains({ title: base.title, tags: base.tags });
  const score = scoreImpact({
    type: base.type,
    status: base.status,
    title: base.title,
    impactedDomains,
    tags: base.tags,
  });

  const impactedRoles = inferRoles(impactedDomains);
  const impactedMdr = inferMdrMapping(base.title);
  const recommendedActions = buildActions(impactedDomains, base.title);
  const expectedEvidence = evidenceTemplates(impactedDomains);
  const risks = risksByDomains(impactedDomains);

  return {
    summaryShort: summarizeShort({ title: base.title, type: base.type, status: base.status }),
    summaryLong: summarizeLong({ title: base.title, type: base.type, status: base.status, domains: impactedDomains }),
    impactedMdr,
    impactedDomains,
    impactedRoles,
    impactLevel: score.level,
    risks,
    recommendedActions,
    expectedEvidence,
  };
}
