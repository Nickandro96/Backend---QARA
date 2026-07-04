/**
 * Export CSV — Lot 4 (§4 SPEC-3 : "Excel — les données brutes ... pour
 * retraitement"). Déviation documentée dans docs/audit/10-rapport-audit.md :
 * export CSV plutôt qu'un classeur .xlsx natif — aucune librairie xlsx
 * n'était déjà une dépendance du projet, et le CSV s'ouvre nativement dans
 * Excel/LibreOffice/Sheets, ce qui satisfait le besoin réel ("données brutes
 * pour retraitement") sans ajouter de dépendance binaire non validée.
 */

import type { Ecart } from "../scoring/types";
import type { CapaAction } from "../capa/types";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(";")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(";"));
  }
  return lines.join("\r\n");
}

/** Registre des écarts (§5 SPEC-3) : exigence, constat, gravité, criticité, référentiel. */
export function buildGapRegisterCsv(ecarts: Ecart[]): string {
  const headers = [
    "referentiel",
    "processus",
    "question",
    "gravite",
    "criticite",
    "reponse",
    "score_elementaire",
    "nc_typiques",
  ];
  const rows = ecarts.map((e) => [
    e.referentialCode,
    e.processName ?? "",
    e.questionKey,
    e.gravite,
    e.criticality,
    e.responseValue,
    e.elementaryScore,
    e.typicalNc.join(" | "),
  ]);
  return toCsv(headers, rows);
}

/** Plan d'action CAPA (§6 SPEC-3) : actions, responsables, échéances, statuts. */
export function buildActionPlanCsv(actions: CapaAction[]): string {
  const headers = [
    "id",
    "referentiel",
    "processus",
    "question",
    "gravite",
    "criticite",
    "ecart_identifie",
    "analyse_cause_racine",
    "action_recommandee",
    "action_retenue",
    "responsable",
    "echeance",
    "statut",
    "date_verification_efficacite",
    "resultat_efficacite",
  ];
  const rows = actions.map((a) => [
    a.id,
    a.referentialCode,
    a.processName ?? "",
    a.questionKey,
    a.gravite,
    a.criticality,
    a.ecartIdentifie,
    a.analyseCauseRacine ?? "",
    a.actionRecommandee,
    a.actionRetenue ?? "",
    a.responsible ?? "",
    a.dueDate ?? "",
    a.statut,
    a.dateVerificationEfficacite ?? "",
    a.resultatEfficacite ?? "",
  ]);
  return toCsv(headers, rows);
}
