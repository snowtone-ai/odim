import { createHash, createSign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deterministicUuid } from "../pipeline/idempotency.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";

type PushAlert = {
  id: string;
  title: string;
  priority: string;
  description: string;
};

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  orgId?: string | null;
  userAgent?: string | null;
  lastSeenAt: string;
  createdAt: string;
};

type NotificationEnvelope = {
  title: string;
  body: string;
  tag: string;
};

const queue: NotificationEnvelope[] = [];
const MEMORY_SUBSCRIPTIONS = new Map<string, PushSubscriptionRecord>();
const PUSH_STORE_FILE = join(process.cwd(), ".odim", "push-subscriptions.json");

function ensureStoreDir() {
  const dir = dirname(PUSH_STORE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readFileSubscriptions() {
  try {
    if (!existsSync(PUSH_STORE_FILE)) return [] as PushSubscriptionRecord[];
    const parsed = JSON.parse(readFileSync(PUSH_STORE_FILE, "utf8")) as PushSubscriptionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFileSubscriptions(rows: PushSubscriptionRecord[]) {
  ensureStoreDir();
  writeFileSync(PUSH_STORE_FILE, JSON.stringify(rows, null, 2));
}

function subscriptionId(endpoint: string) {
  return deterministicUuid("push_subscription", endpoint);
}

function audienceForEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.host}`;
}

function readPrivateKeyPem() {
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  return privateKey ? privateKey.replace(/\\n/g, "\n") : "";
}

function readPublicKeyValue() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim() || "";
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function buildVapidJwt(audience: string) {
  const privateKey = readPrivateKeyPem();
  const publicKey = readPublicKeyValue();
  if (!privateKey || !publicKey) return null;
  const header = base64Url(JSON.stringify({ alg: "ES256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: process.env.VAPID_SUBJECT || "mailto:ops@odim.local"
    })
  );
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = derToJose(signer.sign(privateKey), 64);
  return {
    jwt: `${header}.${payload}.${base64Url(signature)}`,
    publicKey
  };
}

function derToJose(signature: Buffer, size: number) {
  let offset = 3;
  const sequenceLength = signature[1];
  if (sequenceLength + 2 !== signature.length) offset = 2;
  const rLength = signature[offset + 1];
  const r = signature.subarray(offset + 2, offset + 2 + rLength);
  offset = offset + 2 + rLength;
  const sLength = signature[offset + 1];
  const s = signature.subarray(offset + 2, offset + 2 + sLength);
  const output = Buffer.alloc(size);
  r.copy(output, size / 2 - r.length);
  s.copy(output, size - s.length);
  return output;
}

function notificationEnvelope(alert: PushAlert): NotificationEnvelope {
  return {
    title: `[${alert.priority.toUpperCase()}] ${alert.title}`,
    body: alert.description,
    tag: alert.id
  };
}

async function loadPersistentSubscriptions() {
  const inMemory = Array.from(MEMORY_SUBSCRIPTIONS.values());
  if (!hasSupabaseWriteEnv()) return inMemory.length ? inMemory : readFileSubscriptions();

  try {
    const { data, error } = await createServiceSupabaseClient()
      .from("push_subscriptions")
      .select("id, org_id, endpoint, p256dh, auth, user_agent, last_seen_at, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: String(row.id),
      endpoint: String(row.endpoint),
      keys: {
        p256dh: String(row.p256dh),
        auth: String(row.auth)
      },
      orgId: row.org_id ? String(row.org_id) : null,
      userAgent: row.user_agent ? String(row.user_agent) : null,
      lastSeenAt: String(row.last_seen_at ?? new Date().toISOString()),
      createdAt: String(row.created_at ?? new Date().toISOString())
    }));
  } catch {
    return inMemory.length ? inMemory : readFileSubscriptions();
  }
}

async function persistSubscription(record: PushSubscriptionRecord) {
  MEMORY_SUBSCRIPTIONS.set(record.endpoint, record);
  if (hasSupabaseWriteEnv()) {
    try {
      await createServiceSupabaseClient().from("push_subscriptions").upsert(
        {
          id: record.id,
          org_id: record.orgId ?? null,
          endpoint: record.endpoint,
          p256dh: record.keys.p256dh,
          auth: record.keys.auth,
          user_agent: record.userAgent ?? null,
          last_seen_at: record.lastSeenAt,
          created_at: record.createdAt
        },
        { onConflict: "endpoint" }
      );
      return;
    } catch {
      // fall through to file store
    }
  }
  const next = readFileSubscriptions().filter((entry) => entry.endpoint !== record.endpoint);
  next.push(record);
  writeFileSubscriptions(next);
}

async function deleteSubscription(endpoint: string) {
  MEMORY_SUBSCRIPTIONS.delete(endpoint);
  if (hasSupabaseWriteEnv()) {
    try {
      await createServiceSupabaseClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
      return;
    } catch {
      // fall through
    }
  }
  writeFileSubscriptions(readFileSubscriptions().filter((entry) => entry.endpoint !== endpoint));
}

export function getPushPublicKey() {
  return readPublicKeyValue() || null;
}

export function drainQueuedNotifications() {
  return queue.splice(0, queue.length);
}

export function registerPushSubscription(id = "browser-session") {
  const now = new Date().toISOString();
  MEMORY_SUBSCRIPTIONS.set(id, {
    id: subscriptionId(id),
    endpoint: id,
    keys: { p256dh: "test", auth: "test" },
    createdAt: now,
    lastSeenAt: now
  });
}

export function removePushSubscription(id = "browser-session") {
  MEMORY_SUBSCRIPTIONS.delete(id);
}

export async function upsertPushSubscription(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  orgId?: string | null;
  userAgent?: string | null;
}) {
  if (!input.endpoint?.trim()) throw new Error("push subscription endpoint is required");
  if (!input.keys?.p256dh || !input.keys?.auth) throw new Error("push subscription keys are required");
  const now = new Date().toISOString();
  const record: PushSubscriptionRecord = {
    id: subscriptionId(input.endpoint),
    endpoint: input.endpoint,
    keys: input.keys,
    orgId: input.orgId ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: now,
    lastSeenAt: now
  };
  await persistSubscription(record);
  return record;
}

export async function unregisterPushSubscription(endpoint: string) {
  if (!endpoint?.trim()) return;
  await deleteSubscription(endpoint);
}

export async function listPushSubscriptions() {
  return loadPersistentSubscriptions();
}

export async function sendPushNotification(subscription: PushSubscriptionRecord | string, alert: PushAlert): Promise<void> {
  const envelope = notificationEnvelope(alert);
  queue.push(envelope);
  const normalized =
    typeof subscription === "string" ? MEMORY_SUBSCRIPTIONS.get(subscription) ?? null : subscription;
  if (!normalized || !/^https?:\/\//i.test(normalized.endpoint)) return;
  const vapid = buildVapidJwt(audienceForEndpoint(normalized.endpoint));
  if (!vapid) return;

  const response = await fetch(normalized.endpoint, {
    method: "POST",
    headers: {
      TTL: "300",
      Urgency: alert.priority.toLowerCase() === "critical" ? "high" : "normal",
      Topic: base64Url(createHash("sha256").update(alert.id).digest()).slice(0, 32),
      Authorization: `vapid t=${vapid.jwt}, k=${vapid.publicKey}`,
      "Content-Length": "0"
    }
  }).catch((error) => {
    throw new Error(`push send failed: ${error instanceof Error ? error.message : String(error)}`);
  });

  if (response.status === 404 || response.status === 410) {
    await deleteSubscription(normalized.endpoint);
    return;
  }
  if (!response.ok && response.status !== 201) {
    throw new Error(`push send failed: ${response.status}`);
  }
}

export async function broadcastPushAlert(alert: PushAlert) {
  const subscriptions = await loadPersistentSubscriptions();
  if (!subscriptions.length) return;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendPushNotification(subscription, alert);
      } catch {
        // notification delivery must not break ingestion
      }
    })
  );
}
