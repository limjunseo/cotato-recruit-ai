import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const steps = [
  "sync-rds-applications.mjs",
  "sync-rds-questions.mjs",
  "sync-rds-answers.mjs",
];

function runStep(scriptName) {
  const scriptPath = path.join(scriptDir, scriptName);
  console.info("[rds-sync] step started", { script: scriptName });
  execFileSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });
  console.info("[rds-sync] step completed", { script: scriptName });
}

function main() {
  for (const step of steps) {
    runStep(step);
  }
}

try {
  main();
} catch (error) {
  console.error("[rds-sync] failed", error);
  process.exitCode = 1;
}
