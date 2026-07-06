import Link from "next/link";
import { OdimLogo } from "@/components/ui/odim-logo";

const principles = [
  {
    title: "Reality over Narrative",
    body: "Odim reads capital fixation in the physical world — filings, permits, interconnection queues, procurement — and treats narrative as a divergence trigger, never as truth."
  },
  {
    title: "Detection, not forecasting",
    body: "No price predictions. Odim detects committed capital before official announcements and connects it through the Capital Fixation Ontology."
  },
  {
    title: "Every inference is auditable",
    body: "Each signal, alert, and AI answer carries source references, confidence, and a full Audit Trail. Organization memory is isolated per tenant."
  }
];

const layers = ["Energy", "Capital", "Minerals", "Compute", "Water", "Materials", "Logistics"];

const audiences = [
  "Hedge funds and quant funds",
  "Corporate strategy, M&A, and procurement",
  "Government and economic security agencies",
  "PE and infrastructure funds"
];

const sources = [
  "SEC EDGAR", "FERC", "FRED", "Federal Register", "EDINET", "Companies House",
  "USAspending", "OpenSanctions", "FEMA", "SAM.gov", "NRC", "ISO Queues"
];

function CtaButtons() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/map"
        className="rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--rune)", color: "var(--ink-950)" }}
      >
        Open Console
      </Link>
      <Link
        href="/signup"
        className="rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-medium transition-colors hover:text-[var(--text-primary)]"
        style={{
          border: "1px solid var(--line-soft)",
          color: "var(--text-secondary)",
          background: "transparent"
        }}
      >
        Start Free Trial
      </Link>
      <Link
        href="/login"
        className="rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-medium transition-colors hover:text-[var(--text-primary)]"
        style={{
          border: "1px solid var(--line-soft)",
          color: "var(--text-secondary)",
          background: "transparent"
        }}
      >
        Enterprise Sign-In
      </Link>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--ink-950)" }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-4 md:px-12"
        style={{ borderBottom: "1px solid var(--line-faint)" }}
      >
        <div className="flex items-center gap-3">
          <OdimLogo size={26} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Odim
          </span>
          <span className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-quaternary)" }}>
            Reality Intelligence OS
          </span>
        </div>
        <Link href="/login" className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 md:px-12">
        <p className="mono text-[12px] uppercase tracking-[0.16em]" style={{ color: "var(--rune)" }}>
          Substrate Intelligence
        </p>
        <h1
          className="mt-4 text-4xl leading-tight md:text-5xl"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-spectral)" }}
        >
          Detect real decisions before official announcements.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Odim reads capital fixation across the physical economy — energy interconnections,
          permits, filings, procurement — and connects committed capital into source-backed,
          confidence-scored intelligence, before the narrative layer catches up.
        </p>
        <div className="mt-8">
          <CtaButtons />
        </div>
      </section>

      {/* Reality layers strip */}
      <section
        className="mx-auto max-w-4xl px-6 md:px-12"
        aria-label="Reality layer coverage"
      >
        <div
          className="flex flex-wrap gap-x-6 gap-y-2 rounded-[var(--radius-md)] px-5 py-4"
          style={{ border: "1px solid var(--line-faint)", background: "var(--ink-900)" }}
        >
          {layers.map((layer) => (
            <span
              key={layer}
              className="mono text-[11px] uppercase tracking-[0.12em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {layer}
            </span>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="mx-auto grid max-w-4xl gap-4 px-6 py-16 md:grid-cols-3 md:px-12">
        {principles.map((item) => (
          <div
            key={item.title}
            className="rounded-[var(--radius-md)] p-5"
            style={{ border: "1px solid var(--line-faint)", background: "var(--ink-900)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {item.title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              {item.body}
            </p>
          </div>
        ))}
      </section>

      {/* Audience + sources */}
      <section className="mx-auto grid max-w-4xl gap-10 px-6 pb-16 md:grid-cols-2 md:px-12">
        <div>
          <h2 className="mono text-[12px] uppercase tracking-[0.16em]" style={{ color: "var(--text-quaternary)" }}>
            Built for
          </h2>
          <ul className="mt-4 grid gap-2">
            {audiences.map((audience) => (
              <li key={audience} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {audience}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mono text-[12px] uppercase tracking-[0.16em]" style={{ color: "var(--text-quaternary)" }}>
            Source-backed by design
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {sources.map((source) => (
              <span
                key={source}
                className="mono rounded-[var(--radius-sm)] px-2 py-1 text-[11px]"
                style={{ border: "1px solid var(--line-faint)", color: "var(--text-tertiary)" }}
              >
                {source}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--text-quaternary)" }}>
            Daily ingestion with idempotent fingerprints, freshness SLAs, and a versioned REST API
            for programmatic access.
          </p>
        </div>
      </section>

      {/* Footer CTA */}
      <footer
        className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12 md:px-12"
        style={{ borderTop: "1px solid var(--line-faint)" }}
      >
        <CtaButtons />
        <p className="mono text-[11px]" style={{ color: "var(--text-quaternary)" }}>
          Odim is not a price prediction product. Narrative data is never treated as truth.
        </p>
      </footer>
    </main>
  );
}
