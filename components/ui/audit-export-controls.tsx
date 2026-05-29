"use client";

import { useState } from "react";

export function AuditExportControls() {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);

  function trigger(format: "csv" | "json") {
    window.location.href = `/api/audit-export?start=${start}&end=${end}&format=${format}`;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <span className="mono uppercase tracking-[0.1em]">Start</span>
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="rounded px-2 py-1.5" style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)" }} />
      </label>
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <span className="mono uppercase tracking-[0.1em]">End</span>
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="rounded px-2 py-1.5" style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)" }} />
      </label>
      <button type="button" onClick={() => trigger("csv")} className="mono rounded px-3 py-2 text-[10px] uppercase tracking-[0.1em]" style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)", color: "var(--text-secondary)" }}>
        CSV
      </button>
      <button type="button" onClick={() => trigger("json")} className="mono rounded px-3 py-2 text-[10px] uppercase tracking-[0.1em]" style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)", color: "var(--text-secondary)" }}>
        JSON
      </button>
    </div>
  );
}
