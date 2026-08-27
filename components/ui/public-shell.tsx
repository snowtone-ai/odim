import Link from "next/link";
import { OdimLogo } from "@/components/ui/odim-logo";

type PublicNavProps = {
  showAuthActions?: boolean;
};

const publicLinks = [
  ["API Docs", "/docs"],
  ["Security", "/security"]
] as const;

function PublicHeader({ showAuthActions = true }: PublicNavProps) {
  return (
    <header
      className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-5 border-b py-4 sm:py-5"
      style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}
    >
      <Link
        href="/"
        prefetch={false}
        className="group flex min-h-11 items-center gap-3 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
        aria-label="Odim home"
      >
        <OdimLogo size={28} className="shrink-0 transition-opacity duration-[var(--motion-micro)] group-hover:opacity-80" />
        <span className="text-[14px] font-semibold tracking-[0.18em]" style={{ color: "var(--text)" }}>
          ODIM
        </span>
        <span
          className="hidden text-[11px] tracking-[0.16em] sm:inline"
          style={{ color: "color-mix(in srgb, var(--text) 50%, transparent)" }}
        >
          REALITY INTELLIGENCE
        </span>
      </Link>

      <div className="flex items-center gap-4 sm:gap-6">
        <nav className="hidden items-center gap-5 md:flex" aria-label="Public navigation">
          {publicLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="min-h-11 rounded-[4px] py-3 text-[12px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
              style={{ color: "color-mix(in srgb, var(--text) 64%, transparent)" }}
            >
              {label}
            </Link>
          ))}
        </nav>
        {showAuthActions ? (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="min-h-11 rounded-[4px] px-1 py-3 text-[12px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
              style={{ color: "color-mix(in srgb, var(--text) 70%, transparent)" }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="hidden min-h-11 items-center border px-3 py-2 text-[12px] transition-[background-color,border-color,transform] duration-[var(--motion-micro)] hover:border-[var(--signal)] hover:bg-[color-mix(in_srgb,var(--signal)_12%,transparent)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] sm:flex"
              style={{ borderColor: "color-mix(in srgb, var(--text) 26%, transparent)", color: "var(--text)" }}
            >
              Create workspace
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer
      className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 border-t py-7 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}
    >
      <p className="mono text-[11px]" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
        Source-backed intelligence for the physical economy.
      </p>
      <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Public pages">
        {[
          ["Home", "/"],
          ["API Docs", "/docs"],
          ["Terms", "/terms"],
          ["Privacy", "/privacy"],
          ["Security", "/security"]
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className="min-h-11 rounded-[4px] py-3 text-[12px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
            style={{ color: "color-mix(in srgb, var(--text) 58%, transparent)" }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}

type PublicShellProps = {
  title: string;
  children: React.ReactNode;
};

// Shared chrome for public (pre-auth) content pages: /docs, /terms, /privacy, /security.
export function PublicShell({ title, children }: Readonly<PublicShellProps>) {
  return (
    <main className="min-h-screen bg-[var(--field)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 sm:px-8 lg:px-12">
        <PublicHeader />
        <div className="flex flex-1 justify-center">
          <article className="w-full max-w-[800px] pb-20 pt-12 sm:pt-16">
            <div className="border-b pb-8" style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}>
              <p className="mono text-[11px] tracking-[0.16em]" style={{ color: "var(--evidence)" }}>
                ODIM / PUBLIC RECORD
              </p>
              <h1 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.02em] sm:text-4xl" style={{ color: "var(--text)" }}>
                {title}
              </h1>
            </div>
            {children}
          </article>
        </div>
        <PublicFooter />
      </div>
    </main>
  );
}

type PublicAuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function PublicAuthShell({ eyebrow, title, description, children, footer }: Readonly<PublicAuthShellProps>) {
  return (
    <main className="min-h-screen bg-[var(--field)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 sm:px-8 lg:px-12">
        <PublicHeader />
        <div className="flex flex-1 items-center justify-center py-12 sm:py-16">
          <section className="grid w-full max-w-[980px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:gap-16">
            <div className="self-center">
              <p className="mono text-[11px] tracking-[0.16em]" style={{ color: "var(--evidence)" }}>
                {eyebrow}
              </p>
              <h1 className="mt-4 max-w-[560px] text-3xl font-medium leading-tight tracking-[-0.02em] sm:text-4xl" style={{ color: "var(--text)" }}>
                {title}
              </h1>
              <p className="mt-5 max-w-[480px] text-[15px] leading-7" style={{ color: "color-mix(in srgb, var(--text) 68%, transparent)" }}>
                {description}
              </p>
              <div className="mt-8 flex items-center gap-3 text-[12px]" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
                <span className="h-px w-8" style={{ background: "var(--evidence)" }} />
                <span>Source → entity → action</span>
              </div>
            </div>

            <div
              className="border-y py-7 lg:border-y-0 lg:border-l lg:py-2 lg:pl-10"
              style={{ borderColor: "color-mix(in srgb, var(--text) 16%, transparent)" }}
            >
              {children}
            </div>
          </section>
        </div>
        <div className="border-t py-5" style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}>
          {footer}
        </div>
        <PublicFooter />
      </div>
    </main>
  );
}

// Simple prose renderer for legal pages: heading + paragraphs per section.
export function ProseSections({ sections }: { sections: { heading: string; body: string[] }[] }) {
  return (
    <>
      {sections.map((section) => (
        <section
          key={section.heading}
          className="mt-8 border-t pt-7 sm:mt-10"
          style={{ borderColor: "color-mix(in srgb, var(--text) 12%, transparent)" }}
        >
          <h2 className="text-base font-semibold leading-6" style={{ color: "var(--text)" }}>
            {section.heading}
          </h2>
          {section.body.map((paragraph, index) => (
            <p
              key={index}
              className="mt-3 text-[14px] leading-7"
              style={{ color: "color-mix(in srgb, var(--text) 72%, transparent)" }}
            >
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
