/**
 * Railway release entrypoint.
 * Railway redeploy trigger after a transient registry failure (no runtime effect).
 *
 * SQL migrations keep the historical deployment behavior. Corpus import is
 * deliberately opt-in because it rewrites production question content from
 * scripts/questions_import_ready.json.
 *
 * To run it for an approved corpus release, set IMPORT_CORPUS_ON_RELEASE=1
 * for that deployment only, then remove/reset the variable afterwards.
 */
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
run(npx, ["tsx", "scripts/apply-sql-migrations.ts"]);

if (process.env.IMPORT_CORPUS_ON_RELEASE === "1") {
  console.log("[release] IMPORT_CORPUS_ON_RELEASE=1 — importing the approved corpus.");
  run(npx, ["tsx", "scripts/import-corpus.mjs"]);
} else {
  console.log("[release] Corpus import skipped (explicit approval flag not set).");
}
