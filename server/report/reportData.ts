/**
 * Assembleur de données du rapport d'audit (Tâche D) — langue-agnostique,
 * format-agnostique. Les trois rendus (PDF/Word/Excel, voir pdfRenderer.ts/
 * wordRenderer.ts/excelRenderer.ts) consomment TOUS ce même objet, pour
 * garantir des chiffres strictement identiques entre les trois formats et
 * avec le dashboard (même calcul de score, voir audit-scoring.ts/
 * scoringEngine.ts).
 *
 * Réutilise le moteur de scoring (buildScoringResult) et le CAPA existants
 * plutôt que de recalculer : le registre des écarts (section 5) et le plan
 * CAPA (section 6) sont assemblés en JOIGNANT chaque écart à sa fiche
 * capa_actions par questionKey — c'est ce qui garantit la cohérence totale
 * exigée par la Tâche E ("ce qui est saisi dans CAPA alimente le rapport").
 *
 * Priorité absolue : aucune donnée inventée. Tout champ non disponible en
 * base est explicitement `null` ici ; c'est aux renderers de l'afficher
 * comme "Non renseigné" (jamais une valeur par défaut plausible).
 */
import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb, safeJsonParse } from "../db";
import {
  audits,
  sites,
  organisations,
  organisationCertificates,
  audit_responses,
  questions,
  mdrEvidenceFiles,
  auditReports,
  capa_actions,
} from "../../drizzle/schema";
import { loadAuditScoringContext } from "../scoring/scoringRouter";
import { buildScoringResult } from "../scoring/scoringEngine";
import { computeGenericAuditStats } from "../audit-scoring";
import { buildAuditReport } from "./reportBuilder";
import { DEFAULT_SCORING_CONFIG } from "../scoring/types";
import type { Ecart } from "../scoring/types";
import type { ReportLanguage } from "./i18n";

export interface GapEntry {
  reference: string; // NC-{year}-{seq}, calculé, stable pour un même jeu d'écarts
  requirementRef: string | null; // ex. "Art. 10" / "Annexe I"
  requirementTitle: string | null;
  objectiveEvidence: string | null; // commentaire/note de la réponse réelle
  gapStatement: string; // vient de capa_actions.ecartIdentifie si généré, sinon construit à la volée
  gravite: "majeur" | "mineur" | "observation";
  criticalityJustification: string;
  processName: string | null;
  siteName: string | null;
  referentialCode: string;
  status: string; // statut CAPA si généré, sinon "identifié (CAPA non généré)"
  mdsapGrade: number | null;
  mdsapEscalation: string | null;
  linkedCapaId: number | null;
}

export interface CapaEntry {
  gapReference: string;
  containment: string | null; // pas de colonne dédiée sur capa_actions — "Non renseigné" assumé
  rootCauseAnalysis: string | null;
  rootCauseMethod: string | null;
  correctiveAction: string | null;
  responsible: string | null;
  dueDate: string | null;
  verificationCriteria: string | null; // approximé par preuveEfficacite (pas de champ "critère" distinct en base)
  verificationDate: string | null;
  status: string;
}

export interface QaEntry {
  processName: string | null;
  requirementRef: string | null;
  questionTitle: string | null;
  responseValue: string | null;
  comment: string | null;
}

export interface EvidenceEntry {
  fileName: string;
  questionKey: string;
  createdAt: string;
}

export interface CertificateEntry {
  referentialCode: string | null;
  certificateNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
}

export interface PersonEntry {
  name: string;
  function?: string | null;
  role?: string | null;
  email?: string | null;
}

export interface ProcessResultRow {
  processName: string;
  referentialCode: string;
  questionsApplicables: number;
  score: number;
  ecartsMajeurs: number;
  ecartsMineurs: number;
  ecartsObservations: number;
}

export interface PreviousAuditComparison {
  auditName: string;
  date: string | null;
  score: number;
}

export interface ReportData {
  language: ReportLanguage;
  generatedAt: string;

  // Page de garde
  auditId: number;
  auditName: string;
  auditNature: string | null;
  referentialNames: string[];
  organisationName: string | null;
  organisationAddress: string | null;
  organisationSiret: string | null;
  organisationSrn: string | null;
  organisationLogoUrl: string | null;
  siteName: string | null;
  processScope: string[];
  startDate: string | null;
  endDate: string | null;
  auditTeam: Array<{ name: string; role: string; email?: string }>;
  auditeesRepresentatives: PersonEntry[];
  reportReference: string;
  reportVersion: number;
  reportStatus: "draft" | "final";
  distributionList: string | null;

