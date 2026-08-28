"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";

export function LocaleSwitcher({ current, label = "Language" }: Readonly<{ current: string; label?: string }>) {
  const [pending, startTransition] = useTransition();

  function handleSelect(locale: "en" | "ja") {
    startTransition(async () => {
      await setLocale(locale);
    });
  }

  return (
    <div className="flex items-center gap-1" aria-label={label} role="group">
      {(["en", "ja"] as const).map((locale) => {
        const selected = current === locale;
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={selected}
            disabled={pending}
            onClick={() => handleSelect(locale)}
            className="mono min-h-11 min-w-11 border px-3 text-[12px] uppercase tracking-[0.12em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none"
            style={{
              background: selected ? "var(--signal-wash)" : "transparent",
              borderColor: selected ? "var(--signal)" : "var(--line-soft)",
              color: selected ? "var(--signal)" : "var(--text-secondary)"
            }}
          >
            {locale === "en" ? "EN" : "JA"}
          </button>
        );
      })}
    </div>
  );
}
