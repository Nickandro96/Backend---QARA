import assert from "node:assert/strict";
import test from "node:test";
import { getSessionCookieOptions } from "./cookies";

test("production session cookie is secure, httpOnly and same-origin compatible", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const options = getSessionCookieOptions({});
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "lax");
    assert.equal("domain" in options, false);
  } finally {
    process.env.NODE_ENV = previous;
  }
});
