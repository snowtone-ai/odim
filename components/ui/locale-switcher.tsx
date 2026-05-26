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
    <div className="flex gap-1.5">
      {(["en", "ja"] as const).map((locale) => (
        <button
          className={`mono rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] disabled:opacity-40 ${
            current === locale
              ? "bg-[var(--rune-wash)] text-[var(--rune)] shadow-[0_0_8px_rgba(201,169,97,0.1)]"
              : "text-[var(--text-quaternary)] hover:bg-[var(--ink-650)] hover:text-[var(--text-tertiary)]"
          }`}
          style={{
            border: current === locale ? "1px solid rgba(201,169,97,0.2)" : "1px solid var(--line-faint)"
          }}
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
