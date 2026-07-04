/**
 * Moteur de scoring QARA — Lot 2 (voir SPEC-1-moteur-scoring.md fournie).
 *
 * Calcul pur et déterministe : prend des questions + réponses en entrée, ne
 * lit ni n'écrit rien en base (la persistance est gérée par l'appelant, voir
 * server/scoring/scoringRouter.ts). Écarts documentés par rapport à la spec
 * d'origine dans docs/audit/08-moteur-scoring.md — notamment : le champ
 * `grade_mdsap` structuré supposé par la spec n'existe pas dans le corpus réel
 * (`typicalNc` est un tableau de descriptions textuelles libres, pas un objet
 * {gravite, grade_mdsap}) ; la propagation multi-référentiel est donc
 * restituée comme une matrice de couverture croisée informative (basée sur
 * les `mappings` du corpus), pas comme un mécanisme qui modifie le score d'une
 * autre exigence — le corpus ne fournit pas d'identifiant vers cette autre
 * exigence, seulement un libellé.
 */

import type {
  Criticality,
  Ecart,
  GroupResult,
  Gravite,
  CouvertureCroisee,
  ProcessResult,
  ReferentialResult,
  ScoringConfig,
  ScoringQuestion,
  ScoringResponse,
  ScoringResult,
  Statut,
} from "./types";
import { DEFAULT_SCORING_CONFIG } from "./types";

/**
 * Score élémentaire d'une réponse, entre 0 et 1, ou `null` si la question est
 * hors périmètre du calcul (non applicable ou pas encore répondue).
 */
export function elementaryScore(
  question: Pick<ScoringQuestion, "questionType">,
  response: ScoringResponse | undefined
): number | null {
  if (!response) return null;
  if (response.responseValue === "not_applicable") return null;

  if (question.questionType === "maturity_0_5") {
    // Ne pas se fier à `responseValue` ici : l'adaptateur DB (scoringRouter.ts)
    // pose un `responseValue` de convention ("in_progress") pour les réponses
    // de maturité, le niveau réel étant porté par `maturityLevel`. Un niveau
    // absent signifie "pas encore répondu".
    const level = response.maturityLevel;
    if (level === null || level === undefined || Number.isNaN(level)) return null;
    return Math.max(0, Math.min(5, level)) / 5;
  }

  if (response.responseValue === "in_progress") return null;

  // yes_no_partial_na
  switch (response.responseValue) {
    case "compliant":
      return 1;
    case "partial":
      return 0.5;
    case "non_compliant":
      return 0;
    default:
      return null;
  }
}

/** Regroupe le score élémentaire en un "niveau de réponse" pour la gradation des écarts. */
function answerBucket(
  question: Pick<ScoringQuestion, "questionType">,
  score: number,
  config: ScoringConfig
): "non" | "partiel" | "conforme" {
  if (question.questionType === "maturity_0_5") {
    const level = score * 5;
    if (level >= config.seuilMaturite) return "conforme";
    if (level <= 1) return "non";
    return "partiel";
  }
  if (score >= 1) return "conforme";
  if (score <= 0) return "non";
  return "partiel";
}

function graviteFor(bucket: "non" | "partiel", criticality: Criticality): Gravite {
  const highOrCritical = criticality === "critical" || criticality === "high";
  if (bucket === "non") return highOrCritical ? "majeur" : "mineur";
  // bucket === "partiel"
  return highOrCritical ? "mineur" : "observation";
}

/** Écart détecté pour une question/réponse, ou `null` si conforme ou hors périmètre. */
export function detectGap(
  question: ScoringQuestion,
  response: ScoringResponse | undefined,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): Ecart | null {
  const score = elementaryScore(question, response);
  if (score === null || !response) return null;

  const bucket = answerBucket(question, score, config);
  if (bucket === "conforme") return null;

  return {
    questionKey: question.questionKey,
    referentialCode: question.referentialCode,
    processName: question.processName,
    gravite: graviteFor(bucket, question.criticality),
    criticality: question.criticality,
    responseValue: response.responseValue,
    elementaryScore: score,
    typicalNc: question.typicalNc ?? [],
  };
}

interface ScoredItem {
  question: ScoringQuestion;
  response: ScoringResponse | undefined;
  score: number | null;
}

