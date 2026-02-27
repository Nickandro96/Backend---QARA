import test from "node:test";
import assert from "node:assert/strict";
import { appRouter } from "../../../routers";

test("watch.updates returns meta + items array (even when empty)", async () => {
  const caller = appRouter.createCaller({
    // minimal ctx shape
    req: { headers: {} } as any,
    res: {} as any,
    user: { id: 1, role: "admin" },
  });

  const res = await caller.watch.updates({ limit: 5, offset: 0, includeDetails: true });
  assert.ok(res);
  assert.ok(Array.isArray(res.items));
  assert.ok(res.meta);
  assert.ok(typeof res.meta.stale === "boolean");
});
