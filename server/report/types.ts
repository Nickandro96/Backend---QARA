import type { Ecart, CouvertureCroisee, ReferentialResult, GroupResult, Statut } from "../scoring/types";
import type { CapaAction } from "../capa/types";

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
  registreEcarts: Ecart[];
  planAction: CapaAction[];
  couvertureCroisee: CouvertureCroisee[];
  annexes: AnnexeMethodologie;
  mentionLegale: string;
}
