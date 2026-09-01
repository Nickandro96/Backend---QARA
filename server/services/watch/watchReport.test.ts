import test from "node:test";
import assert from "node:assert/strict";
import { orderWatchReportItems } from "./watchReport";

test("le rapport place obligatoirement les actions requises en premier", () => {
  const items = [
    { id: "i", analysisCriticality: "informational", impactLevel: "Low" },
    { id: "a", analysisCriticality: "action_required", impactLevel: "High" },
    { id: "w", analysisCriticality: "watch", impactLevel: "Medium" },
  ] as any;
  assert.deepEqual(orderWatchReportItems(items).map((item) => item.id), ["a", "w", "i"]);
});
