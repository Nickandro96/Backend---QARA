/**
 * Dictionnaire de libellés du rapport d'audit — fr/en (Tâche D.6).
 * Aucune chaîne de rapport ne doit être écrite en dur ailleurs que dans ce
 * fichier ; les intitulés réglementaires officiels (ex. "21 CFR 820",
 * "MDR 2017/745") restent dans leur langue d'usage, jamais traduits.
 */
export type ReportLanguage = "fr" | "en";

const DICT = {
  reportTitle: { fr: "RAPPORT D'AUDIT", en: "AUDIT REPORT" },
  confidential: { fr: "CONFIDENTIEL", en: "CONFIDENTIAL" },
  page: { fr: "Page", en: "Page" },
  of: { fr: "sur", en: "of" },
  reference: { fr: "Référence", en: "Reference" },
  version: { fr: "Version", en: "Version" },
  status: { fr: "Statut", en: "Status" },
  statusDraft: { fr: "Projet", en: "Draft" },
  statusFinal: { fr: "Final", en: "Final" },
  emissionDate: { fr: "Date d'émission", en: "Issue date" },
  auditType: { fr: "Type d'audit", en: "Audit type" },
  organisationAudited: { fr: "Organisation auditée", en: "Audited organisation" },
  referentialsAudited: { fr: "Référentiel(s) audité(s)", en: "Standard(s) audited" },
  scope: { fr: "Périmètre", en: "Scope" },
  auditDates: { fr: "Dates d'audit", en: "Audit dates" },
  auditTeam: { fr: "Équipe d'audit", en: "Audit team" },
  auditeeRepresentatives: { fr: "Représentants de l'audité", en: "Auditee representatives" },
  approvalSignature: { fr: "Emplacement d'approbation / signature", en: "Approval / signature block" },
  distributionList: { fr: "Liste de diffusion", en: "Distribution list" },
  tableOfContents: { fr: "Sommaire", en: "Table of contents" },
  notProvided: { fr: "Non renseigné", en: "Not provided" },
  none: { fr: "Aucun", en: "None" },

  // Section 1
  section1Title: { fr: "1. CONTEXTE, OBJECTIFS ET MÉTHODOLOGIE", en: "1. CONTEXT, OBJECTIVES AND METHODOLOGY" },
  objectives: { fr: "Objectifs de l'audit", en: "Audit objectives" },
  objectivesText: {
    fr: "Évaluer la conformité du système de management aux référentiels applicables, identifier les écarts et vérifier l'aptitude du système à atteindre les résultats attendus.",
    en: "Assess the management system's conformity to the applicable standards, identify gaps, and verify the system's ability to achieve its intended results.",
  },
  criteria: { fr: "Critères d'audit", en: "Audit criteria" },
  methodology: { fr: "Méthodologie", en: "Methodology" },
  methodologyText: {
    fr: "Revue documentaire, entretiens avec le personnel concerné, observation des pratiques opérationnelles, échantillonnage des enregistrements.",
    en: "Document review, interviews with relevant personnel, observation of operational practices, sampling of records.",
  },
  samplingDisclaimer: {
    fr: "Déclaration d'échantillonnage (ISO 19011) : cet audit repose sur un examen par échantillonnage. L'absence d'écart constaté sur les éléments examinés ne garantit pas la conformité de l'ensemble du système ou de tous les enregistrements non échantillonnés.",
    en: "Sampling statement (ISO 19011): this audit is based on a sample-based examination. The absence of a finding on the items examined does not guarantee the conformity of the entire system or of records not sampled.",
  },
  confidentialityClause: {
    fr: "Clause de confidentialité : le présent rapport et son contenu sont strictement confidentiels et destinés exclusivement à l'organisation auditée et aux personnes habilitées de la liste de diffusion.",
    en: "Confidentiality clause: this report and its content are strictly confidential and intended exclusively for the audited organisation and authorised persons on the distribution list.",
  },
  scopeExclusions: { fr: "Limites et exclusions", en: "Limitations and exclusions" },

  // Section 2
  section2Title: { fr: "2. PROFIL RÉGLEMENTAIRE DE L'ORGANISATION", en: "2. REGULATORY PROFILE OF THE ORGANISATION" },
  economicRole: { fr: "Rôle économique", en: "Economic operator role" },
  targetMarkets: { fr: "Marchés visés", en: "Target markets" },
  prrc: { fr: "PRRC (Art. 15 MDR)", en: "PRRC (MDR Art. 15)" },
  notifiedBody: { fr: "Organisme notifié", en: "Notified body" },
  certificates: { fr: "Certificats en cours", en: "Current certificates" },

  // Section 3
  section3Title: { fr: "3. SYNTHÈSE EXÉCUTIVE", en: "3. EXECUTIVE SUMMARY" },
  globalScore: { fr: "Score global de conformité", en: "Overall conformity score" },
  scoringMethod: { fr: "Méthode de calcul", en: "Scoring method" },
  scoringMethodText: {
    fr: "Score pondéré par réponse (conforme = 100, partiellement conforme = 60, non conforme = 20, non applicable = 100, en cours = 50), moyenné sur l'ensemble des questions répondues du périmètre audité.",
    en: "Weighted score per response (compliant = 100, partially compliant = 60, non-compliant = 20, not applicable = 100, in progress = 50), averaged over all answered questions in the audited scope.",
  },
  breakdown: { fr: "Répartition des réponses", en: "Response breakdown" },
  compliant: { fr: "Conforme", en: "Compliant" },
  partial: { fr: "Partiellement conforme", en: "Partially compliant" },
  nonCompliant: { fr: "Non conforme", en: "Non-compliant" },
  notApplicable: { fr: "Non applicable", en: "Not applicable" },
  gapsByCriticality: { fr: "Écarts par criticité", en: "Gaps by criticality" },
  strengths: { fr: "Points forts identifiés", en: "Identified strengths" },
  verdict: { fr: "Verdict / recommandation", en: "Verdict / recommendation" },
  previousAuditComparison: { fr: "Comparaison avec l'audit précédent", en: "Comparison with previous audit" },
  noPreviousAudit: { fr: "Aucun audit précédent disponible pour comparaison.", en: "No previous audit available for comparison." },

  // Section 4
  section4Title: { fr: "4. RÉSULTATS PAR PROCESSUS", en: "4. RESULTS BY PROCESS" },
  process: { fr: "Processus", en: "Process" },
  questionsCount: { fr: "Nb questions", en: "Question count" },
  score: { fr: "Score", en: "Score" },

  // Section 5
  section5Title: { fr: "5. REGISTRE DES ÉCARTS", en: "5. NONCONFORMITY / GAP REGISTER" },
  noGaps: { fr: "Aucun écart de criticité identifié sur le périmètre audité.", en: "No gap of any criticality was identified within the audited scope." },
  gapReference: { fr: "Référence", en: "Reference" },
  requirement: { fr: "Exigence", en: "Requirement" },
  objectiveEvidence: { fr: "Preuve objective", en: "Objective evidence" },
  gapStatement: { fr: "Énoncé d'écart", en: "Gap statement" },
  criticality: { fr: "Criticité", en: "Criticality" },
  criticalityJustification: { fr: "Justification du classement", en: "Classification justification" },
  criticalityMajor: { fr: "Majeure", en: "Major" },
  criticalityMinor: { fr: "Mineure", en: "Minor" },
  criticalityObservation: { fr: "Observation", en: "Observation" },
  processAndSite: { fr: "Processus / site", en: "Process / site" },
  mdsapGrade: { fr: "Gradation MDSAP (AU P0002)", en: "MDSAP grading (AU P0002)" },
  mdsapEscalation: { fr: "Escalade MDSAP", en: "MDSAP escalation" },

  // Section 6
  section6Title: { fr: "6. PLAN D'ACTION / CAPA", en: "6. ACTION PLAN / CAPA" },
  noActions: { fr: "Aucune action corrective enregistrée à ce jour.", en: "No corrective action recorded to date." },
  containment: { fr: "Correction immédiate (containment)", en: "Immediate correction (containment)" },
  rootCauseAnalysis: { fr: "Analyse de cause racine", en: "Root cause analysis" },
  rootCauseMethod: { fr: "Méthode", en: "Method" },
  correctiveAction: { fr: "Action corrective", en: "Corrective action" },
  responsible: { fr: "Responsable", en: "Responsible" },
  dueDate: { fr: "Échéance", en: "Due date" },
  verificationCriteria: { fr: "Critère de vérification d'efficacité", en: "Effectiveness verification criteria" },
  verificationDate: { fr: "Date de vérification d'efficacité", en: "Effectiveness verification date" },
  linkedGap: { fr: "Écart lié", en: "Linked gap" },

  // Section 7
  section7Title: { fr: "7. CONCLUSION", en: "7. CONCLUSION" },
  systemAptitude: { fr: "Appréciation de l'aptitude du système", en: "System aptitude assessment" },
  recommendation: { fr: "Recommandation", en: "Recommendation" },
  nextSteps: { fr: "Prochaines échéances", en: "Next steps" },

  // Section 8
  section8Title: { fr: "8. ANNEXES", en: "8. APPENDICES" },
  annexQA: { fr: "8.1 Détail des questions / réponses", en: "8.1 Question / answer detail" },
  annexEvidence: { fr: "8.2 Index des preuves", en: "8.2 Evidence index" },
  annexPeople: { fr: "8.3 Personnes rencontrées", en: "8.3 People interviewed" },
  annexAgenda: { fr: "8.4 Plan d'audit réalisé vs prévu", en: "8.4 Actual vs planned audit agenda" },
  annexGlossary: { fr: "8.5 Glossaire et abréviations", en: "8.5 Glossary and abbreviations" },
  annexVersions: { fr: "8.6 Historique des versions du rapport", en: "8.6 Report version history" },
  question: { fr: "Question", en: "Question" },
  answer: { fr: "Réponse", en: "Answer" },
  comment: { fr: "Commentaire", en: "Comment" },
  evidenceDocument: { fr: "Document", en: "Document" },
  evidenceDate: { fr: "Date", en: "Date" },
  name: { fr: "Nom", en: "Name" },
  function: { fr: "Fonction", en: "Function" },

  // Excel-specific tabs
  tabSummary: { fr: "Synthèse", en: "Summary" },
  tabQA: { fr: "Détail Q-R", en: "Q&A Detail" },
  tabGapRegister: { fr: "Registre écarts", en: "Gap register" },
  tabCapaPlan: { fr: "Plan CAPA", en: "CAPA Plan" },
  tabEvidenceIndex: { fr: "Index des preuves", en: "Evidence index" },
} as const;

export type DictKey = keyof typeof DICT;

export function t(key: DictKey, lang: ReportLanguage): string {
  return DICT[key][lang];
}

export function makeTranslator(lang: ReportLanguage) {
  return (key: DictKey) => t(key, lang);
}

const AUDIT_NATURE_LABELS: Record<string, { fr: string; en: string }> = {
  interne: { fr: "Interne", en: "Internal" },
  fournisseur: { fr: "Fournisseur", en: "Supplier" },
  blanc: { fr: "Audit à blanc", en: "Mock audit" },
  revue_conformite: { fr: "Revue de conformité", en: "Compliance review" },
};

export function translateAuditNature(value: string | null, lang: ReportLanguage): string | null {
  if (!value) return null;
  return AUDIT_NATURE_LABELS[value]?.[lang] ?? value;
}
