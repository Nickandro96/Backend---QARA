/**
 * Assembleur de rapport d'audit — Lot 4 (voir SPEC-3-rapport-audit.md fournie).
 *
 * Calcul pur : assemble la structure complète du rapport (§2 SPEC-3) à partir
 * du résultat du moteur de scoring (Lot 2) et du plan d'action CAPA (Lot 3).
 * Ne lit ni n'écrit rien en base ; ne génère aucun binaire (PDF/Excel) — voir
 * docs/audit/10-rapport-audit.md pour la déviation de périmètre : ce module
 * produit la donnée structurée complète, en un appel, prête à être rendue
 * (par le frontend, en PDF/HTML/impression) ou exportée en CSV
 * (./csvExport.ts). Les visuels (jauges, radar, camembert) sont dérivés de
 * cette même donnée côté rendu, conformément à la règle §3 SPEC-3 (« pas de
 * saisie manuelle » — tout dérive de l'objet résultat du moteur).
 */

import type { ScoringConfig, ScoringResult } from "../scoring/types";
import type { CapaAction } from "../capa/types";
import { sortByPriority } from "../capa/capaEngine";
import type { AuditReport, ExecutiveSummary, RadarPoint, ReportMeta, Verdict } from "./types";

const MENTION_LEGALE =
  "Outil d'auto-évaluation préparatoire ; ne remplace pas l'audit de certification par un organisme notifié ou une autorité compétente.";

const VERDICT_PHRASES: Record<Verdict, string> = {
  pret: "Le périmètre audité est prêt pour un audit externe : aucun écart bloquant, score de conformité au-dessus du seuil cible.",
  pret_avec_reserves:
    "Le périmètre audité est prêt sous réserve de traiter les écarts en cours avant un audit externe : le score est acceptable mais des écarts majeurs subsistent.",
  pas_pret:
    "Le périmètre audité n'est pas prêt pour un audit externe : au moins un écart critique bloquant ou un score en dessous du seuil minimal doit être corrigé.",
};

function verdictFor(scoringResult: ScoringResult): { verdict: Verdict; verdictPhrase: string } {
  const { statut } = scoringResult.global;
  const verdict: Verdict =
    statut === "conforme" ? "pret" : statut === "conforme_avec_reserves" ? "pret_avec_reserves" : "pas_pret";
  return { verdict, verdictPhrase: VERDICT_PHRASES[verdict] };
}

/** Les 3-5 priorités absolues du plan d'action (§2.2 SPEC-3) : actions non closes, triées par priorité. */
export function topPriorities(capaActions: CapaAction[], limit = 5): CapaAction[] {
  const open = capaActions.filter(
    (a) => a.statut !== "cloturee_efficace" && a.statut !== "cloturee_sans_suite"
  );
  return sortByPriority(open).slice(0, limit);
}

function buildRadarPoints(scoringResult: ScoringResult): RadarPoint[] {
  return scoringResult.parProcessus.map((p) => ({
    processName: p.processName,
    referentialCode: p.referentialCode,
    score: p.score,
  }));
}

function buildExecutiveSummary(scoringResult: ScoringResult, capaActions: CapaAction[]): ExecutiveSummary {
  const { verdict, verdictPhrase } = verdictFor(scoringResult);
  return {
    scoreGlobal: scoringResult.global.score,
    statutGlobal: scoringResult.global.statut,
    verdict,
    verdictPhrase,
    scoresParReferentiel: scoringResult.parReferentiel.map((r) => ({
      referentialCode: r.referentialCode,
      score: r.score,
      statut: r.statut,
    })),
    ecarts: scoringResult.global.ecarts,
    ecartsCritiques: scoringResult.global.ecartsCritiques,
    topPriorites: topPriorities(capaActions),
  };
}

export interface BuildAuditReportInput {
  meta: Omit<ReportMeta, "generatedAt">;
  scoringResult: ScoringResult;
  capaActions: CapaAction[];
  config: ScoringConfig;
}

export function buildAuditReport(input: BuildAuditReportInput): AuditReport {
  const { meta, scoringResult, capaActions, config } = input;

  return {
    meta: { ...meta, generatedAt: new Date().toISOString() },
    syntheseExecutive: buildExecutiveSummary(scoringResult, capaActions),
    radarParProcessus: buildRadarPoints(scoringResult),
    resultatsParReferentiel: scoringResult.parReferentiel,
    registreEcarts: scoringResult.ecarts,
    planAction: sortByPriority(capaActions),
    couvertureCroisee: scoringResult.couvertureCroisee,
    annexes: {
      seuilConforme: config.seuilConforme,
      seuilConformeAvecReserves: config.seuilConformeAvecReserves,
      seuilMaturite: config.seuilMaturite,
      poids: config.poids,
      questionsNonApplicables: scoringResult.global.questionsNonApplicables,
      questionsNonRepondues: scoringResult.global.questionsNonRepondues,
    },
    mentionLegale: MENTION_LEGALE,
  };
}
