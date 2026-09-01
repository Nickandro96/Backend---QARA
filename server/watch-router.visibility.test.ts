import test from "node:test";
import assert from "node:assert/strict";
import { isWatchItemVisible, watchPriority } from "./watch-router";

const base = { aiAnalyzed: true, marketsImpacted: ["EU"], rolesImpacted: ["fabricant"], sourceRegistryId: "mdcg", criticality: "watch" as const, impactLevel: "High" };

test("un item ai_analyzed = false reste visible malgré un profil sans correspondance", () => {
  assert.equal(isWatchItemVisible({ ...base, aiAnalyzed: false, marketsImpacted: [], rolesImpacted: [] }, { marketsImpacted: ["US"], rolesImpacted: ["importateur"] }), true);
});

test("un item action_required reste toujours visible quel que soit le profil", () => {
  assert.equal(isWatchItemVisible({ ...base, criticality: "action_required" }, { marketsImpacted: ["US"], rolesImpacted: ["importateur"], sourceIds: ["fda"] }), true);
});

test("le filtre action requise exclut les autres criticités", () => {
  assert.equal(isWatchItemVisible(base, { actionRequiredOnly: true }), false);
});

test("le tri pertinent place action_required puis les analyses en attente", () => {
  assert.ok(
    watchPriority({ ...base, criticality: "action_required" }) <
      watchPriority({ ...base, aiAnalyzed: false }) &&
      watchPriority({ ...base, aiAnalyzed: false }) < watchPriority({ ...base, impactLevel: "High" }),
  );
});
