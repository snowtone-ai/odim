import { create } from "zustand";
import { persist } from "zustand/middleware";

type AlertStateStore = {
  readAlertIds: string[];
  markRead: (id: string) => void;
  markAllRead: (allIds: string[]) => void;
  isUnread: (id: string) => boolean;
  unreadCount: (allIds: string[]) => number;
};

export const useAlertState = create<AlertStateStore>()(
  persist(
    (set, get) => ({
      readAlertIds: [],
      markRead: (id) =>
        set((state) => {
          if (state.readAlertIds.includes(id)) return state;
          return { readAlertIds: [...state.readAlertIds, id] };
        }),
      markAllRead: (allIds) =>
        set((state) => {
          const existing = new Set(state.readAlertIds);
          for (const id of allIds) existing.add(id);
          return { readAlertIds: Array.from(existing) };
        }),
      isUnread: (id) => !get().readAlertIds.includes(id),
      unreadCount: (allIds) => allIds.filter((id) => !get().readAlertIds.includes(id)).length
    }),
    { name: "odim-alert-state" }
  )
);
