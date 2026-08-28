"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { trapDialogFocus } from "@/components/ui/modal-focus";
import type { Messages } from "@/lib/i18n/messages";

const GO_SHORTCUTS: Record<string, string> = {
  m: "/map",
  e: "/entity",
  a: "/alerts",
  h: "/huginn",
  s: "/settings"
};

function inEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || element.isContentEditable;
}

export function KeyboardNav({ labels }: Readonly<{ labels: Messages["shell"]["keyboard"] }>) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (inEditableTarget(event.target) && event.key !== "Escape") return;
      if (pending === "g" && GO_SHORTCUTS[event.key]) {
        event.preventDefault();
        router.push(GO_SHORTCUTS[event.key]);
        setPending(null);
        return;
      }
      if (event.key === "g") {
        setPending("g");
        return;
      }
      setPending(null);
      if (event.key === "?") {
        event.preventDefault();
        setShowHelp((value) => !value);
      } else if (event.key === "j" || event.key === "k" || event.key === "n" || event.key === "p") {
        window.dispatchEvent(new CustomEvent("odim:list-nav", { detail: { key: event.key } }));
      } else if (event.key === "Enter") {
        window.dispatchEvent(new CustomEvent("odim:list-open"));
      } else if (event.key === "Escape") {
        window.dispatchEvent(new CustomEvent("odim:list-escape"));
        setShowHelp(false);
      } else if (event.key === "e") {
        window.dispatchEvent(new CustomEvent("odim:export"));
      } else if (event.key === "r") {
        router.refresh();
      } else if (event.key === "/") {
        window.dispatchEvent(new CustomEvent("odim:focus-search"));
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, router]);

  useEffect(() => {
    if (!showHelp) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      previousActiveRef.current?.focus();
    };
  }, [showHelp]);

  if (!showHelp) return null;

  const shortcuts: Array<{ keys: string[]; desc: string }> = [
    { keys: ["g", "m"], desc: labels.map },
    { keys: ["g", "e"], desc: labels.entity },
    { keys: ["g", "a"], desc: labels.alerts },
    { keys: ["g", "h"], desc: labels.huginn },
    { keys: ["g", "s"], desc: labels.settings },
    { keys: ["⌘", "K"], desc: labels.commandPalette },
    { keys: ["/"], desc: labels.focusSearch },
    { keys: ["j", "k"], desc: labels.navigateList },
    { keys: ["↵"], desc: labels.openSelected },
    { keys: ["e"], desc: labels.export },
    { keys: ["r"], desc: labels.refresh },
    { keys: ["Esc"], desc: labels.dismiss },
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-label={labels.label}
      className="fixed inset-0 z-[70] m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0"
      style={{ background: "rgba(5,7,9,0.86)" }}
      onKeyDown={trapDialogFocus}
      onCancel={(event) => { event.preventDefault(); setShowHelp(false); }}
    >
      <div className="flex h-full items-center justify-center px-4" onClick={() => setShowHelp(false)}>
      <div
        data-testid="keyboard-help"
        className="w-full max-w-sm overflow-hidden border p-5"
        style={{ background: "var(--surface, var(--ink-850, #131d26))", borderColor: "var(--line-soft, rgba(255,255,255,.12))", boxShadow: "0 18px 48px rgba(0,0,0,.38)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mono mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--signal, #4c90f0)" }}>
          <span>{labels.label}</span>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={labels.close}
            className="odim-icon-control h-11 w-11 text-[18px] normal-case tracking-normal"
            style={{ background: "var(--field, var(--ink-700, #1c212b))", color: "var(--text-secondary, #8d97ab)", border: "1px solid var(--line-faint, rgba(255,255,255,.06))" }}
            onClick={() => setShowHelp(false)}
          >×</button>
        </div>
        <div className="grid gap-1.5">
          {shortcuts.map((s) => (
            <div key={s.desc} className="flex items-center justify-between py-1">
              <span className="text-[12px]" style={{ color: "var(--text, var(--text-primary, #e8eff2))" }}>{s.desc}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="mono inline-flex min-h-11 min-w-[22px] items-center justify-center rounded-[4px] px-1.5 py-0.5 text-[11px]"
                    style={{ background: "var(--field, var(--ink-700, #1c212b))", color: "var(--text-secondary, #8d97ab)", border: "1px solid var(--line-faint, rgba(255,255,255,.06))" }}
                  >{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </dialog>
  );
}