  // Section 1
  scopeExclusions: string | null;

  // Section 2
  economicRole: string | null;
  markets: string[];
  prrcName: string | null;
  prrcQualification: string | null;
  notifiedBodyName: string | null;
  notifiedBodyNumber: string | null;
  certificates: CertificateEntry[];

  // Section 3
  globalScore: number;
  breakdown: { compliant: number; partial: number; nonCompliant: number; notApplicable: number };
  gapsByGravite: { majeur: number; mineur: number; observation: number };
  verdictPhrase: string;
  previousAudit: PreviousAuditComparison | null;

  // Section 4
  processResults: ProcessResultRow[];

  // Section 5
  gapRegister: GapEntry[];

  // Section 6
  capaPlan: CapaEntry[];

  // Section 8
  fullQA: QaEntry[];
  evidenceIndex: EvidenceEntry[];
  reportVersionHistory: Array<{ version: number; status: string; date: string }>;
}

function formatGapReference(year: number, index: number): string {
  return `NC-${year}-${String(index + 1).padStart(4, "0")}`;
}

/**
 * Le corpus inclut parfois la référence d'article/annexe directement dans
 * `questions.title` (ex. title="Annexe II — documentation technique...").
 * Évite d'afficher la référence deux fois dans la fiche d'écart quand
 * `requirementRef` et `requirementTitle` se recouvrent déjà textuellement
 * — les deux champs restent réels, seul l'affichage est dédupliqué.
 */
function dedupeRequirementTitle(ref: string | null, title: string | null): string | null {
  if (!ref || !title) return title;
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedRef = ref.trim().toLowerCase();
  if (normalizedTitle.startsWith(normalizedRef)) {
    const stripped = title.trim().slice(ref.trim().length).replace(/^[\s—-]+/, "");
    return stripped || title;
  }
  return title;
}

function buildGapStatement(ecart: Ecart): string {
  const nc = (ecart.typicalNc ?? []).join(" ; ") || "Non renseigné";
  return `Réponse « ${ecart.responseValue} » — NC typiques : ${nc}`;
}

/**
 * Verdict recalculé sur le score dashboard (dashboardStats.score), pas sur
 * scoringResult.global.score (scoringEngine.ts) — mêmes seuils que
 * DEFAULT_SCORING_CONFIG mais appliqués à la valeur réellement affichée en
 * tête de rapport, pour éviter un verdict incohérent avec le score affiché
 * juste au-dessus (voir note sur dashboardStats plus bas).
 */
function computeVerdictPhrase(score: number, ecartsCritiques: number, lang: ReportLanguage): string {
  const phrases = {
    pret: {
      fr: "Le périmètre audité est prêt pour un audit externe : aucun écart bloquant, score de conformité au-dessus du seuil cible.",
      en: "The audited scope is ready for an external audit: no blocking gap, conformity score above the target threshold.",
    },
    pret_avec_reserves: {
      fr: "Le périmètre audité est prêt sous réserve de traiter les écarts en cours avant un audit externe : le score est acceptable mais des écarts majeurs subsistent.",
      en: "The audited scope is ready subject to addressing ongoing gaps before an external audit: the score is acceptable but major gaps remain.",
    },
    pas_pret: {
      fr: "Le périmètre audité n'est pas prêt pour un audit externe : au moins un écart critique bloquant ou un score en dessous du seuil minimal doit être corrigé.",
      en: "The audited scope is not ready for an external audit: at least one blocking critical gap or a score below the minimum threshold must be corrected.",
    },
  };
  if (ecartsCritiques === 0 && score >= DEFAULT_SCORING_CONFIG.seuilConforme) return phrases.pret[lang];
  if (score >= DEFAULT_SCORING_CONFIG.seuilConformeAvecReserves) return phrases.pret_avec_reserves[lang];
  return phrases.pas_pret[lang];
}

const GRAVITE_JUSTIFICATION: Record<string, string> = {
  majeur: "Écart classé majeur : absence de preuve, rupture de traçabilité, ou impact potentiel patient/réglementaire non maîtrisé.",
  mineur: "Écart classé mineur : dossier ponctuellement incomplet mais décision justifiée et impact maîtrisé.",
  observation: "Observation : constat mineur sans non-conformité avérée, à surveiller.",
};

