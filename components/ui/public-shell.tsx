import Link from "next/link";
import { OdimLogo } from "@/components/ui/odim-logo";

// Shared chrome for public (pre-auth) content pages: /docs, /terms, /privacy, /security.

export function PublicShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen" style={{ background: "var(--ink-950)" }}>
      <header
        className="flex items-center justify-between px-6 py-4 md:px-12"
        style={{ borderBottom: "1px solid var(--line-faint)" }}
      >
        <Link href="/" className="flex items-center gap-3">
          <OdimLogo size={26} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Odim
          </span>
          <span className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-quaternary)" }}>
            Reality Intelligence OS
          </span>
        </Link>
        <Link href="/login" className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Sign in
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-6 pb-20 pt-14 md:px-12">
        <h1
          className="text-3xl leading-tight md:text-4xl"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-spectral)" }}
        >
          {title}
        </h1>
        {children}
      </article>

      <footer
        className="mx-auto max-w-3xl px-6 py-10 md:px-12"
        style={{ borderTop: "1px solid var(--line-faint)" }}
      >
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Public pages">
          {[
            ["Home", "/"],
            ["API Docs", "/docs"],
            ["Terms", "/terms"],
            ["Privacy", "/privacy"],
            ["Security", "/security"]
          ].map(([label, href]) => (
            <Link key={href} href={href} className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {label}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  );
}

// Simple prose renderer for legal pages: heading + paragraphs per section.
export function ProseSections({ sections }: { sections: { heading: string; body: string[] }[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {section.heading}
          </h2>
          {section.body.map((paragraph, index) => (
            <p
              key={index}
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
