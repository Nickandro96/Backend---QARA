/**
 * One-shot LOCAL tool to generate a bcrypt password hash in the exact
 * format expected by the currently-deployed backend
 * (server/_core/passwordUtils.ts on claude/qara-compliance-audit-qitbxl:
 * bcryptjs, 12 rounds, hash matching /^\$2[aby]\$/).
 *
 * Does NOT connect to any database and does NOT read the password from
 * argv/env — it prompts interactively so the password never appears in
 * shell history, process list, or any chat/log. Only the resulting hash
 * is printed; use it in the manual UPDATE query (see
 * PROCEDURE-reparation-admin.md), which you run yourself.
 *
 * Usage:
 *   npx tsx scripts/generate-bcrypt-admin-hash.ts
 */

import bcrypt from "bcryptjs";
import * as readline from "node:readline/promises";

const BCRYPT_ROUNDS = 12; // must match server/_core/passwordUtils.ts on qitbxl

async function promptHidden(rl: readline.Interface, question: string): Promise<string> {
  const output = rl as unknown as { _writeToOutput?: (s: string) => void };
  output._writeToOutput = function (stringToWrite: string) {
    if (stringToWrite.trim() === question.trim() || stringToWrite === "\n" || stringToWrite === "\r\n") {
      (rl as any).output.write(stringToWrite);
    } else {
      (rl as any).output.write("*");
    }
  };

  const answer = await rl.question(question);
  process.stdout.write("\n");
  return answer;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const password = await promptHidden(rl, "Nouveau mot de passe admin (saisie masquée) : ");
  rl.close();

  if (password.length < 8) {
    console.error("\n❌ Mot de passe trop court (minimum 8 caractères). Rien généré.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  console.log("\n✅ Hash bcrypt généré (12 rounds, format $2b$) :\n");
  console.log(hash);
  console.log("\nCopiez cette valeur telle quelle dans la requête UPDATE de PROCEDURE-reparation-admin.md.");
  console.log("Le mot de passe en clair n'a été ni stocké ni affiché.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