export async function assembleReportData(
  auditId: number,
  userId: number,
  language: ReportLanguage
): Promise<ReportData> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [audit] = await db.select().from(audits).where(and(eq(audits.id, auditId), eq(audits.userId, userId))).limit(1);
  if (!audit) throw new Error(`Audit not found: ${auditId}`);

  const [site] = audit.siteId ? await db.select().from(sites).where(eq(sites.id, audit.siteId)).limit(1) : [null];

  const [organisation] = await db.select().from(organisations).where(eq(organisations.userId, userId)).limit(1);
  const certificates = organisation
    ? await db.select().from(organisationCertificates).where(eq(organisationCertificates.organisationId, organisation.id))
    : [];

  const { scoringQuestions, scoringResponses, questionRows } = await loadAuditScoringContext(db, auditId, userId);
  const scoringResult = buildScoringResult(scoringQuestions, scoringResponses);

  const questionByKey = new Map(questionRows.map((q) => [q.questionKey, q]));

  const rawResponses = await db
    .select()
    .from(audit_responses)
    .where(and(eq(audit_responses.auditId, auditId), eq(audit_responses.userId, userId)));
  const responseByKey = new Map(rawResponses.map((r) => [r.questionKey, r]));

  const capaRows = await db
    .select()
    .from(capa_actions)
    .where(and(eq(capa_actions.auditId, auditId), eq(capa_actions.userId, userId)));
  const capaByKey = new Map(capaRows.map((c) => [c.questionKey, c]));

  const evidenceRows = await db
    .select()
    .from(mdrEvidenceFiles)
    .where(and(eq(mdrEvidenceFiles.auditId, auditId), eq(mdrEvidenceFiles.userId, userId)));

  const reportRows = await db
    .select()
    .from(auditReports)
    .where(and(eq(auditReports.auditId, auditId), eq(auditReports.userId, userId)))
    .orderBy(desc(auditReports.createdAt));

  const questionByKeyMap = new Map(
    questionRows
      .filter((q) => q.questionKey)
      .map((q) => [
        q.questionKey!,
        {
          auditVerifies: q.auditVerifies ?? null,
          explanationSimple: null,
          concreteExample: null,
          conformityCriteria: null,
          referenceStatus: null,
          officialSource: null,
        },
      ])
  );

  const capaActionsForBuilder = capaRows.map((row) => ({
    id: row.id,
    auditId: row.auditId,
    questionKey: row.questionKey,
    referentialCode: row.referentialCode,
    processName: row.processName,
    gravite: row.gravite as any,
    criticality: row.criticality as any,
    ecartIdentifie: row.ecartIdentifie,
    analyseCauseRacine: row.analyseCauseRacine,
    actionRecommandee: row.actionRecommandee,
    actionRetenue: row.actionRetenue,
    responsible: row.responsible,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    statut: row.statut as any,
    preuveRealisation: row.preuveRealisation,
    dateVerificationEfficacite: row.dateVerificationEfficacite ? row.dateVerificationEfficacite.toISOString() : null,
    preuveEfficacite: row.preuveEfficacite,
    resultatEfficacite: row.resultatEfficacite as any,
    rootCauseMethod: (row as any).rootCauseMethod ?? null,
    mdsapGrade: (row as any).mdsapGrade ?? null,
    mdsapEscalation: (row as any).mdsapEscalation ?? null,
    referentielsImpactes: safeJsonParse(row.referentielsImpactes, []),
    priorite: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  const referentialCodes = Array.from(new Set(scoringQuestions.map((q) => q.referentialCode)));

  // Score global affiché en page de garde/section 3 : DOIT être identique à
  // celui du dashboard (computeGenericAuditStats, audit-scoring.ts — moyenne
  // simple par SCORE_MAP), pas au score de scoringEngine.ts (pondéré par
  // criticité, poids critical=4/high=3/medium=2/low=1 — moteur distinct
  // utilisé pour la génération CAPA et le détail par processus/écarts).
  // Trouvé en vérifiant le contenu réel (audit id=1) : 68.0% (scoringEngine)
  // contre 80.6% (dashboard) pour le même audit — deux moteurs de score
  // parallèles existent dans le code, jamais réconciliés jusqu'ici. Corrigé
  // ici pour le chiffre affiché en tête de rapport ; le détail par processus/
  // la gradation des écarts restent pondérés par criticité (finalité
  // différente : priorisation CAPA, pas un second "score global").
  const dashboardStats = await computeGenericAuditStats(db, userId, auditId);

  const built = buildAuditReport({
    meta: {
      auditId: audit.id,
      organisationName: organisation?.name ?? audit.clientOrganization ?? null,
      siteName: site?.name ?? audit.siteLocation ?? null,
      economicRole: audit.economicRole ?? null,
      referentialCodes,
      auditorName: audit.auditorName ?? null,
      auditorEmail: audit.auditorEmail ?? null,
      startDate: audit.startDate ? audit.startDate.toISOString() : null,
      endDate: audit.endDate ? audit.endDate.toISOString() : null,
      niveau: "detaille",
    },
    scoringResult,
    capaActions: capaActionsForBuilder,
    config: DEFAULT_SCORING_CONFIG,
    questionsByKey: questionByKeyMap,
  });

  // --- Section 5/6 : registre des écarts + plan CAPA, joints par questionKey ---
  const year = audit.startDate ? audit.startDate.getFullYear() : new Date().getFullYear();
  const sortedEcarts = [...scoringResult.ecarts].sort((a, b) => {
    const order: Record<string, number> = { majeur: 0, mineur: 1, observation: 2 };
    return (order[a.gravite] ?? 9) - (order[b.gravite] ?? 9);
  });

  const gapRegister: GapEntry[] = sortedEcarts.map((ecart, index) => {
    const q = questionByKey.get(ecart.questionKey);
    const r = responseByKey.get(ecart.questionKey);
    const capa = capaByKey.get(ecart.questionKey);
    const requirementRef = [q?.article, q?.annexe].filter(Boolean).join(" / ") || null;
    const objectiveEvidence = r?.responseComment || r?.note || null;

    return {
      reference: formatGapReference(year, index),
      requirementRef,
      requirementTitle: dedupeRequirementTitle(q?.annexe ?? q?.article ?? null, q?.title ?? null),
      objectiveEvidence,
      gapStatement: capa?.ecartIdentifie || buildGapStatement(ecart),
      gravite: ecart.gravite,
      criticalityJustification: GRAVITE_JUSTIFICATION[ecart.gravite] ?? "",
      processName: ecart.processName,
      siteName: site?.name ?? null,
      referentialCode: ecart.referentialCode,
      status: capa ? capa.statut : "identifié (plan CAPA non généré)",
      mdsapGrade: (capa as any)?.mdsapGrade ?? null,
      mdsapEscalation: (capa as any)?.mdsapEscalation ?? null,
      linkedCapaId: capa?.id ?? null,
    };
  });

  const capaPlan: CapaEntry[] = gapRegister
    .filter((g) => g.linkedCapaId !== null)
    .map((g) => {
      const capa = capaRows.find((c) => c.id === g.linkedCapaId)!;
      return {
        gapReference: g.reference,
        containment: null,
        rootCauseAnalysis: capa.analyseCauseRacine,
        rootCauseMethod: (capa as any).rootCauseMethod ?? null,
        correctiveAction: capa.actionRetenue || capa.actionRecommandee,
        responsible: capa.responsible,
        dueDate: capa.dueDate ? capa.dueDate.toISOString() : null,
        verificationCriteria: capa.preuveEfficacite,
        verificationDate: capa.dateVerificationEfficacite ? capa.dateVerificationEfficacite.toISOString() : null,
        status: capa.statut,
      };
    });

  // --- Section 4 : résultats par processus ---
  const processResults: ProcessResultRow[] = scoringResult.parProcessus.map((p) => ({
    processName: p.processName,
    referentialCode: p.referentialCode,
    questionsApplicables: p.questionsApplicables,
    score: p.score,
    ecartsMajeurs: p.ecarts.majeurs,
    ecartsMineurs: p.ecarts.mineurs,
    ecartsObservations: p.ecarts.observations,
  }));

  // --- Section 8.1 : détail Q&A complet ---
  const fullQA: QaEntry[] = questionRows
    .filter((q) => q.questionKey)
    .map((q) => {
      const r = responseByKey.get(q.questionKey!);
      return {
        processName: q.processId ? scoringQuestions.find((sq) => sq.questionKey === q.questionKey)?.processName ?? null : null,
        requirementRef: [q.article, q.annexe].filter(Boolean).join(" / ") || null,
        questionTitle: dedupeRequirementTitle(q.annexe ?? q.article ?? null, q.title),
        responseValue: r?.responseValue ?? null,
        comment: r?.responseComment || r?.note || null,
      };
    });

  // --- Section 8.2 : index des preuves ---
  const evidenceIndex: EvidenceEntry[] = evidenceRows.map((e) => ({
    fileName: e.fileName,
    questionKey: e.questionKey,
    createdAt: e.createdAt.toISOString(),
  }));

  // --- Comparaison avec l'audit précédent (même utilisateur, référentiels qui se recoupent, plus ancien) ---
  let previousAudit: PreviousAuditComparison | null = null;
  const priorAudits = await db
    .select()
    .from(audits)
    .where(and(eq(audits.userId, userId), inArray(audits.status, ["completed", "closed"])));
  const currentReferentialIds: number[] = safeJsonParse(audit.referentialIds, []);
  const candidates = priorAudits
    .filter((a) => a.id !== auditId)
    .filter((a) => {
      const ids: number[] = safeJsonParse(a.referentialIds, []);
      return ids.some((id) => currentReferentialIds.includes(id));
    })
    .filter((a) => !audit.startDate || !a.startDate || a.startDate < audit.startDate)
    .sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0));

  if (candidates.length > 0) {
    const prior = candidates[0];
    const priorContext = await loadAuditScoringContext(db, prior.id, userId);
    const priorScoring = buildScoringResult(priorContext.scoringQuestions, priorContext.scoringResponses);
    previousAudit = {
      auditName: prior.name,
      date: prior.startDate ? prior.startDate.toISOString() : null,
      score: priorScoring.global.score,
    };
  }

  return {
    language,
    generatedAt: new Date().toISOString(),

    auditId: audit.id,
    auditName: audit.name,
    auditNature: (audit as any).auditNature ?? null,
    referentialNames: referentialCodes,
    organisationName: organisation?.name ?? audit.clientOrganization ?? null,
    organisationAddress: organisation
      ? [organisation.addressLine1, organisation.postalCode, organisation.city, organisation.country].filter(Boolean).join(", ") || null
      : null,
    organisationSiret: organisation?.siret ?? null,
    organisationSrn: (organisation as any)?.srn ?? null,
    organisationLogoUrl: (organisation as any)?.logoUrl ?? null,
    siteName: site?.name ?? audit.siteLocation ?? null,
    processScope: Array.from(new Set(scoringQuestions.map((q) => q.processName).filter(Boolean))) as string[],
    startDate: audit.startDate ? audit.startDate.toISOString() : null,
    endDate: audit.endDate ? audit.endDate.toISOString() : null,
    auditTeam: safeJsonParse((audit as any).auditTeam, []),
    auditeesRepresentatives: safeJsonParse((audit as any).auditeesRepresentatives, []),
    reportReference: `RAP-${audit.id}-${year}`,
    reportVersion: reportRows.length + 1,
    reportStatus: "draft",
    distributionList: null,

    scopeExclusions: (audit as any).scopeExclusions ?? null,

    economicRole: audit.economicRole ?? null,
    markets: safeJsonParse(audit.markets, []),
    prrcName: (organisation as any)?.prrcName ?? null,
    prrcQualification: (organisation as any)?.prrcQualification ?? null,
    notifiedBodyName: (organisation as any)?.notifiedBodyName ?? null,
    notifiedBodyNumber: (organisation as any)?.notifiedBodyNumber ?? null,
    certificates: certificates.map((c) => ({
      referentialCode: c.referentialCode,
      certificateNumber: c.certificateNumber,
      issueDate: c.issueDate ? c.issueDate.toISOString() : null,
      expiryDate: c.expiryDate ? c.expiryDate.toISOString() : null,
    })),

    globalScore: dashboardStats.score,
    breakdown: {
      compliant: rawResponses.filter((r) => r.responseValue === "compliant").length,
      partial: rawResponses.filter((r) => r.responseValue === "partial").length,
      nonCompliant: rawResponses.filter((r) => r.responseValue === "non_compliant").length,
      notApplicable: rawResponses.filter((r) => r.responseValue === "not_applicable").length,
    },
    gapsByGravite: {
      majeur: built.syntheseExecutive.ecarts.majeurs,
      mineur: built.syntheseExecutive.ecarts.mineurs,
      observation: built.syntheseExecutive.ecarts.observations,
    },
    verdictPhrase: computeVerdictPhrase(dashboardStats.score, built.syntheseExecutive.ecartsCritiques, language),
    previousAudit,

    processResults,
    gapRegister,
    capaPlan,

    fullQA,
    evidenceIndex,
    reportVersionHistory: reportRows.map((r, i) => ({
      version: reportRows.length - i,
      status: "final",
      date: r.createdAt.toISOString(),
    })),
  };
}
