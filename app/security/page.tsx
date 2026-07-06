import type { Metadata } from "next";
import { ProseSections, PublicShell } from "@/components/ui/public-shell";

export const metadata: Metadata = {
  title: "Security",
  description: "Odim's security posture: tenant isolation, key handling, and platform hardening."
};

const LAST_UPDATED = "July 6, 2026";

const sections = [
  {
    heading: "Tenant Isolation",
    body: [
      "Every signal, entity, alert, memory record, and audit entry is scoped to an organization. Row-level security is enforced at the database layer, and application reads apply organization filters on every query. Organization memory used by the AI layer is never shared across tenants."
    ]
  },
  {
    heading: "Credentials and Key Material",
    body: [
      "API keys and invite tokens are generated server-side, shown exactly once, and stored only as salted hashes — the platform cannot recover them. Keys carry explicit scopes (for example entities:read or huginn:query) and can be revoked instantly. Payment webhooks are verified with HMAC signatures inside a bounded replay window."
    ]
  },
  {
    heading: "Application Hardening",
    body: [
      "All responses carry a strict Content-Security-Policy with per-request nonces, frame-ancestors denial, HSTS, and referrer and permissions policies. Authentication is enforced in middleware before any route logic runs. API routes authorize first, validate input before domain work, apply per-key and per-route rate limits, and return sanitized JSON errors without stack traces."
    ]
  },
  {
    heading: "Fail-Closed Defaults",
    body: [
      "Optional surfaces — self-serve signup, billing, error tracking — are disabled unless explicitly enabled by environment configuration, and their routes return service-unavailable rather than degrading to an unauthenticated path. Production data access fails closed when backing services are unreachable."
    ]
  },
  {
    heading: "Auditability and Observability",
    body: [
      "AI answers carry source references and confidence indicators, and every query, alert, and workflow approval is written to an append-only audit trail. Logs are structured with secret-field and token-shape redaction applied before anything leaves the process; billing events are recorded append-only with idempotent processing."
    ]
  },
  {
    heading: "Ingestion Integrity",
    body: [
      "The platform ingests public-record sources only. Ingestion is idempotent via content fingerprints, source failures are reported per source rather than silently dropped, and freshness SLAs are tracked so stale data is visible instead of masked."
    ]
  },
  {
    heading: "Reporting a Vulnerability",
    body: [
      "If you believe you have found a security issue, report it through your organization's support channel with reproduction details. Do not test against other organizations' data. We acknowledge reports promptly, and we do not pursue good-faith research conducted within these bounds."
    ]
  }
];

export default function SecurityPage() {
  return (
    <PublicShell title="Security">
      <p className="mono mt-3 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-quaternary)" }}>
        Last updated: {LAST_UPDATED}
      </p>
      <ProseSections sections={sections} />
    </PublicShell>
  );
}
