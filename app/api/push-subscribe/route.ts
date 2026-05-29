import { NextResponse } from "next/server";
import {
  drainQueuedNotifications,
  getPushPublicKey,
  unregisterPushSubscription,
  upsertPushSubscription
} from "@/lib/notifications/push";

type PushSubscriptionBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("drain") === "true") {
    return NextResponse.json({ notifications: drainQueuedNotifications() });
  }
  return NextResponse.json({ publicKey: getPushPublicKey() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PushSubscriptionBody;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid push subscription payload" }, { status: 400 });
  }
  await upsertPushSubscription({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    userAgent: request.headers.get("user-agent")
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PushSubscriptionBody;
  if (!body.endpoint) return NextResponse.json({ ok: true });
  await unregisterPushSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
