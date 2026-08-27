import { assertBudgetAvailable, type RequestBudget } from "./budget.ts";
import { AiProviderError } from "./errors.ts";

export type InFlightLimiterOptions = {
  maxGlobal?: number;
  maxPerOrg?: number;
  maxPending?: number;
};

type PendingAdmission = {
  orgKey: string;
  provider: string;
  budget: RequestBudget;
  active: boolean;
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  onAbort: () => void;
};

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function nonNegativeInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function optionPositiveInteger(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : fallback;
}

function optionNonNegativeInteger(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && (value as number) >= 0 ? Math.floor(value as number) : fallback;
}

function orgKey(orgId?: string) {
  return orgId?.trim() || "public";
}

export class InFlightLimiter {
  private readonly maxGlobal: number;
  private readonly maxPerOrg: number;
  private readonly maxPending: number;
  private globalInFlight = 0;
  private readonly orgInFlight = new Map<string, number>();
  private readonly pending: PendingAdmission[] = [];

  constructor(options: InFlightLimiterOptions = {}) {
    this.maxGlobal = Math.max(1, optionPositiveInteger(options.maxGlobal, positiveInteger("AI_MAX_IN_FLIGHT", 8)));
    this.maxPerOrg = Math.max(1, optionPositiveInteger(options.maxPerOrg, positiveInteger("AI_MAX_IN_FLIGHT_PER_ORG", 2)));
    this.maxPending = Math.max(0, optionNonNegativeInteger(options.maxPending, nonNegativeInteger("AI_MAX_PENDING_CALLS", 64)));
  }

  private canAdmit(key: string) {
    return this.globalInFlight < this.maxGlobal && (this.orgInFlight.get(key) ?? 0) < this.maxPerOrg;
  }

  private take(key: string) {
    this.globalInFlight += 1;
    this.orgInFlight.set(key, (this.orgInFlight.get(key) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.globalInFlight = Math.max(0, this.globalInFlight - 1);
      const nextOrgCount = Math.max(0, (this.orgInFlight.get(key) ?? 0) - 1);
      if (nextOrgCount === 0) this.orgInFlight.delete(key);
      else this.orgInFlight.set(key, nextOrgCount);
      this.drain();
    };
  }

  private removePending(entry: PendingAdmission) {
    const index = this.pending.indexOf(entry);
    if (index >= 0) this.pending.splice(index, 1);
  }

  private drain() {
    let admitted = true;
    while (admitted && this.globalInFlight < this.maxGlobal) {
      admitted = false;
      for (let index = 0; index < this.pending.length; index += 1) {
        const entry = this.pending[index];
        if (!entry?.active || !this.canAdmit(entry.orgKey)) continue;
        this.pending.splice(index, 1);
        entry.active = false;
        entry.budget.signal.removeEventListener("abort", entry.onAbort);
        entry.resolve(this.take(entry.orgKey));
        admitted = true;
        break;
      }
    }
  }

  async acquire(orgId: string | undefined, budget: RequestBudget, provider: string): Promise<() => void> {
    assertBudgetAvailable(budget, provider);
    const key = orgKey(orgId);
    if (this.canAdmit(key)) return this.take(key);
    if (this.pending.length >= this.maxPending) {
      throw new AiProviderError({
        kind: "rate_limit",
        provider,
        message: `${provider} concurrency backpressure queue is full`,
        retryable: false
      });
    }

    return await new Promise<() => void>((resolve, reject) => {
      const entry = {} as PendingAdmission;
      entry.orgKey = key;
      entry.provider = provider;
      entry.budget = budget;
      entry.active = true;
      entry.resolve = resolve;
      entry.reject = reject;
      entry.onAbort = () => {
        if (!entry.active) return;
        entry.active = false;
        this.removePending(entry);
        try {
          assertBudgetAvailable(budget, provider);
          reject(new AiProviderError({ kind: "aborted", provider, message: `${provider} request was aborted`, retryable: false }));
        } catch (error) {
          reject(error);
        }
      };
      this.pending.push(entry);
      budget.signal.addEventListener("abort", entry.onAbort, { once: true });
      if (budget.signal.aborted) entry.onAbort();
    });
  }

  getState() {
    return {
      globalInFlight: this.globalInFlight,
      orgInFlight: new Map(this.orgInFlight),
      pending: this.pending.filter((entry) => entry.active).length,
      maxGlobal: this.maxGlobal,
      maxPerOrg: this.maxPerOrg,
      maxPending: this.maxPending
    };
  }
}

export const runtimeInFlightLimiter = new InFlightLimiter();
