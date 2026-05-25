"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";

export function LocaleSwitcher({ current }: Readonly<{ current: string }>) {
  const [pending, startTransition] = useTransition();

  function handleSelect(locale: string) {
    startTransition(async () => {
      await setLocale(locale);
    });
  }

  return (
    <div className="flex gap-2">
      {(["en", "ja"] as const).map((locale) => (
        <button
          className={`mono rounded-[var(--radius-sm)] border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 disabled:opacity-50 ${
            current === locale
              ? "border-[var(--rune)] text-[var(--rune)]"
              : "border-[var(--line-faint)] text-[var(--text-tertiary)] hover:border-[var(--line-soft)] hover:text-[var(--text-secondary)]"
          }`}
          disabled={pending}
          key={locale}
          onClick={() => handleSelect(locale)}
          type="button"
        >
          {locale === "en" ? "EN" : "JA"}
        </button>
      ))}
    </div>
  );
}
