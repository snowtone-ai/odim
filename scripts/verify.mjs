import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "HANDOFF-JA.md",
  "docs/vision.md",
  "tasks.md",
  "docs/state.md",
  "docs/decisions.md",
  "docs/issues.md",
  "docs/repo-map.md",
  "scripts/setup.mjs",
  "scripts/verify.mjs",
  ".env.example",
  ".gitignore",
  "package.json",
  "app/layout.tsx",
  "app/(dashboard)/map/page.tsx",
  "app/(dashboard)/capital-flow/page.tsx",
  "app/(dashboard)/entity/page.tsx",
  "app/(dashboard)/alerts/page.tsx",
  "app/(dashboard)/huginn/page.tsx",
  "app/(dashboard)/watchlist/page.tsx",
  "app/(dashboard)/audit/page.tsx",
  "app/(dashboard)/settings/page.tsx",
  "styles/tokens.css",
  "supabase/migrations/0001_initial.sql",
  "config/sources.json"
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) throw new Error(`Missing required files:\n${missing.join("\n")}`);

const tokens = readFileSync("styles/tokens.css", "utf8");
for (const token of ["--ink-900", "--rune", "--layer-energy", "--ease-odim"]) {
  if (!tokens.includes(token)) throw new Error(`Missing design token: ${token}`);
}

const tasks = readFileSync("tasks.md", "utf8");
for (const field of ["Owner", "Depends On", "Write Scope", "Acceptance", "Verification", "Evidence"]) {
  if (!tasks.includes(field)) throw new Error(`tasks.md missing ready-task field: ${field}`);
}

const env = readFileSync(".env.example", "utf8");
for (const key of ["AI_PROVIDER", "AI_MODEL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  if (!env.includes(key)) throw new Error(`.env.example missing ${key}`);
}

console.log("verify: structural checks passed");
