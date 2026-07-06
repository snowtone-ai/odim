export const planIds = ["trial", "pro", "enterprise"] as const;
export type PlanId = (typeof planIds)[number];

export type PlanEntitlements = {
  seats: number;
  apiRequestsPerMinute: number;
  huginnQueriesPerDay: number;
  watchtowerConcurrentRuns: number;
  proprietarySources: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  priceUsdMonthly: number;
  entitlements: PlanEntitlements;
};

export const plans: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Trial",
    priceUsdMonthly: 0,
    entitlements: {
      seats: 3,
      apiRequestsPerMinute: 60,
      huginnQueriesPerDay: 25,
      watchtowerConcurrentRuns: 1,
      proprietarySources: false
    }
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsdMonthly: 499,
    entitlements: {
      seats: 10,
      apiRequestsPerMinute: 300,
      huginnQueriesPerDay: 500,
      watchtowerConcurrentRuns: 5,
      proprietarySources: false
    }
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceUsdMonthly: 2499,
    entitlements: {
      seats: 100,
      apiRequestsPerMinute: 1200,
      huginnQueriesPerDay: 5000,
      watchtowerConcurrentRuns: 20,
      proprietarySources: true
    }
  }
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (planIds as readonly string[]).includes(value);
}

export function getPlan(planId: string | undefined): Plan {
  return isPlanId(planId) ? plans[planId] : plans.trial;
}

export const purchasablePlanIds = ["pro", "enterprise"] as const satisfies readonly PlanId[];
