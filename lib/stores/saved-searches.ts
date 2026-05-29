import { randomUUID } from "node:crypto";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SavedSearch = {
  id: string;
  name: string;
  type: "huginn" | "entity" | "alert";
  query: string;
  filters: Record<string, string>;
  createdAt: string;
};

type SavedSearchStore = {
  entries: SavedSearch[];
  save: (entry: Omit<SavedSearch, "id" | "createdAt">) => void;
  remove: (id: string) => void;
  forType: (type: SavedSearch["type"]) => SavedSearch[];
};

const MAX_ENTRIES = 100;

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return randomUUID();
}

export const useSavedSearches = create<SavedSearchStore>()(
  persist(
    (set, get) => ({
      entries: [],
      save: (entry) =>
        set((state) => {
          const next = [
            {
              ...entry,
              id: uuid(),
              createdAt: new Date().toISOString()
            },
            ...state.entries.filter((item) => !(item.type === entry.type && item.name === entry.name))
          ].slice(0, MAX_ENTRIES);
          return { entries: next };
        }),
      remove: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
      forType: (type) => get().entries.filter((entry) => entry.type === type)
    }),
    { name: "odim-saved-searches" }
  )
);
