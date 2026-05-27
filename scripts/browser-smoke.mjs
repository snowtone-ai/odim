import { spawn } from "node:child_process";

const port = Number(process.env.BROWSER_SMOKE_PORT || "3010");
const baseUrl = `http://127.0.0.1:${port}`;
const routes = ["/", "/map", "/entity", "/alerts", "/huginn", "/settings"];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempts = 30) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await wait(1000);
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function startServer() {
  const child = spawn("pnpm", ["start", "--", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  return child;
}

const child = startServer();
let finished = false;

async function shutdown(code) {
  if (finished) return;
  finished = true;
  if (!child.killed) child.kill("SIGTERM");
  await wait(500);
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));

try {
  for (const route of routes) {
    const response = await fetchWithRetry(`${baseUrl}${route}`);
    const html = await response.text();
    if (!html.includes("<html")) {
      throw new Error(`Route ${route} did not return HTML`);
    }
    console.log(JSON.stringify({ route, status: response.status, length: html.length }));
  }
  await shutdown(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
}
