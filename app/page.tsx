import Link from "next/link";
import { OdimLogo } from "@/components/ui/odim-logo";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

const sources = [
  "SEC EDGAR",
  "FERC",
  "FRED",
  "Federal Register",
  "EDINET",
  "Companies House",
  "USAspending",
  "OpenSanctions",
  "FEMA",
  "SAM.gov",
  "NRC",
  "ISO queues"
];

function ActionLinks({ labels, publicLabels }: Readonly<{ labels: ReturnType<typeof getMessages>["common"]["landing"]; publicLabels: ReturnType<typeof getMessages>["common"]["public"] }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <Link
        href="/map"
        className="inline-flex min-h-11 items-center border px-4 py-2 text-[13px] font-medium transition-[background-color,border-color,transform] duration-[var(--motion-micro)] hover:border-[var(--signal)] hover:bg-[color-mix(in_srgb,var(--signal)_14%,transparent)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
        style={{ borderColor: "var(--signal)", background: "var(--signal)", color: "var(--field)" }}
      >
        {labels.openConsole}
      </Link>
      <Link
        href="/signup"
        className="inline-flex min-h-11 items-center px-1 py-2 text-[13px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
        style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}
      >
        {publicLabels.createWorkspace} <span className="ml-2" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default async function LandingPage() {
  const locale = await getLocale();
  const { common } = getMessages(locale);
  const labels = common.landing;
  const publicLabels = common.public;

  return (
    <main className="min-h-screen bg-[var(--field)] text-[var(--text)]">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <header
          className="flex items-center justify-between border-b py-4 sm:py-5"
          style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}
        >
          <Link href="/" className="group flex min-h-11 items-center gap-3 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" aria-label={publicLabels.homeAria}>
            <OdimLogo size={28} className="shrink-0 transition-opacity duration-[var(--motion-micro)] group-hover:opacity-80" />
            <span className="text-[14px] font-semibold tracking-[0.18em]" style={{ color: "var(--text)" }}>
              ODIM
            </span>
            <span className="hidden text-[11px] tracking-[0.16em] sm:inline" style={{ color: "color-mix(in srgb, var(--text) 50%, transparent)" }}>
              REALITY INTELLIGENCE
            </span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6" aria-label="Landing navigation">
            <Link href="/docs" prefetch={false} className="hidden min-h-11 py-3 text-[12px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] sm:block" style={{ color: "color-mix(in srgb, var(--text) 62%, transparent)" }}>
              {publicLabels.apiDocs}
            </Link>
            <Link href="/login" className="min-h-11 py-3 text-[12px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}>
              {publicLabels.signIn}
            </Link>
          </nav>
        </header>

        <section className="grid gap-14 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:gap-20 lg:py-28" aria-labelledby="landing-title">
          <div className="self-center">
            <p className="mono text-[11px] tracking-[0.17em]" style={{ color: "var(--evidence)" }}>
              {labels.eyebrow}
            </p>
            <h1 id="landing-title" className="mt-5 max-w-[680px] text-4xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl" style={{ color: "var(--text)", fontFamily: "var(--font-spectral)" }}>
              {labels.title}
            </h1>
            <p className="mt-6 max-w-[610px] text-[16px] leading-7" style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}>
              {labels.description}
            </p>
            <div className="mt-8">
              <ActionLinks labels={labels} publicLabels={publicLabels} />
            </div>
            <p className="mt-7 text-[12px]" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
              {labels.noForecasts}
            </p>
          </div>

          <div className="lg:pt-3">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="mono text-[11px] tracking-[0.16em]" style={{ color: "color-mix(in srgb, var(--text) 54%, transparent)" }}>
                {labels.evidenceThread}
              </p>
              <span className="mono text-[11px]" style={{ color: "var(--evidence)" }}>{labels.sourceAction}</span>
            </div>
            <ol className="relative border-l pl-6" style={{ borderColor: "color-mix(in srgb, var(--evidence) 42%, transparent)" }} aria-label={labels.evidenceAria}>
              {labels.steps.map((step, index) => (
                <li key={step.label} className={`relative ${index === labels.steps.length - 1 ? "pb-0" : "pb-8"}`}>
                  <span className="absolute -left-[31px] top-0 grid h-[11px] w-[11px] place-items-center border bg-[var(--field)]" style={{ borderColor: index === labels.steps.length - 1 ? "var(--signal)" : "var(--evidence)" }} aria-hidden="true">
                    <span className="h-[3px] w-[3px]" style={{ background: index === labels.steps.length - 1 ? "var(--signal)" : "var(--evidence)" }} />
                  </span>
                  <p className="mono text-[11px] tracking-[0.14em]" style={{ color: index === labels.steps.length - 1 ? "var(--signal)" : "var(--evidence)" }}>
                    {String(index + 1).padStart(2, "0")} / {step.label}
                  </p>
                  <p className="mt-2 max-w-[340px] text-[14px] leading-6" style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}>
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="grid gap-10 border-y py-10 sm:py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20" aria-label={labels.sourceCoverage}>
          <div>
            <p className="mono text-[11px] tracking-[0.16em]" style={{ color: "color-mix(in srgb, var(--text) 54%, transparent)" }}>
              {labels.observedLayers}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
              {labels.layers.map((layer) => (
                <span key={layer} className="text-[13px]" style={{ color: "color-mix(in srgb, var(--text) 74%, transparent)" }}>
                  {layer}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-5">
              <p className="mono text-[11px] tracking-[0.16em]" style={{ color: "color-mix(in srgb, var(--text) 54%, transparent)" }}>
                {labels.sourceRegistry}
              </p>
              <span className="mono text-[11px]" style={{ color: "var(--evidence)" }}>{labels.primaryPaths}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-3" aria-label={labels.configuredPaths}>
              {sources.map((source) => (
                <span key={source} className="mono text-[11px]" style={{ color: "color-mix(in srgb, var(--text) 66%, transparent)" }}>
                  {source}
                </span>
              ))}
            </div>
            <p className="mt-5 max-w-[620px] text-[12px] leading-6" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
              {labels.coverageNote}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between sm:py-16" aria-label={labels.nextStep}>
          <div>
            <p className="mono text-[11px] tracking-[0.16em]" style={{ color: "var(--evidence)" }}>{labels.nextStep}</p>
            <p className="mt-3 max-w-[540px] text-[20px] leading-8 tracking-[-0.01em]" style={{ color: "var(--text)" }}>
              {labels.nextText}
            </p>
          </div>
          <ActionLinks labels={labels} publicLabels={publicLabels} />
        </section>

        <footer className="flex flex-col gap-5 border-t py-7 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}>
          <p className="mono text-[11px]" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
            {labels.footerNote}
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={labels.footer}>
            {[
              [publicLabels.apiDocs, "/docs"],
              [publicLabels.terms, "/terms"],
              [publicLabels.privacy, "/privacy"],
              [publicLabels.security, "/security"]
            ].map(([label, href]) => (
              <Link key={href} href={href} prefetch={false} className="min-h-11 py-3 text-[12px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "color-mix(in srgb, var(--text) 58%, transparent)" }}>
                {label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </main>
  );
}
