import type { Criticality, Gravite } from "../scoring/types";

export interface ConformityCriteria {
  conforme?: string;
  non_conforme?: string;
}

/** Champs riches d'une question, tels qu'exposés au mode utilisateur ("aide-moi à répondre"). */
export interface QuestionAssistantContext {
  questionKey: string;
  referentialCode: string;
  processName: string | null;
  questionText: string;
  criticality: Criticality;
  article: string | null;
  annexe: string | null;
  officialSource: string | null;
  referenceStatus: string | null;
  auditVerifies: string | null;
  expectedEvidence: string | null;
  explanationSimple: string | null;
  concreteExample: string | null;
  conformityCriteria: ConformityCriteria | null;
  typicalNc: string[];
}

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Écart enrichi tel qu'exposé au mode auditeur ("analyse mes résultats"). */
export interface AuditorGapContext {
  questionKey: string;
  referentialCode: string;
  processName: string | null;
  gravite: Gravite;
  criticality: Criticality;
  responseValue: string;
  typicalNc: string[];
  article: string | null;
  officialSource: string | null;
  auditVerifies: string | null;
  expectedEvidence: string | null;
  aiPrompt: string | null;
  referentielsImpactes: Array<{ referentiel: string; reference?: string | null; libelle_exigence?: string | null }>;
}

/** Résumé chiffré du scoring, tel qu'exposé au mode auditeur. */
export interface AuditorScoringSummary {
  scoreGlobal: number;
  statutGlobal: string;
  scoresParReferentiel: Array<{ referentialCode: string; score: number; statut: string }>;
  ecartsCritiques: number;
  ecarts: { majeurs: number; mineurs: number; observations: number };
}
