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
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
      <div
        className="w-full max-w-md rounded-[var(--radius-md)] p-4"
        style={{ background: "var(--ink-850)", border: "1px solid var(--line-faint)" }}
      >
        <div className="mono mb-3 text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--rune)" }}>
          Keyboard Shortcuts
        </div>
        {["g m map", "g e entity", "g a alerts", "g h huginn", "g s settings", "j / k list move", "Enter open", "e export", "r refresh", "/ focus search", "Esc close"].map((line) => (
          <div key={line} className="py-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
