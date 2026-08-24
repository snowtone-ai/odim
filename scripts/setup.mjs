import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const required = [
  "package.json",
  ".env.example",
  "scripts/verify.mjs",
  "CLAUDE.md",
  "AGENTS.md",
  ".codex/config.toml",
  ".github/workflows/ci.yml",
  "docs/issues.md"
];
for (const file of required) {
  if (!existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

try {
  execSync("node --version", { stdio: "inherit" });
} catch {
  throw new Error("Node.js is required before setup can continue.");
}

console.log("Setup preflight passed. Run `pnpm install` when registry access is available.");
