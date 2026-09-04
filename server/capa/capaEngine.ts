/**
 * Moteur CAPA — Lot 3 (voir SPEC-2-plan-action-CAPA.md fournie).
 *
 * Calcul pur : dérive des brouillons d'action à partir des écarts du moteur
 * de scoring (./scoringEngine.ts) et valide les transitions de statut. Ne
 * lit ni n'écrit rien en base (la persistance est gérée par l'appelant, voir
 * server/capa/capaRouter.ts). Écart documenté par rapport à la spec
 * d'origine dans docs/audit/09-plan-action-capa.md — notamment : le corpus
 * réel ne porte pas de champs `comment_repondre`/`preuves_a_demander` ni de
 * `grade_mdsap` structuré ; `actionPlan` existe en base mais est vide pour
 * les 473 questions du corpus vérifié. Le pré-remplissage de
 * `action_recommandee` est donc dérivé de `auditVerifies` (ce que la
 * question vérifie réellement) et `expectedEvidence` (preuves attendues),
 * les champs les plus proches disponibles.
 */

import type { Ecart, Gravite, Criticality } from "../scoring/types";
import type { CapaActionDraft, CapaReferentielImpacte, CapaStatus } from "./types";

/** Normalise uniquement les réponses constituant réellement un écart. */
export function classifyNonConformityResponse(value: unknown): "non_conforme" | "partiel" | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[ -]/g, "_");
  if (["partial", "partiel", "partially_compliant", "partiellement_conforme"].includes(normalized)) return "partiel";
  if (["non_compliant", "non_conforme", "noncompliant", "nok"].includes(normalized)) return "non_conforme";
  return null;
}

/** Construit le brouillon d'action pré-rempli pour un écart détecté. */
export function buildActionDraft(
  ecart: Ecart,
  question: { auditVerifies?: string | null; expectedEvidence?: string | null },
  referentielsImpactes: CapaReferentielImpacte[] = []
): CapaActionDraft {
  const parts = [question.auditVerifies?.trim(), question.expectedEvidence?.trim()].filter(
    (p): p is string => !!p
  );
  const actionRecommandee =
    parts.length > 0
      ? parts.join(" — Preuves attendues : ")
      : "Analyser l'écart constaté et documenter la mise en conformité (aucun libellé d'action pré-rempli disponible dans le corpus pour cette question).";

  return {
    questionKey: ecart.questionKey,
    referentialCode: ecart.referentialCode,
    processName: ecart.processName,
    gravite: ecart.gravite,
    criticality: ecart.criticality,
    ecartIdentifie: `Réponse « ${ecart.responseValue} » (score ${ecart.elementaryScore}/1)${
      ecart.typicalNc.length > 0 ? " — NC typiques : " + ecart.typicalNc.join(" ; ") : ""
    }`,
    actionRecommandee,
    referentielsImpactes,
  };
}

const GRAVITE_WEIGHT: Record<Gravite, number> = { majeur: 3, mineur: 2, observation: 1 };
const CRITICALITY_WEIGHT: Record<Criticality, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Score de priorité = f(gravité, criticité). Plus le score est élevé, plus
 * l'action doit être traitée en priorité. Ordre attendu : écarts majeurs sur
 * exigences critiques d'abord, observations sur exigences low en dernier.
 */
export function priorityScore(gravite: Gravite, criticality: Criticality): number {
  return GRAVITE_WEIGHT[gravite] * 10 + CRITICALITY_WEIGHT[criticality];
}

const ALLOWED_TRANSITIONS: Record<CapaStatus, CapaStatus[]> = {
  ouverte: ["en_cours", "cloturee_sans_suite"],
  en_cours: ["a_verifier", "cloturee_sans_suite"],
  a_verifier: ["cloturee_efficace", "cloturee_inefficace", "en_cours"],
  cloturee_efficace: [],
  cloturee_inefficace: ["en_cours"],
  cloturee_sans_suite: [],
};

/** Une action ne peut jamais sauter directement de `en_cours` à une clôture. */
export function isValidStatusTransition(current: CapaStatus, next: CapaStatus): boolean {
  if (current === next) return false;
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}

export interface StatusTransitionFields {
  gravite: Gravite;
  analyseCauseRacine?: string | null;
  preuveRealisation?: string | null;
  preuveEfficacite?: string | null;
  resultatEfficacite?: string | null;
}

export type FindingClassification = "observation" | "opportunite_amelioration" | "nc_mineure" | "nc_majeure" | "nc_critique";

