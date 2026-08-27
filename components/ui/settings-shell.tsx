"use client";

import { useEffect, useMemo, useState } from "react";

export type SettingsSection = Readonly<{
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}>;

type CategoryKey = "gettingStarted" | "signals" | "data" | "access" | "audit";
type CategoryLabels = Readonly<Record<CategoryKey, string>>;

const DEFAULT_CATEGORY_LABELS: CategoryLabels = {
  gettingStarted: "Getting started",
  signals: "Signals & workflows",
  data: "Data & knowledge",
  access: "Access & workspace",
  audit: "Audit"
};

function categoryFor(id: string): CategoryKey {
  if (id === "gettingStarted") return "gettingStarted";
  if (["alertRules", "watchtower", "webhook"].includes(id)) return "signals";
  if (["customKnowledge", "muninReview", "huginnTemplates", "ingestion", "sourceHealth", "ontology"].includes(id)) return "data";
  if (["apiKeys", "permissions", "billing", "language"].includes(id)) return "access";
  return "audit";
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export const SETTINGS_ICONS = {
  alertRules: <Icon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  apiKeys: <Icon path="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
  permissions: <Icon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  customKnowledge: <Icon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
  ingestion: <Icon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  auditLog: <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  ontology: <Icon path="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
  language: <Icon path="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
} as const;

function SectionButton({
  section,
  active,
  onSelect,
  surfacePrefix
}: Readonly<{
  section: SettingsSection;
  active: boolean;
  onSelect: () => void;
  surfacePrefix: string;
}>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`settings-work-surface-${surfacePrefix}-${section.id}`}
      onClick={onSelect}
      className="group flex min-h-11 w-full items-center gap-3 border-b px-3 text-left transition-colors duration-[120ms] ease-[var(--ease-primary)] last:border-b-0 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--signal)] motion-reduce:transition-none"
      style={{
        borderColor: "var(--line-faint)",
        borderLeft: active ? "2px solid var(--signal)" : "2px solid transparent",
        background: active ? "var(--signal-wash)" : "transparent"
      }}
    >
      <span style={{ color: active ? "var(--signal)" : "var(--text-tertiary)" }}>{section.icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {section.title}
      </span>
      <span aria-hidden="true" className="text-[14px]" style={{ color: active ? "var(--signal)" : "var(--text-quaternary)" }}>
        {active ? "·" : ""}
      </span>
    </button>
  );
}

function CategoryIndex({
  sections,
  activeId,
  labels,
  onSelect,
  mobile = false,
  surfacePrefix
}: Readonly<{
  sections: readonly SettingsSection[];
  activeId: string;
  labels: CategoryLabels;
  onSelect: (id: string) => void;
  mobile?: boolean;
  surfacePrefix: string;
}>) {
  const groups = useMemo(() => {
    const grouped = new Map<CategoryKey, SettingsSection[]>();
    for (const section of sections) {
      const category = categoryFor(section.id);
      const existing = grouped.get(category);
      if (existing) existing.push(section);
      else grouped.set(category, [section]);
    }
    return [...grouped.entries()];
  }, [sections]);

  return (
    <nav aria-label="Settings categories" className={mobile ? "" : "sticky top-4"}>
      <div className="mono mb-2 px-3 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
        {mobile ? "Categories" : "Workspace controls"}
      </div>
      <div role="tablist" aria-orientation="vertical" className="border-y" style={{ borderColor: "var(--line-soft)" }}>
        {groups.map(([category, entries]) => (
          <div key={category}>
            <div className="mono border-b px-3 py-2 text-[11px] uppercase tracking-[0.1em]" style={{ borderColor: "var(--line-faint)", color: "var(--text-quaternary)" }}>
              {labels[category]}
            </div>
            {entries.map((section) => (
              <SectionButton key={section.id} section={section} active={section.id === activeId} onSelect={() => onSelect(section.id)} surfacePrefix={surfacePrefix} />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function Surface({ section, surfacePrefix }: Readonly<{ section?: SettingsSection; surfacePrefix: string }>) {
  if (!section) {
    return (
      <div className="border-y px-4 py-8 text-sm" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>
        No settings surface is available.
      </div>
    );
  }

  return (
    <section id={`settings-work-surface-${surfacePrefix}-${section.id}`} role="tabpanel" aria-label={section.title} aria-live="polite" className="min-w-0 border-y" style={{ borderColor: "var(--line-soft)" }}>
      <header className="border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--line-soft)" }}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0" style={{ color: "var(--signal)" }}>{section.icon}</span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-[-0.01em]" style={{ color: "var(--text-primary)" }}>{section.title}</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{section.description}</p>
          </div>
        </div>
      </header>
      <div className="p-4 sm:p-5">{section.content}</div>
    </section>
  );
}

export function SettingsShell({
  sections,
  categoryLabels = DEFAULT_CATEGORY_LABELS
}: Readonly<{
  sections: readonly SettingsSection[];
  categoryLabels?: Partial<CategoryLabels>;
}>) {
  const labels = useMemo<CategoryLabels>(() => ({ ...DEFAULT_CATEGORY_LABELS, ...categoryLabels }), [categoryLabels]);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = sections.find((section) => section.id === activeId) ?? sections[0];

  useEffect(() => {
    if (sections.length && !sections.some((section) => section.id === activeId)) setActiveId(sections[0].id);
  }, [activeId, sections]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) || target.isContentEditable)) return;
      const current = sections.findIndex((section) => section.id === activeId);
      if (current < 0 || !sections.length) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setActiveId(sections[Math.min(current + 1, sections.length - 1)].id);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setActiveId(sections[Math.max(current - 1, 0)].id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, sections]);

  function selectSection(id: string, openMobile = false) {
    setActiveId(id);
    if (openMobile) setMobileOpen(true);
  }

  return (
    <div className="min-w-0">
      <div className="hidden gap-6 lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <CategoryIndex sections={sections} activeId={activeId} labels={labels} onSelect={(id) => selectSection(id)} surfacePrefix="desktop" />
        <Surface section={active} surfacePrefix="desktop" />
      </div>

      <div className="lg:hidden">
        <div className="mb-4 flex items-center gap-2 border-y py-2" style={{ borderColor: "var(--line-soft)" }}>
          {mobileOpen ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="min-h-11 shrink-0 px-2 text-[12px] focus-visible:outline-2 focus-visible:outline-[var(--signal)]"
              style={{ color: "var(--signal)" }}
            >
              ← Categories
            </button>
          ) : null}
          <label className="sr-only" htmlFor="settings-section-select">Settings section</label>
          <select
            id="settings-section-select"
            value={activeId}
            onChange={(event) => selectSection(event.target.value, true)}
            className="min-h-11 min-w-0 flex-1 border px-3 text-[13px] outline-none focus-visible:border-[var(--signal)]"
            style={{ background: "var(--surface-inset)", borderColor: "var(--line-soft)", color: "var(--text-primary)" }}
          >
            {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
        </div>
        {mobileOpen ? (
          <Surface section={active} surfacePrefix="mobile" />
        ) : (
          <CategoryIndex sections={sections} activeId={activeId} labels={labels} onSelect={(id) => selectSection(id, true)} mobile surfacePrefix="mobile" />
        )}
      </div>
    </div>
  );
}
