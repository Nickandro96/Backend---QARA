import type { Ecart, CouvertureCroisee, ReferentialResult, GroupResult, Statut } from "../scoring/types";
import type { CapaAction } from "../capa/types";

/**
 * Écart enrichi des champs riches du corpus (auditVerifies, explanationSimple,
 * concreteExample, conformityCriteria, referenceStatus, officialSource) —
 * voir docs/audit/11-integrite-bout-en-bout.md, écart E1 : ces champs sont
 * remplis à 100 % en base mais n'étaient pas exposés dans le registre des
 * écarts du rapport (Lot 4 initial). `typicalNc` (déjà sur `Ecart`) reste la
 * source de la gravité en texte libre — voir la même note pour la déviation
 * documentée sur `grade_mdsap`.
 */
export interface EcartEnrichi extends Ecart {
  auditVerifies: string | null;
  explanationSimple: string | null;
  concreteExample: string | null;
  conformityCriteria: Record<string, string> | null;
  referenceStatus: string | null;
  officialSource: string | null;
}

/** Champs riches d'une question, indexés par questionKey pour l'enrichissement du rapport. */
export interface QuestionRichFields {
  auditVerifies: string | null;
  explanationSimple: string | null;
  concreteExample: string | null;
  conformityCriteria: Record<string, string> | null;
  referenceStatus: string | null;
  officialSource: string | null;
}

export type Verdict = "pret" | "pret_avec_reserves" | "pas_pret";

export interface ReportMeta {
  auditId: number;
  organisationName: string | null;
  siteName: string | null;
  economicRole: string | null;
  referentialCodes: string[];
  auditorName: string | null;
  auditorEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  generatedAt: string;
  niveau: "synthetique" | "detaille";
}

export interface ExecutiveSummary {
  scoreGlobal: number;
  statutGlobal: Statut;
  verdict: Verdict;
  verdictPhrase: string;
  scoresParReferentiel: Array<{ referentialCode: string; score: number; statut: Statut }>;
  ecarts: GroupResult["ecarts"];
  ecartsCritiques: number;
  topPriorites: CapaAction[];
}

export interface RadarPoint {
  processName: string;
  referentialCode: string;
  score: number;
}

export interface AnnexeMethodologie {
  seuilConforme: number;
  seuilConformeAvecReserves: number;
  seuilMaturite: number;
  poids: Record<string, number>;
  questionsNonApplicables: number;
  questionsNonRepondues: number;
}

export interface AuditReport {
  meta: ReportMeta;
  syntheseExecutive: ExecutiveSummary;
  radarParProcessus: RadarPoint[];
  resultatsParReferentiel: ReferentialResult[];
  registreEcarts: EcartEnrichi[];
  planAction: CapaAction[];
  couvertureCroisee: CouvertureCroisee[];
  annexes: AnnexeMethodologie;
  mentionLegale: string;
}
