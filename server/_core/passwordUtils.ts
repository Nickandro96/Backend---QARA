import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * Was previously the identity function (plaintext storage, plaintext
 * comparison) — see docs/audit/02-audit-technique.md, C-03.
 *
 * `verifyPassword` still accepts a legacy plaintext hash (any stored value
 * that isn't a bcrypt hash) so that accounts created before this fix aren't
 * locked out — there is no "forgot password" flow yet (see 03-tests-
 * fonctionnels.md, §1) so silently invalidating existing passwords would
 * strand those users. On a successful legacy-plaintext login, the caller
 * (systemRouter.login) re-hashes and stores the password with bcrypt, so
 * every account converges to a real hash the first time its owner logs in
 * after this change ships.
 */

const BCRYPT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  // Legacy plaintext hash, pre-dating this fix.
  return password === hash;
};
