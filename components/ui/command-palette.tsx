"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Result = {
  id: string;
  label: string;
  type: "entity" | "alert" | "setting";
  href: string;
};

type Props = {
  entities: Array<{ id: string; name: string }>;
  alerts: Array<{ title: string }>;
  labels: {
    hint: string;
    entities: string;
    alerts: string;
    settings: string;
  };
};

const TYPE_ICONS: Record<Result["type"], React.ReactNode> = {
  entity: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7H3l2-4h14l2 4M4 21V10.87M20 21V10.87" />
    </svg>
  ),
  alert: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  setting: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
};

const SETTINGS_ITEMS: Result[] = [
  { id: "s-alerts",   label: "Alert Rules",       type: "setting", href: "/settings" },
  { id: "s-keys",     label: "API Keys",           type: "setting", href: "/settings" },
  { id: "s-permissions", label: "Permissions",    type: "setting", href: "/settings" },
  { id: "s-seed",     label: "Seed Memory",        type: "setting", href: "/settings" },
  { id: "s-audit",    label: "Audit Trail",        type: "setting", href: "/settings" },
  { id: "s-language", label: "Language",           type: "setting", href: "/settings" }
];

export function CommandPalette({ entities, alerts, labels }: Readonly<Props>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allResults: Result[] = [
    ...entities.map((e) => ({ id: e.id, label: e.name, type: "entity" as const, href: `/entity?id=${e.id}` })),
    ...alerts.map((a) => ({ id: a.title, label: a.title, type: "alert" as const, href: "/alerts" })),
    ...SETTINGS_ITEMS
  ];

  const filtered = query.trim()
    ? allResults.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
    : allResults.slice(0, 12);

  const grouped = {
    entity: filtered.filter((r) => r.type === "entity"),
    alert: filtered.filter((r) => r.type === "alert"),
    setting: filtered.filter((r) => r.type === "setting")
  };

  const flat = [...grouped.entity, ...grouped.alert, ...grouped.setting];

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setCursor(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const selectItem = useCallback((item: Result) => {
    router.push(item.href);
    closePalette();
  }, [router, closePalette]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open ? closePalette() : openPalette();
      }
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); closePalette(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === "Enter" && flat[cursor]) { e.preventDefault(); selectItem(flat[cursor]); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flat, cursor, openPalette, closePalette, selectItem]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
      onClick={closePalette}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)]"
        style={{
          background: "var(--ink-850)",
          border: "1px solid var(--line-soft)",
          boxShadow: "var(--shadow-lg)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div
          className="flex items-center gap-3 px-5"
          style={{ borderBottom: "1px solid var(--line-faint)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0" style={{ color: "var(--text-quaternary)" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder={labels.hint}
            className="flex-1 py-4 text-[14px] outline-none"
            style={{ background: "transparent", color: "var(--text-primary)" }}
          />
          <kbd
            className="mono shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px]"
            style={{ background: "var(--ink-700)", color: "var(--text-quaternary)", border: "1px solid var(--line-faint)" }}
          >
            ESC
          </kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {(["entity", "alert", "setting"] as const).map((type) => {
            const items = grouped[type];
            if (!items.length) return null;
            const typeLabel = type === "entity" ? labels.entities : type === "alert" ? labels.alerts : labels.settings;
            return (
              <div key={type}>
                <div
                  className="mono px-5 py-2 text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {typeLabel}
                </div>
                {items.map((item) => {
                  const idx = flat.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setCursor(idx)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13px] transition-all duration-[var(--dur-fast)]"
                      style={{
                        background: cursor === idx ? "var(--rune-wash)" : "transparent",
                        color: cursor === idx ? "var(--rune)" : "var(--text-primary)",
                        borderLeft: cursor === idx ? "2px solid var(--rune)" : "2px solid transparent"
                      }}
                    >
                      <span style={{ color: cursor === idx ? "var(--rune)" : "var(--text-quaternary)" }}>
                        {TYPE_ICONS[item.type]}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {cursor === idx && (
                        <span className="mono shrink-0 text-[10px]" style={{ color: "var(--text-quaternary)" }}>↵</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {flat.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-8">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: "var(--text-quaternary)" }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                No results for &ldquo;{query}&rdquo;
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
