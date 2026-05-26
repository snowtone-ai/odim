"use client";

import { Star } from "lucide-react";
import { useFavorites, type FavoriteCategory } from "@/lib/stores/favorites";

export function FavoriteButton({
  id,
  category,
  label,
  size = 14
}: Readonly<{
  id: string;
  category: FavoriteCategory;
  label: string;
  size?: number;
}>) {
  const { add, remove, has } = useFavorites();
  const active = has(id);

  return (
    <button
      onClick={() => (active ? remove(id) : add({ id, category, label }))}
      className={`grid place-items-center rounded-[var(--radius-sm)] p-1.5 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] ${
        active
          ? "text-[var(--rune)] shadow-[0_0_8px_rgba(201,169,97,0.15)]"
          : "text-[var(--text-quaternary)] hover:text-[var(--rune-dim)] hover:bg-[var(--ink-700)]"
      }`}
      type="button"
      title={active ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star size={size} fill={active ? "currentColor" : "none"} strokeWidth={1.5} />
    </button>
  );
}
