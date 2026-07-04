/**
 * One-shot CLI to grant the admin role to an already-registered user.
 *
 * Replaces the previous bootstrap mechanisms (`system.devLogin`, and the
 * hardcoded backdoor in `system.login`) which let anyone create/promote an
 * admin account over HTTP with no authentication — see docs/audit/02-audit-
 * technique.md, C-05. This script only runs server-side via the CLI
 * (Railway shell / local terminal with DATABASE_URL set), never over HTTP.
 *
 * Usage:
 *   DATABASE_URL=mysql://... npx tsx scripts/promote-admin.ts user@example.com
 *
 * The user must already have registered a normal account first.
 */

import { getUserByEmail, updateUserRole } from "../server/db";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/promote-admin.ts <email>");
    process.exit(1);
  }

  const user = await getUserByEmail(email);
  if (!user) {
    console.error(`No user found with email: ${email}. They must register first.`);
    process.exit(1);
  }

  await updateUserRole(user.id, "admin");
  console.log(`✅ ${email} (user id ${user.id}) is now an admin.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
