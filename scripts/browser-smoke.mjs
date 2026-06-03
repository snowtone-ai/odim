import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = Number(process.env.BROWSER_SMOKE_PORT || "3010");
const baseUrl = `http://127.0.0.1:${port}`;
const routes = ["/", "/map", "/entity", "/alerts", "/huginn", "/settings"];
const apiChecks = [
  { route: "/api/watchtower/runs", method: "GET", okStatuses: [200] },
  { route: "/api/graphrag/query", method: "POST", body: { question: "source-backed AI infrastructure evidence", limit: 2 }, okStatuses: [200] },
  { route: "/api/watchtower/approvals", method: "POST", body: {}, okStatuses: [400] },
  { route: "/api/watchtower/rerun", method: "POST", body: {}, okStatuses: [400] }
];

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

async function fetchApiWithRetry(check, attempts = 10) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}${check.route}`, {
        method: check.method,
        headers: check.body ? { "content-type": "application/json" } : undefined,
        body: check.body ? JSON.stringify(check.body) : undefined,
        redirect: "follow"
      });
      if (check.okStatuses.includes(response.status)) return response;
      lastError = new Error(`HTTP ${response.status} for ${check.method} ${check.route}`);
    } catch (error) {
      lastError = error;
    }
    await wait(1000);
  }
  throw lastError ?? new Error(`Failed API check ${check.method} ${check.route}`);
}

function extractStylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)]
    .map(([tag]) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean);
}

async function assertStylesheets(route, html) {
  const hrefs = extractStylesheetHrefs(html);
  if (hrefs.length === 0) {
    throw new Error(`Route ${route} did not include any stylesheet links`);
  }

  for (const href of hrefs) {
    const url = new URL(href, baseUrl);
    const response = await fetch(url, { redirect: "follow" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.toLowerCase().includes("text/css")) {
      throw new Error(
        `Stylesheet ${url.pathname} for ${route} returned HTTP ${response.status} with content-type ${contentType || "missing"}`
      );
    }
  }
}

function startServer() {
  const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const child = spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], {
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
    await assertStylesheets(route, html);
    console.log(JSON.stringify({ route, status: response.status, length: html.length }));
  }
  for (const check of apiChecks) {
    const response = await fetchApiWithRetry(check);
    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new Error(`API ${check.route} did not return a JSON object`);
    }
    console.log(JSON.stringify({ route: check.route, method: check.method, status: response.status }));
  }
  await shutdown(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
}