function computeGroupResult(items: ScoredItem[], config: ScoringConfig): GroupResult {
  let weightedSum = 0;
  let weightTotal = 0;
  let maturitySum = 0;
  let maturityCount = 0;
  let notApplicable = 0;
  let notAnswered = 0;
  let critiques = 0;
  const ecarts = { majeurs: 0, mineurs: 0, observations: 0 };

  for (const { question, response, score } of items) {
    if (response?.responseValue === "not_applicable") {
      notApplicable++;
      continue;
    }
    if (score === null) {
      notAnswered++;
      continue;
    }

    const weight = config.poids[question.criticality];
    weightedSum += score * weight;
    weightTotal += weight;

    if (question.questionType === "maturity_0_5") {
      maturitySum += score * 5;
      maturityCount++;
    }

    const gap = detectGap(question, response, config);
    if (gap) {
      if (gap.gravite === "majeur") ecarts.majeurs++;
      else if (gap.gravite === "mineur") ecarts.mineurs++;
      else ecarts.observations++;

      if (question.criticality === "critical" && answerBucket(question, score, config) === "non") {
        critiques++;
      }
    }
  }

  const scorePct = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 1000) / 10 : 0;

  let statut: Statut;
  if (critiques > 0 || scorePct < config.seuilConformeAvecReserves) {
    statut = "non_conforme";
  } else if (scorePct >= config.seuilConforme) {
    statut = "conforme";
  } else {
    statut = "conforme_avec_reserves";
  }

  return {
    score: scorePct,
    statut,
    ecartsCritiques: critiques,
    ecarts,
    maturiteMoyenne: maturityCount > 0 ? Math.round((maturitySum / maturityCount) * 10) / 10 : null,
    questionsApplicables: weightTotal > 0 ? items.length - notApplicable - notAnswered : 0,
    questionsNonApplicables: notApplicable,
    questionsNonRepondues: notAnswered,
  };
}

/**
 * Point d'entrée principal : calcule le résultat complet (global, par
 * référentiel, par processus, écarts, couverture croisée) à partir de la
 * liste des questions du périmètre audité et des réponses saisies.
 */
export function buildScoringResult(
  questions: ScoringQuestion[],
  responses: ScoringResponse[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): ScoringResult {
  const responseByKey = new Map(responses.map((r) => [r.questionKey, r]));

  const items: ScoredItem[] = questions.map((question) => {
    const response = responseByKey.get(question.questionKey);
    return { question, response, score: elementaryScore(question, response) };
  });

  const global = computeGroupResult(items, config);

  const byReferential = new Map<string, ScoredItem[]>();
  const byProcess = new Map<string, ScoredItem[]>(); // clé: `${referentialCode}::${processName}`
  for (const item of items) {
    const refCode = item.question.referentialCode;
    if (!byReferential.has(refCode)) byReferential.set(refCode, []);
    byReferential.get(refCode)!.push(item);

    if (item.question.processName) {
      const key = `${refCode}::${item.question.processName}`;
      if (!byProcess.has(key)) byProcess.set(key, []);
      byProcess.get(key)!.push(item);
    }
  }

  const parReferentiel: ReferentialResult[] = Array.from(byReferential.entries()).map(
    ([referentialCode, groupItems]) => ({
      referentialCode,
      ...computeGroupResult(groupItems, config),
    })
  );

  const parProcessus: ProcessResult[] = Array.from(byProcess.entries()).map(([key, groupItems]) => {
    const [referentialCode, processName] = key.split("::");
    return {
      referentialCode,
      processName,
      ...computeGroupResult(groupItems, config),
    };
  });

  const ecarts: Ecart[] = items
    .map(({ question, response }) => detectGap(question, response, config))
    .filter((e): e is Ecart => e !== null)
    // Grade décroissant : majeur > mineur > observation.
    .sort((a, b) => graviteRank(a.gravite) - graviteRank(b.gravite));

  const couvertureCroisee: CouvertureCroisee[] = questions
    .filter((q) => (q.mappings ?? []).length > 1) // au moins une correspondance en plus de l'exigence primaire
    .map((q) => {
      const primaire = (q.mappings ?? []).find((m) => m.correspondance === "exigence primaire");
      return {
        questionKey: q.questionKey,
        referentielSource: q.referentialCode,
        exigenceSource: primaire?.libelle_exigence ?? null,
        referentielsCouverts: (q.mappings ?? []).filter((m) => m.correspondance !== "exigence primaire"),
      };
    });

  return { global, parReferentiel, parProcessus, ecarts, couvertureCroisee };
}

function graviteRank(g: Gravite): number {
  return g === "majeur" ? 0 : g === "mineur" ? 1 : 2;
}
