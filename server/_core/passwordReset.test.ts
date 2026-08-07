Exit code: 0
Wall time: 1.9 seconds
Output:
import assert from "node:assert/strict";
import test from "node:test";
import { createResetToken, hashResetToken } from "./passwordReset";

test("password reset tokens are random, hashed and expire in about 30 minutes", () => {
  const before = Date.now();
  const first = createResetToken();
  const second = createResetToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashResetToken(first.token));
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.ok(first.expiresAt.getTime() >= before + 29 * 60 * 1000);
  assert.ok(first.expiresAt.getTime() <= before + 31 * 60 * 1000);
});

