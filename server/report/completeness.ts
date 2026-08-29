import type { ReportData } from "./reportData";

export interface ReportCompleteness {
  answeredQuestions: number;
  totalQuestions: number;
  completionPercent: number;
  blocking: string[];
  missingCritical: string[];
  warnings: string[];
  defaultConclusion: string;
  defaultNextSteps: string;
}

export function assessReportCompleteness(data: ReportData): ReportCompleteness {
  const answeredQuestions = Object.values(data.breakdown).reduce((sum, count) => sum + count, 0);
  const totalQuestions = data.fullQA.length;
  const missingCritical: string[] = [];
  const warnings: string[] = [];

  if (!data.organisationName) missingCritical.push("Organisation auditée");
  if (!data.auditNature) missingCritical.push("Nature de l'audit");
  if (!data.startDate || !data.endDate) missingCritical.push("Dates de début et de fin");
  if (data.auditTeam.length === 0) missingCritical.push("Équipe d'audit");
  if (data.auditeesRepresentatives.length === 0) missingCritical.push("Représentants de l'audité");
  if (data.processScope.length === 0) missingCritical.push("Périmètre / processus audités");
  if (!data.scopeExclusions) warnings.push("Limites et exclusions non renseignées");
  if (!data.plannedAgenda || data.plannedAgenda.length === 0) warnings.push("Agenda prévu non renseigné");
  if (!data.actualAgenda || data.actualAgenda.length === 0) warnings.push("Agenda réalisé non renseigné");
  if (data.evidenceIndex.length === 0) warnings.push("Aucune preuve documentaire jointe");
  if (data.gapRegister.length > 0 && data.capaPlan.length === 0) warnings.push("Des écarts existent sans plan CAPA associé");

  const blocking = answeredQuestions === 0 ? ["Aucune réponse d'audit enregistrée"] : [];
  const completionPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const defaultNextSteps = data.gapRegister.length > 0
    ? `Formaliser, attribuer et suivre les actions associées aux ${data.gapRegister.length} écart(s) identifié(s), puis vérifier leur efficacité aux échéances convenues.`
    : "Maintenir la surveillance du système et planifier le prochain audit selon le programme d'audit approuvé.";

  return {
    answeredQuestions,
    totalQuestions,
    completionPercent,
    blocking,
    missingCritical,
    warnings,
    defaultConclusion: data.verdictPhrase,
    defaultNextSteps,
  };
}
