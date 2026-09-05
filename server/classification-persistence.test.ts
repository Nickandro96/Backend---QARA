import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.NODE_ENV = "test";

import { appRouter } from "./routers";
import { __setDbForTests } from "./db";

type Write = { kind: string; values?: any };

function fakeDb(selectResults: any[][] = [], insertIds: number[] = [41]) {
  const queue = [...selectResults];
  const ids = [...insertIds];
  const writes: Write[] = [];
  const chain = (kind: string): any => {
    const state: Write = { kind };
    const proxy: any = new Proxy({}, {
      get(_target, property) {
        if (property === "then") {
          const value = kind === "select" ? (queue.shift() ?? []) : [{ insertId: ids.shift() ?? 41 }];
          return (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject);
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
  };
  return { db, writes };
}

function caller(userId = 1) {
  return appRouter.createCaller({
    user: { id: userId, role: "user", subscriptionTier: "pro", subscriptionStatus: "active" },
    req: { headers: {} }, res: {},
  } as any);
}

const answers = { device_name: "Pompe test", device_type: "dm" as const, is_active: true, is_software: false };
const session = (status: "draft" | "completed", userId = 1) => ({
  id: 7, userId, tenantId: null, sourceSessionId: null, jurisdiction: "MDR", sessionName: "Pompe test",
  status, rulesetVersion: "MDR-2026.09", answersJson: answers,
  resultJson: status === "completed" ? { resultingClass: "IIa" } : null, deletedAt: null,
});

afterEach(() => __setDbForTests(null));

test("classification: création d'un brouillon traçable", async () => {
  const f = fakeDb([], [51]); __setDbForTests(f.db);
  assert.deepEqual(await caller().classification.saveDraft({ answers }), { sessionId: 51, status: "draft" });
  assert.equal(f.writes[0].values.rulesetVersion, "MDR-2026.09");
  assert.deepEqual(f.writes[0].values.answersJson, answers);
});

test("classification: une décision terminée reste immuable", async () => {
  const f = fakeDb([[session("completed")]]); __setDbForTests(f.db);
  await assert.rejects(caller().classification.saveDraft({ sessionId: 7, answers }), (error: any) => error?.code === "CONFLICT");
  assert.equal(f.writes.length, 0);
});

test("classification: un utilisateur ne peut pas accéder à une session étrangère", async () => {
  const f = fakeDb([[]]); __setDbForTests(f.db);
  await assert.rejects(caller(2).classification.get({ sessionId: 7 }), (error: any) => error?.code === "NOT_FOUND");
  assert.equal(f.writes.length, 0);
});

test("classification: réviser clone les réponses sans écraser la décision source", async () => {
  const f = fakeDb([[session("completed")]], [52]); __setDbForTests(f.db);
  assert.deepEqual(await caller().classification.revise({ sessionId: 7 }), { sessionId: 52, status: "draft", sourceSessionId: 7 });
  assert.equal(f.writes[0].values.sourceSessionId, 7);
  assert.equal(f.writes[0].values.resultJson, null);
  assert.deepEqual(f.writes[0].values.answersJson, answers);
});

test("classification: seule la suppression logique d'un brouillon est permise", async () => {
  let f = fakeDb([[session("draft")]]); __setDbForTests(f.db);
  assert.deepEqual(await caller().classification.deleteDraft({ sessionId: 7 }), { success: true });
  assert.ok(f.writes[0].values.deletedAt instanceof Date);

  f = fakeDb([[session("completed")]]); __setDbForTests(f.db);
  await assert.rejects(caller().classification.deleteDraft({ sessionId: 7 }), (error: any) => error?.code === "CONFLICT");
  assert.equal(f.writes.length, 0);
});
