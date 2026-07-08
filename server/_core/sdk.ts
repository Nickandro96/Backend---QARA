/**
 * Session SDK — signed JWT session tokens (HS256 via `jose`).
 *
 * Replaces the previous `dummy-token-<openId>` scheme, which was an
 * unsigned, forgeable token: anyone could authenticate as any user
 * (including admins) simply by knowing/guessing their openId.
 *
 * Requires SESSION_JWT_SECRET (>=16 chars) in production. In non-production
 * environments, falls back to an insecure fixed dev secret so local dev
 * keeps working without extra setup.
 */

import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year — aligned with ONE_YEAR_MS cookie maxAge

function loadSecret(): Uint8Array {
  const secret = process.env.SESSION_JWT_SECRET;
  if (secret && secret.trim().length >= 16) {
    return encoder.encode(secret.trim());
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_JWT_SECRET must be set (>=16 characters) in production. Refusing to start with an insecure default."
    );
  }
  console.warn(
    "[sdk] SESSION_JWT_SECRET not set — using an insecure development-only fallback secret. Set it before deploying."
  );
  return encoder.encode("dev-only-insecure-secret-change-me-32c");
}

// Evaluated at module load so a missing secret fails fast at server startup in production.
const SECRET = loadSecret();

export const sdk = {
  createSessionToken: async (openId: string, _data: any) => {
    return await new SignJWT({ sub: openId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
      .sign(SECRET);
  },

  /**
   * Returns the openId (JWT `sub` claim) if the token is valid and unexpired, otherwise null.
   */
  verifySessionToken: async (token: string) => {
    if (!token || typeof token !== "string") return null;
    try {
      const { payload } = await jwtVerify(token, SECRET);
      return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
      return null;
    }
  },
};
