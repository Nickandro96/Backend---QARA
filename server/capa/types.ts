import type { Criticality, Gravite } from "../scoring/types";

/**
 * Cycle de vie d'une action CAPA (voir docs/audit/09-plan-action-capa.md et
 * SPEC-2). Une action ne peut jamais passer directement de `en_cours` à une
 * clôture : elle doit obligatoirement transiter par `a_verifier`
 * (vérification d'efficacité — ISO 13485 §8.5.2 / MDSAP).
 */
export type CapaStatus =
  | "ouverte"
  | "en_cours"
  | "a_verifier"
  | "cloturee_efficace"
  | "cloturee_inefficace"
  | "cloturee_sans_suite";

export type ResultatEfficacite = "efficace" | "inefficace";

export interface CapaReferentielImpacte {
  referentiel: string;
  reference?: string | null;
  libelle_exigence?: string | null;
}

/** Action CAPA telle qu'exposée par l'API (voir server/capa/capaRouter.ts). */
export interface CapaAction {
  id: number;
  auditId: number;
  questionKey: string;
  referentialCode: string;
  processName: string | null;
  gravite: Gravite;
  criticality: Criticality;
  ecartIdentifie: string;
  analyseCauseRacine: string | null;
  actionRecommandee: string;
  actionRetenue: string | null;
  responsible: string | null;
  dueDate: string | null;
  statut: CapaStatus;
  preuveRealisation: string | null;
  dateVerificationEfficacite: string | null;
  preuveEfficacite: string | null;
  resultatEfficacite: ResultatEfficacite | null;
  rootCauseMethod: string | null;
  mdsapGrade: number | null;
  mdsapEscalation: string | null;
  referentielsImpactes: CapaReferentielImpacte[];
  priorite: number;
  createdAt: string;
  updatedAt: string;
}

export interface CapaActionDraft {
  questionKey: string;
  referentialCode: string;
  processName: string | null;
  gravite: Gravite;
  criticality: Criticality;
  ecartIdentifie: string;
  actionRecommandee: string;
  referentielsImpactes: CapaReferentielImpacte[];
}

export interface CapaHistoryEntry {
  id: number;
  actionId: number;
  userId: number;
  changedAt: string;
  champ: string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
}