/** Classification métier affichable, dérivée sans modifier la clé de la question. */
export function classifyFinding(gravite: string, criticality: string): FindingClassification {
  if (criticality.toLowerCase() === "critical") return "nc_critique";
  if (gravite === "majeur") return "nc_majeure";
  if (gravite === "mineur") return "nc_mineure";
  if (criticality.toLowerCase() === "low") return "opportunite_amelioration";
  return "observation";
}

export type CapaTaskStatus = "a_faire" | "en_cours" | "a_verifier" | "cloturee" | "annulee";

const TASK_TRANSITIONS: Record<CapaTaskStatus, CapaTaskStatus[]> = {
  a_faire: ["en_cours", "annulee"],
  en_cours: ["a_verifier", "annulee"],
  a_verifier: ["cloturee", "en_cours"],
  cloturee: ["en_cours"],
  annulee: [],
};

export function isTaskOverdue(
  dueDate: Date | string | null | undefined,
  status: CapaTaskStatus,
  now = new Date()
): boolean {
  if (!dueDate || status === "cloturee" || status === "annulee") return false;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

export function validateTaskTransition(
  current: CapaTaskStatus,
  next: CapaTaskStatus,
  fields: {
    completionEvidence?: string | null;
    effectivenessResult?: string | null;
    reopeningReason?: string | null;
  }
): string | null {
  if (!TASK_TRANSITIONS[current]?.includes(next)) return `Transition d'action invalide : ${current} -> ${next}.`;
  if (next === "a_verifier" && !fields.completionEvidence?.trim()) return "Une preuve de réalisation est requise.";
  if (next === "cloturee" && !["efficace", "inefficace"].includes(fields.effectivenessResult ?? "")) {
    return "L'efficacité doit être évaluée avant clôture.";
  }
  if (current === "cloturee" && next === "en_cours" && !fields.reopeningReason?.trim()) {
    return "Un motif de réouverture est obligatoire.";
  }
  return null;
}

export function validateCapaTaskReadiness(
  next: CapaStatus,
  tasks: Array<{ status: CapaTaskStatus; effectivenessResult?: string | null }>
): string | null {
  if (!next.startsWith("cloturee") || next === "cloturee_sans_suite") return null;
  if (tasks.length === 0) return "La CAPA ne peut pas être clôturée sans action opérationnelle.";
  if (tasks.some((task) => !["cloturee", "annulee"].includes(task.status))) {
    return "Toutes les actions opérationnelles doivent être finalisées avant la clôture de la CAPA.";
  }
  if (next === "cloturee_efficace" && tasks.some((task) => task.status !== "cloturee" || task.effectivenessResult !== "efficace")) {
    return "Toutes les actions doivent avoir une efficacité démontrée avant une clôture efficace.";
  }
  return null;
}

/**
 * Valide les champs obligatoires exigés par une transition donnée, au-delà
 * de la validité de la transition elle-même (voir isValidStatusTransition).
 * Retourne un message d'erreur, ou `null` si la transition peut être
 * appliquée.
 */
export function validateTransitionFields(
  next: CapaStatus,
  fields: StatusTransitionFields
): string | null {
  if (next === "en_cours" && fields.gravite === "majeur" && !fields.analyseCauseRacine?.trim()) {
    return "L'analyse de cause racine est obligatoire pour une action de gravité majeure passant en cours.";
  }
  if (next === "a_verifier" && !fields.preuveRealisation?.trim()) {
    return "La preuve de réalisation est requise avant de passer en vérification d'efficacité.";
  }
  if (
    (next === "cloturee_efficace" || next === "cloturee_inefficace") &&
    !fields.preuveEfficacite?.trim()
  ) {
    return "La preuve d'efficacité est requise pour clôturer une action.";
  }
  if (next === "cloturee_efficace" && fields.resultatEfficacite !== "efficace") {
    return "Le résultat d'efficacité doit être « efficace » pour une clôture efficace.";
  }
  if (next === "cloturee_inefficace" && fields.resultatEfficacite !== "inefficace") {
    return "Le résultat d'efficacité doit être « inefficace » pour une clôture inefficace (réouverture).";
  }
  return null;
}

function graviteRank(g: Gravite): number {
  return g === "majeur" ? 0 : g === "mineur" ? 1 : 2;
}

/** Tri par défaut du plan d'action : critiques/majeurs d'abord (voir §5 SPEC-2). */
export function sortByPriority<T extends { gravite: Gravite; criticality: Criticality }>(
  actions: T[]
): T[] {
  return [...actions].sort((a, b) => {
    const scoreDiff = priorityScore(b.gravite, b.criticality) - priorityScore(a.gravite, a.criticality);
    if (scoreDiff !== 0) return scoreDiff;
    return graviteRank(a.gravite) - graviteRank(b.gravite);
  });
}
