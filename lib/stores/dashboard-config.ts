import { randomUUID } from "node:crypto";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WidgetType =
  | "entity-list"
  | "alert-queue"
  | "map-mini"
  | "sparkline-grid"
  | "daily-diff"
  | "sector-rotation"
  | "source-health"
  | "huginn-mini";

export type Widget = {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DashboardConfig = {
  id: string;
  name: string;
  widgets: Widget[];
};

type DashboardStore = {
  dashboards: DashboardConfig[];
  activeId: string;
  editMode: boolean;
  setActive: (id: string) => void;
  toggleEdit: () => void;
  addWidget: (type: WidgetType) => void;
  moveWidget: (id: string, x: number, y: number) => void;
  removeWidget: (id: string) => void;
  saveDashboard: (name: string) => void;
};

const defaultDashboards: DashboardConfig[] = [
  {
    id: "morning-brief",
    name: "Morning Brief",
    widgets: [
      { id: "w1", type: "entity-list", x: 1, y: 1, w: 6, h: 2 },
      { id: "w2", type: "alert-queue", x: 7, y: 1, w: 6, h: 2 },
      { id: "w3", type: "daily-diff", x: 1, y: 3, w: 4, h: 1 },
      { id: "w4", type: "source-health", x: 5, y: 3, w: 4, h: 1 },
      { id: "w5", type: "huginn-mini", x: 9, y: 3, w: 4, h: 1 }
    ]
  },
  {
    id: "sector-monitor",
    name: "Sector Monitor",
    widgets: [
      { id: "w6", type: "sector-rotation", x: 1, y: 1, w: 6, h: 2 },
      { id: "w7", type: "sparkline-grid", x: 7, y: 1, w: 6, h: 2 },
      { id: "w8", type: "map-mini", x: 1, y: 3, w: 8, h: 2 },
      { id: "w9", type: "alert-queue", x: 9, y: 3, w: 4, h: 2 }
    ]
  }
];

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return randomUUID();
}

export const useDashboardConfig = create<DashboardStore>()(
  persist(
    (set, get) => ({
      dashboards: defaultDashboards,
      activeId: defaultDashboards[0].id,
      editMode: false,
      setActive: (id) => set({ activeId: id }),
      toggleEdit: () => set((state) => ({ editMode: !state.editMode })),
      addWidget: (type) =>
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === state.activeId
              ? {
                  ...dashboard,
                  widgets: [...dashboard.widgets, { id: uuid(), type, x: 1, y: dashboard.widgets.length + 1, w: 4, h: 1 }]
                }
              : dashboard
          )
        })),
      moveWidget: (id, x, y) =>
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === state.activeId
              ? {
                  ...dashboard,
                  widgets: dashboard.widgets.map((widget) => (widget.id === id ? { ...widget, x, y } : widget))
                }
              : dashboard
          )
        })),
      removeWidget: (id) =>
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === state.activeId
              ? { ...dashboard, widgets: dashboard.widgets.filter((widget) => widget.id !== id) }
              : dashboard
          )
        })),
      saveDashboard: (name) =>
        set((state) => {
          const active = state.dashboards.find((dashboard) => dashboard.id === state.activeId);
          if (!active) return state;
          const snapshot = { ...active, id: uuid(), name: name.trim() || `${active.name} Copy` };
          return { dashboards: [...state.dashboards, snapshot], activeId: snapshot.id };
        })
    }),
    { name: "odim-dashboard-config" }
  )
);
