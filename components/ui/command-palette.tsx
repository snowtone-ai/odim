"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trapDialogFocus } from "@/components/ui/modal-focus";

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
    noResults: string;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const allResults = useMemo<Result[]>(
    () => [
      ...entities.map((e) => ({ id: e.id, label: e.name, type: "entity" as const, href: `/entity?id=${e.id}` })),
      ...alerts.map((a) => ({ id: a.title, label: a.title, type: "alert" as const, href: "/alerts" })),
      ...SETTINGS_ITEMS
    ],
    [entities, alerts]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => normalizedQuery
      ? allResults.filter((r) => r.label.toLowerCase().includes(normalizedQuery))
      : allResults.slice(0, 12),
    [allResults, normalizedQuery]
  );
  const grouped = useMemo(() => ({
    entity: filtered.filter((r) => r.type === "entity"),
    alert: filtered.filter((r) => r.type === "alert"),
    setting: filtered.filter((r) => r.type === "setting")
  }), [filtered]);
  const flat = useMemo(
    () => [...grouped.entity, ...grouped.alert, ...grouped.setting],
    [grouped]
  );

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setCursor(0);
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
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      previousActiveRef.current?.focus();
    };
  }, [open]);

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

  useEffect(() => {
    function onOpenRequest() {
      openPalette();
    }

    window.addEventListener("odim:open-command", onOpenRequest);
    return () => window.removeEventListener("odim:open-command", onOpenRequest);
  }, [openPalette]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={labels.hint}
      className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none border-0 p-0"
      style={{ background: "rgba(5,7,9,0.86)" }}
      onKeyDown={trapDialogFocus}
      onCancel={(event) => { event.preventDefault(); closePalette(); }}
    >
      <div className="flex h-full items-start justify-center pt-[12vh]" onClick={closePalette}>
      <div
        data-testid="command-palette"
        className="w-full max-w-lg overflow-hidden border"
        style={{
          background: "var(--surface, var(--ink-850, #131d26))",
          borderColor: "var(--line-soft, rgba(255,255,255,.12))",
          boxShadow: "0 18px 48px rgba(0,0,0,.38)"
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
            className="shrink-0" style={{ color: "var(--text-secondary, #8d97ab)" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder={labels.hint}
            aria-label={labels.hint}
            className="flex-1 py-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal,#4c90f0)]"
            style={{ background: "transparent", color: "var(--text, var(--text-primary, #e8eff2))" }}
          />
          <kbd
            className="mono shrink-0 rounded-[4px] px-1.5 py-0.5 text-[11px]"
            style={{ background: "var(--field, var(--ink-700, #1c212b))", color: "var(--text-secondary, #8d97ab)", border: "1px solid var(--line-faint, rgba(255,255,255,.06))" }}
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
                  className="mono px-5 py-2 text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-secondary, #8d97ab)" }}
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
                      className="flex min-h-11 w-full items-center gap-3 px-5 py-2.5 text-left text-[13px] transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-[var(--signal,#4c90f0)] motion-reduce:transition-none"
                      style={{
                        background: cursor === idx ? "color-mix(in srgb, var(--signal, #4c90f0) 12%, transparent)" : "transparent",
                        color: cursor === idx ? "var(--signal, #4c90f0)" : "var(--text, var(--text-primary, #e8eff2))",
                        borderLeft: cursor === idx ? "2px solid var(--signal, #4c90f0)" : "2px solid transparent"
                      }}
                    >
                      <span style={{ color: cursor === idx ? "var(--signal, #4c90f0)" : "var(--text-secondary, #8d97ab)" }}>
                        {TYPE_ICONS[item.type]}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {cursor === idx && (
                        <span className="mono shrink-0 text-[11px]" style={{ color: "var(--text-secondary, #8d97ab)" }}>↵</span>
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
                style={{ color: "var(--text-secondary, #8d97ab)" }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-[13px]" style={{ color: "var(--text-secondary, #8d97ab)" }}>
                {labels.noResults} &ldquo;{query}&rdquo;
              </span>
            </div>
          )}
        </div>
      </div>
      </div>
    </dialog>
  );
}
