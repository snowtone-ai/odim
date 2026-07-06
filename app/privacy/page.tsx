import type { Metadata } from "next";
import { ProseSections, PublicShell } from "@/components/ui/public-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Odim collects, uses, and protects organization and account data."
};

const LAST_UPDATED = "July 6, 2026";

const sections = [
  {
    heading: "1. What This Policy Covers",
    body: [
      "This policy describes how Odim handles personal and organizational data when you use the platform, its dashboard, and its API. It covers account data you provide, operational data the Service generates, and the public-record data the Service ingests."
    ]
  },
  {
    heading: "2. Data We Collect",
    body: [
      "Account data: name or handle, work email address, organization membership, and role, provided at signup or via an organization invite.",
      "Operational data: authentication events, API request logs (route, method, status, timing), audit-trail entries for queries and workflow approvals, and billing state for your organization. API keys and invite tokens are stored only as salted hashes — the Service cannot recover the original values.",
      "Ingested data: signals collected from public sources such as regulatory filings, permits, and procurement records. This data concerns organizations and public actors, not Service users; it is processed to build entity intelligence and is attributed to its original public source."
    ]
  },
  {
    heading: "3. How We Use Data",
    body: [
      "We use account and operational data to operate the Service: authenticating access, enforcing per-organization isolation, applying plan entitlements and rate limits, maintaining audit trails, detecting abuse, and diagnosing failures.",
      "We do not sell personal data, and we do not use your organization's queries or private memory to train models for other customers. Organization memory is isolated per tenant."
    ]
  },
  {
    heading: "4. Processors and Subprocessors",
    body: [
      "The Service runs on infrastructure and managed services that process data on our behalf: database and authentication hosting (Supabase), payment processing (Stripe — card details never touch our servers), AI model providers used to answer queries (query text and retrieved context are sent for inference), and error-tracking ingestion for operational diagnostics with secret redaction applied before delivery.",
      "Each processor receives only the data required for its function."
    ]
  },
  {
    heading: "5. Cookies and Sessions",
    body: [
      "The Service uses a session cookie for authenticated access and a locale preference cookie. It does not use third-party advertising or cross-site tracking cookies."
    ]
  },
  {
    heading: "6. Retention and Deletion",
    body: [
      "Account and organization data is retained while your subscription is active. Audit trails and billing event records are retained as append-only history for integrity and compliance purposes.",
      "When an organization is closed, its account data and tenant-isolated memory are deleted or irreversibly anonymized within a reasonable period, except where retention is required by law (for example, billing records)."
    ]
  },
  {
    heading: "7. Security",
    body: [
      "Data is encrypted in transit, tenant isolation is enforced at the database layer with row-level security, secrets and key material are hashed or redacted in logs, and access to production systems is restricted. See the Security page for the full posture."
    ]
  },
  {
    heading: "8. Your Rights",
    body: [
      "Subject to applicable law, you may request access to, correction of, or deletion of your personal data, and you may object to or restrict certain processing. Requests can be made through your organization's administrator or support channel and will be honored within the timelines required by applicable law, including the APPI (Japan) and, where applicable, the GDPR."
    ]
  },
  {
    heading: "9. Changes and Contact",
    body: [
      "We may update this policy as the Service evolves; material changes will be announced with reasonable advance notice. Privacy questions and requests can be raised through your organization's support channel."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy Policy">
      <p className="mono mt-3 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-quaternary)" }}>
        Last updated: {LAST_UPDATED}
      </p>
      <ProseSections sections={sections} />
    </PublicShell>
  );
}
