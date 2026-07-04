/**
 * Types du moteur de scoring QARA (Lot 2, voir docs SPEC-1-moteur-scoring.md
 * fournie et docs/audit/08-moteur-scoring.md pour les écarts entre la spec et
 * les données réelles du corpus).
 */

export type Criticality = "critical" | "high" | "medium" | "low";
export type QuestionType = "yes_no_partial_na" | "maturity_0_5";
export type ResponseValue = "compliant" | "partial" | "non_compliant" | "not_applicable" | "in_progress";

export type Statut = "conforme" | "conforme_avec_reserves" | "non_conforme";
export type Gravite = "majeur" | "mineur" | "observation";

export interface ScoringMapping {
  referentiel: string;
  reference?: string | null;
  libelle_exigence?: string | null;
  correspondance?: string | null;
}

/** Sous-ensemble de `questions` nécessaire au moteur — pas de dépendance DB ici. */
export interface ScoringQuestion {
  questionKey: string;
  referentialCode: string;
  processName: string | null;
  criticality: Criticality;
  questionType: QuestionType;
  typicalNc?: string[] | null;
  mappings?: ScoringMapping[] | null;
}

/** Réponse utilisateur : `maturityLevel` uniquement pour questionType=maturity_0_5. */
export interface ScoringResponse {
  questionKey: string;
  responseValue: ResponseValue;
  maturityLevel?: number | null; // 0-5, requis si responseValue n'est pas not_applicable/in_progress
  notApplicableReason?: string | null;
}

export interface Ecart {
  questionKey: string;
  referentialCode: string;
  processName: string | null;
  gravite: Gravite;
  criticality: Criticality;
  responseValue: ResponseValue;
  elementaryScore: number;
  typicalNc: string[];
}

export interface GroupResult {
  score: number; // 0-100
  statut: Statut;
  ecartsCritiques: number;
  ecarts: { majeurs: number; mineurs: number; observations: number };
  maturiteMoyenne: number | null; // 0-5, uniquement sur les questions maturity_0_5, null si aucune
  questionsApplicables: number;
  questionsNonApplicables: number;
  questionsNonRepondues: number;
}

export interface ReferentialResult extends GroupResult {
  referentialCode: string;
}

export interface ProcessResult extends GroupResult {
  referentialCode: string;
  processName: string;
}

export interface CouvertureCroisee {
  questionKey: string;
  referentielSource: string;
  exigenceSource: string | null;
  referentielsCouverts: ScoringMapping[];
}

export interface ScoringResult {
  global: GroupResult;
  parReferentiel: ReferentialResult[];
  parProcessus: ProcessResult[];
  ecarts: Ecart[];
  couvertureCroisee: CouvertureCroisee[];
}

export interface ScoringConfig {
  /** Seuils de statut (% de conformité). */
  seuilConforme: number; // défaut 90
  seuilConformeAvecReserves: number; // défaut 75
  /** Seuil de maturité (0-5) sous lequel un écart est généré. */
  seuilMaturite: number; // défaut 3
  /** Poids par niveau de criticité. */
  poids: Record<Criticality, number>;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  seuilConforme: 90,
  seuilConformeAvecReserves: 75,
  seuilMaturite: 3,
  poids: { critical: 4, high: 3, medium: 2, low: 1 },
};
