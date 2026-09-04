import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.NODE_ENV = "test";

import { appRouter } from "./routers";
import { __setDbForTests } from "./db";

type Write = { kind: string; values?: any };

function fakeDb(selectResults: any[][] = []) {
  const queue = [...selectResults];
  const writes: Write[] = [];
  const chain = (kind: string): any => {
    const state: Write = { kind };
    const proxy: any = new Proxy({}, {
      get(_target, property) {
        if (property === "then") {
          return (resolve: any, reject: any) => Promise.resolve(kind === "select" ? (queue.shift() ?? []) : [{ insertId: 1 }]).then(resolve, reject);
        }
        return (...args: any[]) => {
          if (property === "set" || property === "values") state.values = args[0];
          if ((property === "set" || property === "values") && !writes.includes(state)) writes.push(state);
          return proxy;
        };
      },
    });
    return proxy;
  };
  const db: any = {
    select: () => chain("select"),
    insert: () => chain("insert"),
    update: () => chain("update"),
    delete: () => chain("delete"),
    execute: async () => [[{ cnt: 0 }]],
    transaction: async (callback: any) => callback(db),
  };
  return { db, writes, remaining: () => queue.length };
}

function caller(userId = 1) {
  return appRouter.createCaller({ user: { id: userId, role: "user", subscriptionTier: "pro", subscriptionStatus: "active" }, req: { headers: {} }, res: {} } as any);
}

const audit = (status = "in_progress") => ({
  id: 10, userId: 1, status, economicRole: "fabricant", economicRoles: [], situationTags: [], processIds: [7], referentialIds: [1], siteId: null,
});
const question = { id: 20, questionKey: "Q-1", processId: 7, isActive: true };
const response = { questionKey: "Q-1", responseValue: "compliant" };
const saveInput = (processId: number | string | null = 7) => ({ auditId: 10, questionKey: "Q-1", responseValue: "compliant" as const, processId });
const rejectsCode = (code: string) => (error: any) => error?.code === code;

afterEach(() => __setDbForTests(null));

test("01 procédure générique : le propriétaire sauvegarde une réponse en cours", async () => {
  const f = fakeDb([[audit()], [question], []]); __setDbForTests(f.db);
  assert.deepEqual(await caller().audit.saveResponse(saveInput(7)), { success: true, mode: "created" });
  assert.equal(f.writes.at(-1)?.values.questionKey, "Q-1");
});

test("02 procédure générique : processId number, string et null restent compatibles", async () => {
  for (const value of [7, "7", null] as const) {
    const f = fakeDb([[audit()], [question], []]); __setDbForTests(f.db);
    await caller().audit.saveResponse(saveInput(value));
    assert.equal(f.writes.at(-1)?.values.processId, 7);
  }
  for (const value of ["abc", 8] as const) {
    const f = fakeDb([[audit()], [question]]); __setDbForTests(f.db);
    await assert.rejects(caller().audit.saveResponse(saveInput(value)), rejectsCode("BAD_REQUEST"));
    assert.equal(f.writes.length, 0);
  }
});

test("03 utilisateur étranger : la procédure publique répond NOT_FOUND sans écrire", async () => {
  const f = fakeDb([[]]); __setDbForTests(f.db);
  await assert.rejects(caller(2).audit.saveResponse(saveInput()), rejectsCode("NOT_FOUND"));
  assert.equal(f.writes.length, 0);
});

test("04 audit inexistant : sauvegarde, mise à jour, clôture et réouverture sont refusées", async () => {
  for (const invoke of [
    () => caller().audit.saveResponse(saveInput()),
    () => caller().audits.update({ id: 10, name: "Audit test" }),
    () => caller().audit.completeAudit({ auditId: 10 }),
    () => caller().audit.reopen({ auditId: 10, reason: "Correction" }),
  ]) { const f = fakeDb([[]]); __setDbForTests(f.db); await assert.rejects(invoke(), rejectsCode("NOT_FOUND")); assert.equal(f.writes.length, 0); }
});

