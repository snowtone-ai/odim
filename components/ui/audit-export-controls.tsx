"use client";

import { useState } from "react";

export function AuditExportControls() {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);

  function trigger(format: "csv" | "json") {
    window.location.href = "/api/audit-export?start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end) + "&format=" + format;
  }

  return (
    <div className="border-y py-3" style={{ borderColor: "var(--line-soft)" }}>
      <div className="mono mb-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>Export audit events</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-[150px] flex-1 gap-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          <span className="mono uppercase tracking-[0.1em]">Start</span>
          <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="min-h-11 border px-2 text-[12px] outline-none focus-visible:border-[var(--signal)]" style={{ background: "var(--field)", borderColor: "var(--line-soft)", color: "var(--text-primary)" }} />
        </label>
        <label className="grid min-w-[150px] flex-1 gap-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          <span className="mono uppercase tracking-[0.1em]">End</span>
          <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="min-h-11 border px-2 text-[12px] outline-none focus-visible:border-[var(--signal)]" style={{ background: "var(--field)", borderColor: "var(--line-soft)", color: "var(--text-primary)" }} />
        </label>
        <button type="button" onClick={() => trigger("csv")} className="mono min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>CSV</button>
        <button type="button" onClick={() => trigger("json")} className="mono min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>JSON</button>
      </div>
    </div>
  );
}
