export type RouteMetrics = {
  route: string;
  requests: number;
  errors: number;
};

export type ApiErrorDetail = {
  route: string;
  status: number;
  message: string;
  at: string;
};

export type ApiMetricsSnapshot = {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  routes: RouteMetrics[];
  recentErrors: ApiErrorDetail[];
};

// In-process counters: per-instance visibility with zero external dependencies.
// Serverless deployments see per-instance numbers; that is an accepted bound.
const routeCounters = new Map<string, { requests: number; errors: number }>();
const recentErrors: ApiErrorDetail[] = [];
const MAX_TRACKED_ROUTES = 200;
const MAX_RECENT_ERRORS = 20;
const MAX_ERROR_MESSAGE_LENGTH = 200;

function counterKey(route: string) {
  // Unknown-route growth is bounded; overflow traffic aggregates into one bucket.
  return routeCounters.has(route) || routeCounters.size < MAX_TRACKED_ROUTES ? route : "(other)";
}

export function recordApiOutcome(route: string, status: number) {
  const key = counterKey(route);
  const counters = routeCounters.get(key) ?? { requests: 0, errors: 0 };
  counters.requests += 1;
  if (status >= 500) counters.errors += 1;
  routeCounters.set(key, counters);
}

export function recordApiError(route: string, status: number, message: string, now = new Date()) {
  recentErrors.push({
    route: counterKey(route),
    status,
    message: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    at: now.toISOString()
  });
  while (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();
}

export function snapshotApiMetrics(): ApiMetricsSnapshot {
  let totalRequests = 0;
  let totalErrors = 0;
  const routes: RouteMetrics[] = [];
  for (const [route, counters] of routeCounters) {
    totalRequests += counters.requests;
    totalErrors += counters.errors;
    routes.push({ route, requests: counters.requests, errors: counters.errors });
  }
  routes.sort((a, b) => b.requests - a.requests);
  return {
    totalRequests,
    totalErrors,
    errorRate: totalRequests > 0 ? Number((totalErrors / totalRequests).toFixed(4)) : 0,
    routes,
    recentErrors: [...recentErrors]
  };
}

export function resetApiMetrics() {
  routeCounters.clear();
  recentErrors.length = 0;
}