test("05 question inexistante : aucune réponse n’est créée", async () => {
  const f = fakeDb([[audit()], []]); __setDbForTests(f.db);
  await assert.rejects(caller().audit.saveResponse(saveInput()), rejectsCode("BAD_REQUEST"));
  assert.equal(f.writes.length, 0);
});

test("06 question existante mais hors questionnaire : écriture refusée", async () => {
  const f = fakeDb([[audit()], [{ ...question, questionKey: "Q-AUTRE" }]]); __setDbForTests(f.db);
  await assert.rejects(caller().audit.saveResponse(saveInput()), rejectsCode("BAD_REQUEST"));
  assert.equal(f.writes.length, 0);
});

test("07 completed et closed protègent réponse, audit, métadonnées, périmètre et suppression", async () => {
  for (const status of ["completed", "closed"] as const) for (const invoke of [
    () => caller().audit.saveResponse(saveInput()),
    () => caller().audits.update({ id: 10, name: "Audit test" }),
    () => caller().audits.updateMetadata({ id: 10, notes: "x" }),
    () => caller().audit.updateReportFields({ id: 10, scopeExclusions: "x" }),
    () => caller().audits.delete({ id: 10 }),
  ]) { const f = fakeDb([[audit(status)]]); __setDbForTests(f.db); await assert.rejects(invoke(), rejectsCode("CONFLICT")); assert.equal(f.writes.length, 0); }
});

test("08 clôture valide : statut completed et date de fin sont écrits", async () => {
  const f = fakeDb([[audit()], [question], [response]]); __setDbForTests(f.db);
  assert.deepEqual(await caller().audit.completeAudit({ auditId: 10 }), { success: true });
  assert.equal(f.writes[0].values.status, "completed"); assert.ok(f.writes[0].values.endDate instanceof Date);
});

test("09 audit incomplet : clôture refusée et statut intact", async () => {
  const f = fakeDb([[audit()], [question, { questionKey: "Q-2", processId: 7 }], [response]]); __setDbForTests(f.db);
  await assert.rejects(caller().audit.completeAudit({ auditId: 10 }), (e: any) => e?.code === "PRECONDITION_FAILED" && /1\/2/.test(e.message));
  assert.equal(f.writes.length, 0);
});

test("10 audit vide : clôture refusée sans écriture", async () => {
  const f = fakeDb([[audit()], [question], []]); __setDbForTests(f.db);
  await assert.rejects(caller().audit.completeAudit({ auditId: 10 }), rejectsCode("PRECONDITION_FAILED")); assert.equal(f.writes.length, 0);
});

test("11 double clôture : erreur métier stable, date et score non modifiés", async () => {
  const f = fakeDb([[audit("completed")]]); __setDbForTests(f.db);
  await assert.rejects(caller().audit.completeAudit({ auditId: 10 }), rejectsCode("CONFLICT")); assert.equal(f.writes.length, 0);
});

test("12 lecture après clôture : détail et réponses restent accessibles sans écriture", async () => {
  let f = fakeDb([[{ ...audit("completed"), referentialIds: [] }]]); __setDbForTests(f.db);
  assert.equal((await caller().audit.getById({ id: 10 })).status, "completed"); assert.equal(f.writes.length, 0);
  f = fakeDb([[audit("closed")], [response]]); __setDbForTests(f.db);
  assert.equal((await caller().audit.getResponses({ auditId: 10 })).length, 1); assert.equal(f.writes.length, 0);
});

test("13 rapport existant d’un audit clôturé : lecture propriétaire permise, étranger refusé", async () => {
  let f = fakeDb([[{ id: 3, auditId: 10, status: "final", reportUrl: null }]]); __setDbForTests(f.db);
  assert.equal((await caller().reports.get({ reportId: 3 })).auditId, 10);
  f = fakeDb([[]]); __setDbForTests(f.db); await assert.rejects(caller(2).reports.get({ reportId: 3 }), rejectsCode("NOT_FOUND"));
});

