"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export function KeyboardNav() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

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

  if (!showHelp) return null;

  const shortcuts: Array<{ keys: string[]; desc: string }> = [
    { keys: ["g", "m"], desc: "Map" },
    { keys: ["g", "e"], desc: "Entity" },
    { keys: ["g", "a"], desc: "Alerts" },
    { keys: ["g", "h"], desc: "Huginn" },
    { keys: ["g", "s"], desc: "Settings" },
    { keys: ["⌘", "K"], desc: "Command palette" },
    { keys: ["/"], desc: "Focus search" },
    { keys: ["j", "k"], desc: "Navigate list" },
    { keys: ["↵"], desc: "Open selected" },
    { keys: ["e"], desc: "Export" },
    { keys: ["r"], desc: "Refresh" },
    { keys: ["Esc"], desc: "Close / dismiss" },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
      onClick={() => setShowHelp(false)}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] p-5"
        style={{ background: "var(--ink-850)", border: "1px solid var(--line-soft)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mono mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--rune)" }}>
          <span>Keyboard Shortcuts</span>
          <kbd
            className="rounded-[4px] px-1.5 py-0.5 text-[10px] normal-case tracking-normal"
            style={{ background: "var(--ink-700)", color: "var(--text-quaternary)", border: "1px solid var(--line-faint)" }}
          >?</kbd>
        </div>
        <div className="grid gap-1.5">
          {shortcuts.map((s) => (
            <div key={s.desc} className="flex items-center justify-between py-1">
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{s.desc}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="mono inline-flex min-w-[22px] items-center justify-center rounded-[4px] px-1.5 py-0.5 text-[10px]"
                    style={{ background: "var(--ink-700)", color: "var(--text-tertiary)", border: "1px solid var(--line-faint)" }}
                  >{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
