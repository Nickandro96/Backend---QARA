import test from "node:test";
import assert from "node:assert/strict";
import { orderWatchReportItems } from "./watchReport";

test("le rapport place obligatoirement les actions requises en premier", () => {
  const items = [
    { id: "i", criticality: "informational", impactLevel: "Low" },
    { id: "a", criticality: "action_required", impactLevel: "High" },
    { id: "w", criticality: "watch", impactLevel: "Medium" },
  ] as any;
  assert.deepEqual(orderWatchReportItems(items).map((item) => item.id), ["a", "w", "i"]);
});
