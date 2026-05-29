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
    save({
      type,
      name: currentQuery.trim().slice(0, 24),
      query: currentQuery.trim(),
      filters: currentFilters
    });
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
      <button
        type="button"
        onClick={saveCurrent}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          background: "var(--surface-secondary)",
          border: "1px solid var(--line-faint)",
          color: "var(--rune)"
        }}
      >
        <Star size={12} />
      </button>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex shrink-0 items-center gap-1 rounded-full pl-3 pr-1"
          style={{
            background: "var(--surface-secondary)",
            border: "1px solid var(--line-faint)"
          }}
        >
          <button
            type="button"
            onClick={() => onApply(entry)}
            className="mono py-1 text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "var(--text-secondary)" }}
          >
            {entry.name}
          </button>
          <button type="button" onClick={() => remove(entry.id)} className="flex h-5 w-5 items-center justify-center rounded-full">
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
