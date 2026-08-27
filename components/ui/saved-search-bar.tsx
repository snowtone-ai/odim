"use client";

import { Star, X } from "lucide-react";
import { useSavedSearches, type SavedSearch } from "@/lib/stores/saved-searches";

export function SavedSearchBar({
  type,
  currentQuery,
  currentFilters,
  onApply
}: Readonly<{
  type: SavedSearch["type"];
  currentQuery: string;
  currentFilters: Record<string, string>;
  onApply: (entry: SavedSearch) => void;
}>) {
  const { forType, remove, save } = useSavedSearches();
  const entries = forType(type);

  function saveCurrent() {
    if (!currentQuery.trim()) return;
    save({ type, name: currentQuery.trim().slice(0, 24), query: currentQuery.trim(), filters: currentFilters });
  }

  return (
    <div className="mt-2 flex min-h-11 items-center gap-2 overflow-x-auto py-1" aria-label="Saved searches">
      <button
        type="button"
        onClick={saveCurrent}
        disabled={!currentQuery.trim()}
        aria-label="Save current search"
        title="Save current search"
        className="odim-control odim-icon-control h-11 w-11 shrink-0 disabled:cursor-not-allowed"
        style={{ color: currentQuery.trim() ? "var(--signal)" : "var(--text-tertiary)" }}
      >
        <Star size={15} />
      </button>
      {entries.length ? <span className="mono shrink-0 text-[11px]" style={{ color: "var(--text-tertiary)" }}>Saved</span> : null}
      {entries.map((entry) => (
        <div key={entry.id} className="flex min-h-11 shrink-0 items-center border" style={{ borderColor: "var(--line-soft)" }}>
          <button type="button" onClick={() => onApply(entry)} className="min-h-11 px-3 text-left text-[11px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "var(--text-secondary)" }}>
            {entry.name}
          </button>
          <button type="button" onClick={() => remove(entry.id)} aria-label={`Remove saved search ${entry.name}`} className="odim-icon-control h-11 w-11 border-l" style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
