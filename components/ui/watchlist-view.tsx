"use client";

import { Star, Building2, Globe, Factory, X, Plus } from "lucide-react";
import { useFavorites, type FavoriteCategory, type FavoriteItem } from "@/lib/stores/favorites";
import { useState } from "react";

type WatchlistLabels = {
  entity: string;
  sector: string;
  region: string;
  empty: string;
  add: string;
  addHint: string;
  tracked: string;
};

const CATEGORY_ICONS: Record<FavoriteCategory, React.ElementType> = {
  entity: Building2,
  sector: Factory,
  region: Globe
};

const PRESET_ENTITIES = [
  { id: "preset-msft", label: "Microsoft" },
  { id: "preset-nextera", label: "NextEra Energy" },
  { id: "preset-brookfield", label: "Brookfield Asset Management" },
  { id: "preset-tsmc", label: "TSMC" },
  { id: "preset-equinix", label: "Equinix" },
  { id: "preset-bhp", label: "BHP Group" }
];

const PRESET_SECTORS = [
  { id: "sector-energy", label: "Energy Infrastructure" },
  { id: "sector-compute", label: "Data Centers / Compute" },
  { id: "sector-mining", label: "Mining & Materials" },
  { id: "sector-logistics", label: "Logistics & Ports" },
  { id: "sector-water", label: "Water & Utilities" },
  { id: "sector-realestate", label: "Real Estate / Land" }
];

const PRESET_REGIONS = [
  { id: "region-us", label: "United States" },
  { id: "region-eu", label: "European Union" },
  { id: "region-cn", label: "China" },
  { id: "region-jp", label: "Japan" },
  { id: "region-au", label: "Australia" },
  { id: "region-sa", label: "Saudi Arabia" },
  { id: "region-sg", label: "Singapore" },
  { id: "region-uk", label: "United Kingdom" }
];

function CategorySection({
  category,
  label,
  items,
  presets,
  onAdd,
  onRemove,
  tracked
}: Readonly<{
  category: FavoriteCategory;
  label: string;
  items: FavoriteItem[];
  presets: { id: string; label: string }[];
  onAdd: (item: Omit<FavoriteItem, "addedAt">) => void;
  onRemove: (id: string) => void;
  tracked: string;
}>) {
  const [showPresets, setShowPresets] = useState(false);
  const Icon = CATEGORY_ICONS[category];
  const activeIds = new Set(items.map((i) => i.id));

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={13} strokeWidth={1.5} className="text-[var(--text-quaternary)]" />
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {label}
          </span>
        </div>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] hover:bg-[var(--ink-700)]"
          style={{
            background: showPresets ? "var(--ink-700)" : "var(--ink-750)",
            border: "1px solid var(--line-faint)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
          }}
          type="button"
        >
          <Plus size={11} strokeWidth={2} className={`text-[var(--text-quaternary)] transition-transform duration-[var(--dur-fast)] ${showPresets ? "rotate-45" : ""}`} />
        </button>
      </div>

      {showPresets && (
        <div
          className="animate-fade-in mb-3 grid gap-0.5 rounded-[var(--radius-md)] p-1.5"
          style={{
            background: "var(--ink-850)",
            border: "1px solid var(--line-faint)",
            boxShadow: "var(--shadow-sm)"
          }}
        >
          {presets.filter((p) => !activeIds.has(p.id)).map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onAdd({ id: preset.id, category, label: preset.label });
              }}
              className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-secondary)] transition-all duration-[var(--dur-fast)] hover:bg-[var(--ink-700)] hover:text-[var(--text-primary)]"
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <div className="grid gap-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--ink-750)]"
              style={{
                border: "1px solid var(--line-faint)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)"
              }}
            >
              <div className="flex items-center gap-2">
                <Star size={11} className="text-[var(--rune)]" fill="currentColor" />
                <span className="text-[13px]">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                  {tracked}
                </span>
                <button
                  onClick={() => onRemove(item.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-xs)] text-[var(--text-quaternary)] transition-all duration-[var(--dur-fast)] hover:bg-[rgba(199,93,93,0.1)] hover:text-[var(--negative)]"
                  type="button"
                >
                  <X size={11} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 text-[12px] text-[var(--text-quaternary)]">&mdash;</div>
      )}
    </div>
  );
}

export function WatchlistView({ labels }: Readonly<{ labels: WatchlistLabels }>) {
  const { add, remove, byCategory } = useFavorites();

  return (
    <div className="grid gap-6">
      <CategorySection
        category="entity"
        label={labels.entity}
        items={byCategory("entity")}
        presets={PRESET_ENTITIES}
        onAdd={add}
        onRemove={remove}
        tracked={labels.tracked}
      />
      <CategorySection
        category="sector"
        label={labels.sector}
        items={byCategory("sector")}
        presets={PRESET_SECTORS}
        onAdd={add}
        onRemove={remove}
        tracked={labels.tracked}
      />
      <CategorySection
        category="region"
        label={labels.region}
        items={byCategory("region")}
        presets={PRESET_REGIONS}
        onAdd={add}
        onRemove={remove}
        tracked={labels.tracked}
      />
    </div>
  );
}
