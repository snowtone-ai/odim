import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "lib", "scrapers", "scripts", "tests"];
const extensions = new Set([".ts", ".tsx", ".mjs"]);
const failures = [];

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!extensions.has(extensionOf(path))) continue;
    const content = readFileSync(path, "utf8");
    if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) failures.push(`${path}: contains merge conflict marker`);
    if (/[ \t]$/m.test(content)) failures.push(`${path}: contains trailing whitespace`);
  }
}

for (const root of roots) walk(root);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
