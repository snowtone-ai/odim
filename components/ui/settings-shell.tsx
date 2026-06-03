"use client";

import { useState, useEffect } from "react";
import { Panel } from "@/components/ui/panel";

export type SettingsSection = Readonly<{
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}>;

// ── Sidebar icons ──────────────────────────────────────────────────────────────

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export const SETTINGS_ICONS = {
  alertRules: (
    <Icon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  ),
  apiKeys: (
    <Icon path="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  ),
  permissions: (
    <Icon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  ),
  customKnowledge: (
    <Icon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  ),
  ingestion: (
    <Icon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  ),
  auditLog: (
    <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  ),
  ontology: (
    <Icon path="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  ),
  language: (
    <Icon path="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  )
} as const;

// ── Shell ──────────────────────────────────────────────────────────────────────

export function SettingsShell({
  sections
}: Readonly<{ sections: readonly SettingsSection[] }>) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  // Keyboard navigation for sidebar
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const currentIdx = sections.findIndex((s) => s.id === activeId);
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const next = Math.min(currentIdx + 1, sections.length - 1);
        setActiveId(sections[next].id);
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prev = Math.max(currentIdx - 1, 0);
        setActiveId(sections[prev].id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, sections]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Mobile dropdown (visible on small screens) */}
      <div className="lg:hidden">
        <select
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="mono w-full rounded-[var(--radius-md)] px-3 py-2.5 text-[12px] uppercase tracking-[0.08em] outline-none"
          style={{
            background: "var(--ink-800)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-sm)"
          }}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      {/* Desktop sidebar (sticky) */}
      <nav
        className="hidden shrink-0 overflow-hidden rounded-[var(--radius-lg)] lg:block lg:sticky lg:top-6"
        style={{
          width: 224,
          background: "var(--ink-800)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-inset), var(--shadow-sm)",
          backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.016) 0%, transparent 64px)"
        }}
      >
        {sections.map((section, idx) => {
          const isActive = section.id === activeId;
          const isLast = idx === sections.length - 1;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveId(section.id)}
              className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-all duration-[var(--dur-fast)] hover:bg-white/[0.03]"
              style={{
                background: isActive ? "rgba(201,169,97,0.07)" : "transparent",
                borderBottom: isLast ? "none" : "1px solid var(--line-faint)",
                borderLeft: isActive ? "2px solid var(--rune)" : "2px solid transparent",
                paddingLeft: isActive ? "calc(0.875rem - 0px)" : "calc(0.875rem + 2px)"
              }}
            >
              <span
                className="mt-0.5 shrink-0 transition-colors duration-[var(--dur-fast)]"
                style={{ color: isActive ? "var(--rune)" : "var(--text-tertiary)" }}
              >
                {section.icon}
              </span>
              <div className="min-w-0">
                <div
                  className="text-[12px] font-medium leading-tight transition-colors duration-[var(--dur-fast)]"
                  style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
                >
                  {section.title}
                </div>
                <div
                  className="mt-0.5 line-clamp-2 text-[10px] leading-snug"
                  style={{ color: "var(--text-quaternary)" }}
                >
                  {section.description}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Content panel */}
      <div className="min-w-0 flex-1">
        {active ? <Panel title={active.title}>{active.content}</Panel> : null}
      </div>
    </div>
  );
}
