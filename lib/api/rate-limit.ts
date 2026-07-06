type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  ok: boolean;
  retryAfter: number;
};

const buckets = new Map<string, RateLimitState>();

export function checkRequestRateLimit(
  orgId: string | undefined,
  endpoint: string,
  limits: { maxRequests: number; windowMs: number },
  now = Date.now()
): RateLimitResult {
  const key = `${orgId ?? "public"}:${endpoint}`;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limits.windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (existing.count >= limits.maxRequests) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function resetRequestRateLimit() {
  buckets.clear();
}

/**
 * Client key for rate-limiting unauthenticated endpoints. Prefers the
 * platform-set x-real-ip; otherwise uses the rightmost x-forwarded-for entry,
 * which was appended by the closest proxy and is hardest for a client to spoof.
 */
export function clientIpFromRequest(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded.at(-1) || "unknown";
}
