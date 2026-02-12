/**
 * Minimal session SDK.
 *
 * The app currently uses a lightweight session token (no JWT yet):
 *   token = `dummy-token-<openId>`
 *
 * This is sufficient to unblock authentication during development and
 * early deployment on Railway/Vercel.
 *
 * ⚠️ Security note:
 * This is NOT a secure production-grade authentication mechanism.
 * Replace with signed JWT (jose) or a proper session store as soon as possible.
 */

const TOKEN_PREFIX = "dummy-token-";

export const sdk = {
  createSessionToken: async (openId: string, _data: any) => {
    return `${TOKEN_PREFIX}${openId}`;
  },

  /**
   * Returns the openId if the token matches the expected format, otherwise null.
   */
  verifySessionToken: async (token: string) => {
    if (!token || typeof token !== "string") return null;
    if (!token.startsWith(TOKEN_PREFIX)) return null;
    const openId = token.slice(TOKEN_PREFIX.length).trim();
    return openId ? openId : null;
  },
};