test("14 CAPA après clôture : consultation permise sans toucher audit ou réponse", async () => {
  const now = new Date(); const capa = { id: 4, auditId: 10, userId: 1, questionKey: "Q-1", referentialCode: "MDR", processName: null, gravite: "mineur", criticality: "medium", ecartIdentifie: "Écart", analyseCauseRacine: null, actionRecommandee: "Corriger", actionRetenue: null, responsible: null, dueDate: null, statut: "ouverte", preuveRealisation: null, dateVerificationEfficacite: null, preuveEfficacite: null, resultatEfficacite: null, referentielsImpactes: [], createdAt: now, updatedAt: now };
  const f = fakeDb([[audit("completed")], [capa], []]); __setDbForTests(f.db);
  const rows = await caller().capa.list({ auditId: 10 }); assert.equal(rows.length, 1); assert.equal(f.writes.length, 0);
});

test("15 réouverture : motif et propriété requis, closed refusé, données non effacées", async () => {
  let f = fakeDb([[audit("completed")]]); __setDbForTests(f.db); await assert.rejects(caller().audit.reopen({ auditId: 10 }), rejectsCode("BAD_REQUEST"));
  f = fakeDb([[audit("completed")]]); __setDbForTests(f.db); await caller().audit.reopen({ auditId: 10, reason: "Correction documentée" }); assert.deepEqual(Object.keys(f.writes[0].values).sort(), ["status", "updatedAt"].sort());
  f = fakeDb([[]]); __setDbForTests(f.db); await assert.rejects(caller(2).audit.reopen({ auditId: 10, reason: "Correction" }), rejectsCode("NOT_FOUND"));
  f = fakeDb([[audit("closed")]]); __setDbForTests(f.db); await assert.rejects(caller().audit.reopen({ auditId: 10, reason: "Correction" }), rejectsCode("FORBIDDEN"));
});

test("16 MDR public : démarrage, réponse, clôture et protection post-clôture", async () => {
  let f = fakeDb([[audit("draft")]]); __setDbForTests(f.db); await caller().audits.start({ id: 10 }); assert.equal(f.writes[0].values.status, "in_progress");
  f = fakeDb([[audit()], [question], []]); __setDbForTests(f.db); await caller().mdr.saveResponse(saveInput()); assert.equal(f.writes.at(-1)?.values.questionKey, "Q-1");
  f = fakeDb([[audit()], [question], [response]]); __setDbForTests(f.db); await caller().mdr.completeAudit({ auditId: 10 }); assert.equal(f.writes[0].values.status, "completed");
  f = fakeDb([[audit("completed")]]); __setDbForTests(f.db); await assert.rejects(caller().mdr.saveResponse(saveInput()), rejectsCode("CONFLICT"));
});

test("17 ISO public : propriétaire, réponse, clôture et protection post-clôture", async () => {
  let f = fakeDb([[audit()], [question], [audit()], [question]]); __setDbForTests(f.db); await caller().iso.saveResponse(saveInput()); assert.equal(f.writes[0].values.questionKey, "Q-1");
  f = fakeDb([[]]); __setDbForTests(f.db); await assert.rejects(caller(2).iso.saveResponse(saveInput()), rejectsCode("NOT_FOUND"));
  f = fakeDb([[audit()], [question], [response]]); __setDbForTests(f.db); await caller().iso.completeAudit({ auditId: 10 }); assert.equal(f.writes[0].values.status, "completed");
  f = fakeDb([[audit("completed")]]); __setDbForTests(f.db); await assert.rejects(caller().iso.saveResponse(saveInput()), rejectsCode("CONFLICT"));
});

test("18 audit générique public : mise à jour, clôture, protection puis lecture", async () => {
  let f = fakeDb([[audit()]]); __setDbForTests(f.db); await caller().audits.update({ id: 10, name: "Audit modifié" }); assert.equal(f.writes.length, 1);
  f = fakeDb([[audit()], [question], [response]]); __setDbForTests(f.db); await caller().audit.completeAudit({ auditId: 10 }); assert.equal(f.writes[0].values.status, "completed");
  f = fakeDb([[audit("completed")]]); __setDbForTests(f.db); await assert.rejects(caller().audits.update({ id: 10, name: "Interdit" }), rejectsCode("CONFLICT"));
  f = fakeDb([[{ ...audit("completed"), referentialIds: [] }]]); __setDbForTests(f.db); assert.equal((await caller().audit.getById({ id: 10 })).status, "completed");
});
