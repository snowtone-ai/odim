import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HuginnPreset } from "@/lib/huginn/presets";
import { HUGINN_PRESETS } from "@/lib/huginn/presets";

export type CustomTemplate = {
  id: string;
  label: string;
  template: string;
  variables?: string[];
};

type HuginnTemplateStore = {
  customs: CustomTemplate[];
  disabledDefaults: string[];
  add: (entry: Omit<CustomTemplate, "id">) => void;
  update: (id: string, patch: Partial<Omit<CustomTemplate, "id">>) => void;
  remove: (id: string) => void;
  toggleDefault: (presetId: string) => void;
  allPresets: () => HuginnPreset[];
};

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useHuginnTemplates = create<HuginnTemplateStore>()(
  persist(
    (set, get) => ({
      customs: [],
      disabledDefaults: [],
      add: (entry) =>
        set((state) => ({
          customs: [...state.customs, { ...entry, id: uid() }]
        })),
      update: (id, patch) =>
        set((state) => ({
          customs: state.customs.map((c) => (c.id === id ? { ...c, ...patch } : c))
        })),
      remove: (id) =>
        set((state) => ({ customs: state.customs.filter((c) => c.id !== id) })),
      toggleDefault: (presetId) =>
        set((state) => ({
          disabledDefaults: state.disabledDefaults.includes(presetId)
            ? state.disabledDefaults.filter((d) => d !== presetId)
            : [...state.disabledDefaults, presetId]
        })),
      allPresets: () => {
        const { customs, disabledDefaults } = get();
        const defaults: HuginnPreset[] = HUGINN_PRESETS
          .filter((p) => !disabledDefaults.includes(p.id))
          .map((p) => p);
        const custom: HuginnPreset[] = customs.map((c) => ({
          id: c.id,
          label: c.label,
          labelJa: c.label,
          icon: "message-square",
          template: c.template,
          templateJa: c.template,
          variables: c.variables
        }));
        return [...defaults, ...custom];
      }
    }),
    { name: "odim-huginn-templates" }
  )
);
