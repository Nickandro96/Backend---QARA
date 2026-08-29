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

  if (!data.organisationName) missingCritical.push("Organisation audit\u00e9e");
  if (!data.auditNature) missingCritical.push("Nature de l'audit");
  if (!data.startDate || !data.endDate) missingCritical.push("Dates de d\u00e9but et de fin");
  if (data.auditTeam.length === 0) missingCritical.push("\u00c9quipe d'audit");
  if (data.auditeesRepresentatives.length === 0) missingCritical.push("Repr\u00e9sentants de l'audit\u00e9");
  if (data.processScope.length === 0) missingCritical.push("P\u00e9rim\u00e8tre / processus audit\u00e9s");
  if (!data.scopeExclusions) warnings.push("Limites et exclusions non renseign\u00e9es");
  if (!data.plannedAgenda || data.plannedAgenda.length === 0) warnings.push("Agenda pr\u00e9vu non renseign\u00e9");
  if (!data.actualAgenda || data.actualAgenda.length === 0) warnings.push("Agenda r\u00e9alis\u00e9 non renseign\u00e9");
  if (data.evidenceIndex.length === 0) warnings.push("Aucune preuve documentaire jointe");
  if (data.gapRegister.length > 0 && data.capaPlan.length === 0) warnings.push("Des \u00e9carts existent sans plan CAPA associ\u00e9");

  const blocking = answeredQuestions === 0 ? ["Aucune r\u00e9ponse d'audit enregistr\u00e9e"] : [];
  const completionPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const defaultNextSteps = data.gapRegister.length > 0
    ? `Formaliser, attribuer et suivre les actions associ\u00e9es aux ${data.gapRegister.length} \u00e9cart(s) identifi\u00e9(s), puis v\u00e9rifier leur efficacit\u00e9 aux \u00e9ch\u00e9ances convenues.`
    : "Maintenir la surveillance du syst\u00e8me et planifier le prochain audit selon le programme d'audit approuv\u00e9.";

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
