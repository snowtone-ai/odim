type SlackAlertPayload = {
  title: string;
  priority: string;
  confidence: number;
  description: string;
  source: string;
};

function priorityColor(priority: string): string {
  const p = priority.toUpperCase();
  if (p === "CRITICAL") return "#dc2626";
  if (p === "HIGH") return "#f59e0b";
  if (p === "MEDIUM") return "#3b82f6";
  return "#6b7280";
}

export async function sendSlackAlert(alert: SlackAlertPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const color = priorityColor(alert.priority);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [
          {
            color,
            title: `[${alert.priority.toUpperCase()}] ${alert.title}`,
            text: alert.description,
            fields: [
              {
                title: "Confidence",
                value: `${Math.round(alert.confidence * 100)}%`,
                short: true
              },
              {
                title: "Source",
                value: alert.source,
                short: true
              }
            ],
            footer: "Odim Reality Intelligence",
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      }),
      signal: controller.signal
    });
    if (!resp.ok) {
      console.warn(`Slack webhook returned ${resp.status}`);
    }
  } catch (err) {
    console.warn(`Slack notification failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeout);
  }
}
