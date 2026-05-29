import { create } from "zustand";
import { persist } from "zustand/middleware";
import { randomUUID } from "node:crypto";

export type QueryHistoryEntry = {
  id: string;
  question: string;
  timestamp: string;
  confidence: number | null;
};

type QueryHistoryStore = {
  entries: QueryHistoryEntry[];
  addEntry: (entry: Omit<QueryHistoryEntry, "id">) => void;
  clearHistory: () => void;
};

const MAX_ENTRIES = 50;

export const useQueryHistory = create<QueryHistoryStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => {
          const newEntry: QueryHistoryEntry = {
            ...entry,
            id: typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : randomUUID()
          };
          const updated = [newEntry, ...state.entries].slice(0, MAX_ENTRIES);
          return { entries: updated };
        }),
      clearHistory: () => set({ entries: [] })
    }),
    { name: "odim-query-history" }
  )
);
