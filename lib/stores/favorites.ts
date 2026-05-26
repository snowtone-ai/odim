import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FavoriteCategory = "entity" | "sector" | "region";

export type FavoriteItem = {
  id: string;
  category: FavoriteCategory;
  label: string;
  addedAt: string;
};

type FavoritesState = {
  items: FavoriteItem[];
  add: (item: Omit<FavoriteItem, "addedAt">) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  byCategory: (category: FavoriteCategory) => FavoriteItem[];
};

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((state) => {
          if (state.items.some((i) => i.id === item.id)) return state;
          return { items: [...state.items, { ...item, addedAt: new Date().toISOString() }] };
        }),
      remove: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      has: (id) => get().items.some((i) => i.id === id),
      byCategory: (category) => get().items.filter((i) => i.category === category)
    }),
    { name: "odim-favorites" }
  )
);
