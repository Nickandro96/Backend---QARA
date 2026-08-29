import { accessSync, constants, statSync } from "node:fs";

const requiredArtifacts = ["dist/index.js", "dist/watchWorker.js"];
for (const artifact of requiredArtifacts) {
  accessSync(artifact, constants.R_OK);
  if (statSync(artifact).size === 0) throw new Error(`[build] Empty artifact: ${artifact}`);
}
console.log(`[build] Verified artifacts: ${requiredArtifacts.join(", ")}`);
