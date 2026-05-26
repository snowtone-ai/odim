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
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          placeholder={labels.hint}
          className="w-full px-5 py-4 text-[14px] outline-none"
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            borderBottom: "1px solid var(--line-faint)"
          }}
        />
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
                      className="flex w-full items-center px-5 py-3 text-left text-[13px] transition-all duration-[var(--dur-fast)]"
                      style={{
                        background: cursor === idx ? "var(--rune-wash)" : "transparent",
                        color: cursor === idx ? "var(--rune)" : "var(--text-primary)",
                        borderLeft: cursor === idx ? "2px solid var(--rune)" : "2px solid transparent"
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {flat.length === 0 && (
            <div className="px-5 py-6 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              —
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
