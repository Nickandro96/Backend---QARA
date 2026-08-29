import test from "node:test";
import assert from "node:assert/strict";
import { exponentialBackoffMs, parseRetryAfterMs, WATCH_USER_AGENT } from "../sources/_http";
import { isRefreshRunActive } from "../WatchStore";

test("retry policy honors Retry-After and exponential backoff", () => {
  assert.equal(parseRetryAfterMs("3"), 3000);
  assert.equal(exponentialBackoffMs(0), 250);
  assert.equal(exponentialBackoffMs(2), 1000);
  assert.match(WATCH_USER_AGENT, /QARA-Regulatory-Watch/);
});

test("distributed lock expires after thirty minutes", () => {
  const now = new Date("2026-08-29T12:00:00Z");
  assert.equal(isRefreshRunActive(new Date("2026-08-29T11:45:00Z"), null, now), true);
  assert.equal(isRefreshRunActive(new Date("2026-08-29T11:29:00Z"), null, now), false);
  assert.equal(isRefreshRunActive(new Date("2026-08-29T11:45:00Z"), now, now), false);
});
