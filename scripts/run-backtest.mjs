import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runBacktest } from "../lib/pipeline/backtest.ts";

function arg(name, fallback = "") {
  const direct = process.argv.find((entry) => entry.startsWith(`${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? fallback;
  return fallback;
}

const startDate = arg("--start", "2026-01-01");
const endDate = arg("--end", new Date().toISOString().slice(0, 10));
const sources = arg("--sources", "").split(",").map((item) => item.trim()).filter(Boolean);

const result = runBacktest({
  startDate,
  endDate,
  sources,
  metric: "score"
});

const outDir = join(process.cwd(), "artifacts");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `backtest-${startDate}-${endDate}.json`);
writeFileSync(outFile, JSON.stringify(result, null, 2));

console.log(JSON.stringify({ startDate, endDate, outFile, result }, null, 2));
