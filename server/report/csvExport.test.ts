import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGapRegisterCsv, buildActionPlanCsv } from "./csvExport";
import type { Ecart } from "../scoring/types";
import type { CapaAction } from "../capa/types";

test("buildGapRegisterCsv : en-tête + une ligne par écart", () => {
  const ecarts: Ecart[] = [
    { questionKey: "Q-1", referentialCode: "MDR", processName: "SMQ", gravite: "majeur", criticality: "critical", responseValue: "non_compliant", elementaryScore: 0, typicalNc: ["NC1", "NC2"] },
  ];
  const csv = buildGapRegisterCsv(ecarts);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^referentiel;/);
  assert.match(lines[1], /^MDR;SMQ;Q-1;majeur;critical;non_compliant;0;NC1 \| NC2$/);
});

test("buildGapRegisterCsv : échappe les champs contenant un séparateur", () => {
  const ecarts: Ecart[] = [
    { questionKey: "Q-1", referentialCode: "MDR", processName: "A; B", gravite: "mineur", criticality: "low", responseValue: "partial", elementaryScore: 0.5, typicalNc: [] },
  ];
  const csv = buildGapRegisterCsv(ecarts);
  assert.match(csv, /"A; B"/);
});

test("buildActionPlanCsv : en-tête + une ligne par action", () => {
  const actions: CapaAction[] = [
    {
      id: 1,
      auditId: 10,
      questionKey: "Q-1",
      referentialCode: "MDR",
      processName: "SMQ",
      gravite: "majeur",
      criticality: "critical",
      ecartIdentifie: "constat",
      analyseCauseRacine: null,
      actionRecommandee: "action",
      actionRetenue: null,
      responsible: "Marie Dupont",
      dueDate: null,
      statut: "ouverte",
      preuveRealisation: null,
      dateVerificationEfficacite: null,
      preuveEfficacite: null,
      resultatEfficacite: null,
      rootCauseMethod: null,
      mdsapGrade: null,
      mdsapEscalation: null,
      referentielsImpactes: [],
      priorite: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const csv = buildActionPlanCsv(actions);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^id;referentiel;/);
  assert.match(lines[1], /Marie Dupont/);
});
