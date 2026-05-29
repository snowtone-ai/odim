#!/usr/bin/env node
/**
 * weekly-report.mjs — Generate and send weekly Odim intelligence report.
 * Usage: node scripts/weekly-report.mjs [--dry-run] [--locale=ja]
 *
 * Requires environment variables:
 *   NEXT_PUBLIC_APP_URL or ODIM_APP_URL — base URL for Huginn API calls
 *   SLACK_WEBHOOK_URL — Slack Incoming Webhook URL
 *   DEFAULT_ORG_ID — org context for Huginn queries
 */

import { existsSync, readFileSync } from "node:fs";

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, "");
  }
}
loadDotEnv(".env.local");
loadDotEnv(".env");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const locale = args.includes("--locale=ja") ? "ja" : "en";
const orgId = process.env.DEFAULT_ORG_ID || "11111111-1111-4111-8111-111111111111";
const appUrl = (process.env.ODIM_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const webhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!webhookUrl && !dryRun) {
  console.error("SLACK_WEBHOOK_URL is not set. Use --dry-run to test without sending.");
  process.exit(1);
}

const SECTION_PROMPTS = {
  topSignals:
    "Summarize the top Capital Fixation signals from the past 7 days, ordered by priority. Include confidence levels and source references.",
  entityMovements:
    "Which entities showed the largest Capital Fixation score changes in the past 7 days? For each, note whether the change is positive or negative and the primary substrate driver.",
  substrateTrends:
    "Give a sector-by-sector overview of Capital Fixation activity this week. Which substrates are showing the most movement or unusual patterns?",
  narrativeGaps:
    "Which entities currently have the largest Narrative-Reality Gap? What reality signals contradict the prevailing narrative for each?"
};

const SECTION_TITLES = {
  en: {
    topSignals: "Top Signals",
    entityMovements: "Entity Movements",
    substrateTrends: "Substrate Trends",
    narrativeGaps: "Narrative-Reality Gaps"
  },
  ja: {
    topSignals: "トップシグナル",
    entityMovements: "エンティティ動向",
    substrateTrends: "サブストレートトレンド",
    narrativeGaps: "ナラティブ乖離"
  }
};

async function callHuginn(question) {
  const res = await fetch(`${appUrl}/api/huginn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, orgId })
  });
  if (!res.ok) throw new Error(`Huginn API returned ${res.status}`);
  return res.json();
}

async function sendSlack(blocks) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks })
  });
  if (!res.ok) console.warn(`Slack returned ${res.status}`);
}

async function main() {
  console.log(JSON.stringify({ event: "weekly_report_start", dryRun, locale, orgId }));

  const sections = [];
  const titles = SECTION_TITLES[locale];

  for (const [key, prompt] of Object.entries(SECTION_PROMPTS)) {
    console.log(JSON.stringify({ event: "huginn_query", section: key }));
    try {
      const result = await callHuginn(prompt);
      sections.push({
        title: titles[key] ?? key,
        content: result.answer ?? "(no answer)",
        confidence: result.confidence ?? 0
      });
    } catch (err) {
      console.warn(`section ${key} failed: ${err.message}`);
      sections.push({ title: titles[key] ?? key, content: `Unavailable: ${err.message}`, confidence: 0 });
    }
  }

  const overallConfidence =
    sections.reduce((sum, s) => sum + s.confidence, 0) / Math.max(sections.length, 1);

  const today = new Date().toISOString().slice(0, 10);
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `Odim Weekly Report — ${today}` }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Overall confidence: *${Math.round(overallConfidence * 100)}%* · Huginn Reality Intelligence`
        }
      ]
    },
    { type: "divider" },
    ...sections.flatMap((s) => [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${s.title}* _(${Math.round(s.confidence * 100)}% conf.)_\n${s.content.slice(0, 2800)}`
        }
      },
      { type: "divider" }
    ])
  ];

  if (dryRun) {
    console.log(JSON.stringify({ event: "weekly_report_dry_run", sections: sections.length, overallConfidence }));
    console.log(JSON.stringify({ blocks }, null, 2));
  } else {
    await sendSlack(blocks);
    console.log(JSON.stringify({ event: "weekly_report_sent", sections: sections.length, overallConfidence }));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
