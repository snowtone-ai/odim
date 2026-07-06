import type { Metadata } from "next";
import { ProseSections, PublicShell } from "@/components/ui/public-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of the Odim Reality Intelligence OS and its API."
};

const LAST_UPDATED = "July 6, 2026";

const sections = [
  {
    heading: "1. The Service",
    body: [
      "Odim (\"the Service\", \"we\", \"us\") is a reality-intelligence platform that ingests public-record signals — regulatory filings, permits, interconnection queues, procurement records, and similar sources — and connects them into source-referenced, confidence-scored intelligence for organizations.",
      "The Service provides detection and analysis of publicly observable capital commitments. It does not provide price predictions, investment advice, legal advice, or recommendations to buy or sell any security or asset."
    ]
  },
  {
    heading: "2. Accounts and Organizations",
    body: [
      "Access is provisioned per organization. You are responsible for maintaining the confidentiality of your credentials, API keys, and invite links, and for all activity that occurs under your organization's account.",
      "You must notify us promptly of any unauthorized use of your account or any other breach of security you become aware of."
    ]
  },
  {
    heading: "3. Acceptable Use",
    body: [
      "You may not: attempt to access data belonging to another organization; probe, scan, or test the vulnerability of the Service without written authorization; circumvent rate limits, authentication, or usage restrictions; resell or redistribute the Service or its output as a competing product; or use the Service in violation of applicable law, including securities and sanctions regulations.",
      "API access is subject to the key scopes granted to you and the rate limits of your plan. We may suspend keys or accounts that exceed reasonable use or endanger platform integrity."
    ]
  },
  {
    heading: "4. Subscriptions and Billing",
    body: [
      "Paid plans, trial periods, seat counts, and API rate ceilings are described at the point of purchase. Fees are billed through our payment processor and are non-refundable except where required by law.",
      "We may change plan pricing or entitlements with reasonable advance notice; changes apply from your next billing period."
    ]
  },
  {
    heading: "5. Intelligence Output and No Reliance",
    body: [
      "Signals, scores, alerts, and AI-generated answers are produced from public sources and probabilistic models. Every output carries source references and confidence indicators, and narrative data is never treated as ground truth — but outputs may still be incomplete, delayed, or wrong.",
      "You are solely responsible for decisions made using the Service. To the maximum extent permitted by law, we disclaim all liability for trading, investment, procurement, or policy decisions based on Service output."
    ]
  },
  {
    heading: "6. Intellectual Property",
    body: [
      "We retain all rights in the Service, its software, ontology, and models. You retain all rights in the data and queries you submit. You receive a limited, non-exclusive, non-transferable license to use Service output for your organization's internal purposes for the duration of your subscription."
    ]
  },
  {
    heading: "7. Termination",
    body: [
      "You may stop using the Service at any time. We may suspend or terminate access for material breach of these terms, non-payment, or where required by law. Upon termination, your organization's data is retained or deleted in accordance with our Privacy Policy."
    ]
  },
  {
    heading: "8. Disclaimers and Limitation of Liability",
    body: [
      "The Service is provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.",
      "To the maximum extent permitted by law, our aggregate liability arising out of or relating to the Service is limited to the fees you paid in the twelve months preceding the claim. We are not liable for indirect, incidental, consequential, or punitive damages."
    ]
  },
  {
    heading: "9. Changes to These Terms",
    body: [
      "We may update these terms from time to time. Material changes will be announced through the Service or by email with reasonable advance notice. Continued use after the effective date constitutes acceptance."
    ]
  },
  {
    heading: "10. Governing Law and Contact",
    body: [
      "These terms are governed by the laws of Japan, without regard to conflict-of-law principles. Disputes are subject to the exclusive jurisdiction of the Tokyo District Court.",
      "Questions about these terms can be raised through your organization's support channel."
    ]
  }
];

export default function TermsPage() {
  return (
    <PublicShell title="Terms of Service">
      <p className="mono mt-3 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-quaternary)" }}>
        Last updated: {LAST_UPDATED}
      </p>
      <ProseSections sections={sections} />
    </PublicShell>
  );
}
