"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ExportType = "entities" | "alerts" | "signals";

export function ExportButton({
  type,
  label = "Export"
}: Readonly<{
  type: ExportType;
  label?: string;
}>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function download(format: "csv" | "json") {
    window.location.href = `/api/export?type=${type}&format=${format}&timeRange=30d`;
    setOpen(false);
  }

  useEffect(() => {
    function onExport() {
      window.location.href = `/api/export?type=${type}&format=csv&timeRange=30d`;
      setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("odim:export", onExport);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("odim:export", onExport);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [type]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="odim-control inline-flex min-h-11 items-center justify-center gap-2 px-3 text-[11px]"
        style={{ color: open ? "var(--signal)" : "var(--text-secondary)" }}
      >
        <Download size={14} aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open ? (
        <div role="menu" aria-label={`${label} format`} className="absolute right-0 top-full z-[60] mt-1 min-w-[120px] border bg-[var(--surface)]" style={{ borderColor: "var(--line-strong)", boxShadow: "var(--shadow-md)" }}>
          {(["csv", "json"] as const).map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => download(format)}
              className="block min-h-11 w-full border-b px-3 text-left text-[11px] uppercase tracking-[0.1em] last:border-b-0 transition-colors duration-[var(--motion-micro)] hover:bg-[var(--signal-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
              style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
