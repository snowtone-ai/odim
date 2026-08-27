import { createHash } from "node:crypto";
import { assertBudgetAvailable, createRequestBudget, raceWithBudget, type RequestBudget } from "./budget.ts";
import type { JsonSchema } from "./types.ts";

type CacheEntry<T> = { value: T; expiresAt: number };

type InFlightEntry = {
  promise: Promise<unknown>;
  controller: AbortController;
  workBudget: RequestBudget;
  waiters: number;
  settled: boolean;
};

export type TtlSingleflightCacheOptions = {
  maxEntries?: number;
};

export type SingleflightOptions = {
  workTimeoutMs?: number;
  waiterBudget?: RequestBudget;
  provider?: string;
};

export type RuntimeCacheKeyInput = {
  orgId?: string;
  provider: string;
  model: string;
  schemaVersion: string;
  jsonSchema?: JsonSchema;
  question: string;
  context: string;
};

export function hashContext(question: string, context: string) {
  return createHash("sha256").update(JSON.stringify([question, context])).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "null" : serialized;
}

export function hashJsonSchema(schema: JsonSchema) {
  return createHash("sha256").update(canonicalJson(schema)).digest("hex");
}

export function buildRuntimeCacheKey(input: RuntimeCacheKeyInput) {
  const org = input.orgId?.trim() || "public";
  return [
    "ai-v3",
    encodeURIComponent(org),
    encodeURIComponent(input.provider),
    encodeURIComponent(input.model),
    encodeURIComponent(input.schemaVersion),
    input.jsonSchema ? hashJsonSchema(input.jsonSchema) : "no-schema",
    hashContext(input.question, input.context)
  ].join(":");
}

export class TtlSingleflightCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, InFlightEntry>();
  private readonly maxEntries: number;
  private generation = 0;

  constructor(options: TtlSingleflightCacheOptions = {}) {
    const configured = options.maxEntries ?? Number(process.env.AI_CACHE_MAX_ENTRIES ?? 512);
    this.maxEntries = Number.isFinite(configured) ? Math.max(1, Math.floor(configured)) : 512;
  }

  private pruneExpired(now = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  private evictForInsert() {
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
    }
  }

  private async waitForEntry<T>(
    key: string,
    entry: InFlightEntry,
    cacheHit: boolean,
    options: SingleflightOptions
  ): Promise<{ value: T; cacheHit: boolean }> {
    const provider = options.provider ?? "ai";
    if (options.waiterBudget) assertBudgetAvailable(options.waiterBudget, provider);
    entry.waiters += 1;
    try {
      const value = options.waiterBudget
        ? await raceWithBudget(entry.promise as Promise<T>, options.waiterBudget, provider)
        : await (entry.promise as Promise<T>);
      return { value, cacheHit };
    } finally {
      entry.waiters = Math.max(0, entry.waiters - 1);
      if (entry.waiters === 0 && !entry.settled) {
        const current = this.inFlight.get(key);
        if (current === entry) this.inFlight.delete(key);
        if (!entry.controller.signal.aborted) entry.controller.abort("no_waiters");
      }
    }
  }

  async getOrCreate<T>(
    key: string,
    factory: (workBudget: RequestBudget) => Promise<T>,
    ttlMs: number,
    options: SingleflightOptions = {}
  ): Promise<{ value: T; cacheHit: boolean }> {
    const provider = options.provider ?? "ai";
    if (options.waiterBudget) assertBudgetAvailable(options.waiterBudget, provider);
    const now = Date.now();
    this.pruneExpired(now);
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) return { value: cached.value as T, cacheHit: true };
    if (cached) this.entries.delete(key);

    const existing = this.inFlight.get(key);
    if (existing) return this.waitForEntry<T>(key, existing, true, options);

    const controller = new AbortController();
    const workBudget = createRequestBudget({ timeoutMs: options.workTimeoutMs, signal: controller.signal });
    const generation = this.generation;
    let entry: InFlightEntry;
    const work = Promise.resolve().then(() => factory(workBudget)).then((value) => {
      if (
        ttlMs > 0 &&
        generation === this.generation &&
        !workBudget.signal.aborted &&
        this.inFlight.get(key) === entry
      ) {
        this.pruneExpired();
        this.evictForInsert();
        this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    }).finally(() => {
      entry.settled = true;
      workBudget.dispose();
      const current = this.inFlight.get(key);
      if (current === entry) this.inFlight.delete(key);
    });
    entry = { promise: work as Promise<unknown>, controller, workBudget, waiters: 0, settled: false };
    this.inFlight.set(key, entry);
    void work.catch(() => undefined);
    return this.waitForEntry<T>(key, entry, false, options);
  }

  clear() {
    this.entries.clear();
    for (const entry of this.inFlight.values()) {
      if (!entry.controller.signal.aborted) entry.controller.abort("cache_clear");
    }
    this.inFlight.clear();
    this.generation += 1;
  }

  size() {
    this.pruneExpired();
    return this.entries.size;
  }
}

export const runtimeCache = new TtlSingleflightCache();

export function clearRuntimeCache() {
  runtimeCache.clear();
}
