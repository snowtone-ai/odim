import { circuitOpenError, isAiProviderError, type AiProviderError } from "./errors.ts";

type CircuitState = {
  failures: number;
  openedUntil: number;
  halfOpenInFlight: boolean;
};

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  resetMs?: number;
  now?: () => number;
};

function envPositive(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function optionPositive(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}

function countsTowardCircuit(error: unknown) {
  return isAiProviderError(error) && error.retryable;
}

export class CircuitBreakerRegistry {
  private readonly states = new Map<string, CircuitState>();
  private readonly failureThreshold: number;
  private readonly resetMs: number;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = Math.max(1, Math.floor(optionPositive(options.failureThreshold, envPositive("AI_CIRCUIT_FAILURE_THRESHOLD", 3))));
    this.resetMs = Math.max(1, optionPositive(options.resetMs, envPositive("AI_CIRCUIT_RESET_MS", 15_000)));
    this.now = options.now ?? Date.now;
  }

  async execute<T>(key: string, provider: string, operation: () => Promise<T>): Promise<T> {
    const now = this.now();
    const state = this.states.get(key);
    let halfOpen = false;
    if (state?.openedUntil && now < state.openedUntil) throw circuitOpenError(provider);
    if (state?.openedUntil && now >= state.openedUntil) {
      if (state.halfOpenInFlight) throw circuitOpenError(provider);
      state.halfOpenInFlight = true;
      halfOpen = true;
    }

    try {
      const result = await operation();
      this.states.delete(key);
      return result;
    } catch (error) {
      if (countsTowardCircuit(error)) {
        const current = this.states.get(key) ?? { failures: 0, openedUntil: 0, halfOpenInFlight: false };
        current.halfOpenInFlight = false;
        current.failures = halfOpen ? this.failureThreshold : current.failures + 1;
        if (current.failures >= this.failureThreshold) current.openedUntil = this.now() + this.resetMs;
        this.states.set(key, current);
      } else if (state) {
        state.halfOpenInFlight = false;
      }
      throw error;
    }
  }

  clear() {
    this.states.clear();
  }

  getState(key: string) {
    const state = this.states.get(key);
    return state ? { ...state } : undefined;
  }
}

export const runtimeCircuitBreakers = new CircuitBreakerRegistry();

export function clearCircuitBreakers() {
  runtimeCircuitBreakers.clear();
}

export type CircuitError = AiProviderError;
