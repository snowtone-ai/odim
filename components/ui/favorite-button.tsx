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
  const actionLabel = active ? `Remove ${label} from watchlist` : `Add ${label} to watchlist`;

  return (
    <button
      type="button"
      onClick={() => (active ? remove(id) : add({ id, category, label }))}
      className="odim-icon-control h-11 w-11 shrink-0 transition-colors duration-[var(--motion-micro)]"
      aria-label={actionLabel}
      aria-pressed={active}
      title={actionLabel}
      style={{ color: active ? "var(--evidence)" : "var(--text-tertiary)" }}
    >
      <Star size={size} fill={active ? "currentColor" : "none"} strokeWidth={1.6} />
    </button>
  );
}
