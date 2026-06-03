"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type ExportType = "entities" | "alerts" | "signals";

export function ExportButton({
  type,
  label = "Export"
}: Readonly<{
  type: ExportType;
  label?: string;
}>) {
  const [open, setOpen] = useState(false);

  function download(format: "csv" | "json") {
    window.location.href = `/api/export?type=${type}&format=${format}&timeRange=30d`;
    setOpen(false);
  }

  useEffect(() => {
    function onExport() {
      download("csv");
    }
    window.addEventListener("odim:export", onExport);
    return () => window.removeEventListener("odim:export", onExport);
  });

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors"
        style={{
          background: "var(--surface-secondary)",
          border: "1px solid var(--line-faint)",
          color: "var(--text-secondary)"
        }}
      >
        <Download size={14} />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-[60] mt-1 min-w-[88px] overflow-hidden rounded-[var(--radius-sm)]"
          style={{
            background: "var(--ink-800)",
            border: "1px solid var(--line-faint)",
            boxShadow: "var(--shadow-lg)"
          }}
        >
          {(["csv", "json"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => download(format)}
              className="mono block w-full px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em]"
              style={{ color: "var(--text-secondary)", borderBottom: format === "csv" ? "1px solid var(--line-faint)" : "none" }}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
