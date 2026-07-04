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
