import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import { sendSlackAlert } from "@/lib/notifications/slack";

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!process.env.SLACK_WEBHOOK_URL) {
      return NextResponse.json({ error: "SLACK_WEBHOOK_URL is not configured" }, { status: 400 });
    }

    await sendSlackAlert({
      title: "Odim webhook test — if you see this, notifications are working.",
      priority: "LOW",
      confidence: 1,
      description: "[TEST] This is a test message from Odim Reality Intelligence OS.",
      source: "webhook-test"
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("webhook-test failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
