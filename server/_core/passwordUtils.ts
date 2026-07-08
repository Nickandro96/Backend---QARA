/**
 * Password hashing — scrypt (Node built-in `crypto`, no extra dependency).
 *
 * Replaces the previous identity-function "hash" (passwords were stored
 * and compared in plaintext). Hashes are stored as `scrypt:<saltHex>:<keyHex>`.
 *
 * Legacy plaintext hashes (created before this fix) are still verifiable via
 * a direct-comparison fallback so existing users are not locked out; callers
 * should rehash with `hashPassword` immediately after a successful legacy
 * verification (see systemRouter.login) to upgrade storage transparently.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}:${salt}:${derived}`;
};

export const isLegacyHash = (hash: string | null | undefined): boolean => {
  return !!hash && !hash.startsWith(`${SCRYPT_PREFIX}:`);
};

export const verifyPassword = (password: string, hash: string): boolean => {
  if (!hash) return false;

  if (hash.startsWith(`${SCRYPT_PREFIX}:`)) {
    const [, salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derived = scryptSync(password, salt, keyBuffer.length);
    return keyBuffer.length === derived.length && timingSafeEqual(keyBuffer, derived);
  }

  // Legacy plaintext fallback for accounts created before this fix.
  return password === hash;
};
