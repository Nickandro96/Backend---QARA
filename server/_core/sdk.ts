import { SignJWT, jwtVerify } from "jose";

/**
 * Session SDK backed by signed JWTs (HS256).
 *
 * Replaces the previous `dummy-token-<openId>` scheme, which was an
 * unsigned string that anyone could forge just by knowing a user's openId
 * (itself derived deterministically from their email for password
 * accounts) — see docs/audit/02-audit-technique.md, C-04.
 *
 * JWT_SECRET must be set in production (Railway env var). In non-production
 * environments a fixed insecure fallback is used so local development still
 * works without extra setup, but sessions signed with it must never be
 * trusted outside of dev/test.
 */

const SESSION_TTL = "30d";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET is required in production. Set it in the Railway service's environment variables."
      );
    }
    return new TextEncoder().encode("dev-only-insecure-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(secret);
}

export const sdk = {
  createSessionToken: async (openId: string, data: Record<string, unknown> = {}) => {
    return await new SignJWT({ ...data, openId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(SESSION_TTL)
      .sign(getSecretKey());
  },

  /**
   * Returns the openId encoded in the token if it is a validly signed,
   * non-expired session JWT, otherwise null.
   */
  verifySessionToken: async (token: string) => {
    if (!token || typeof token !== "string") return null;
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      return typeof payload.openId === "string" && payload.openId ? payload.openId : null;
    } catch {
      return null;
    }
  },
};
