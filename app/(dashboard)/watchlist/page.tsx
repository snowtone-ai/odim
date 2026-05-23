import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { entities } from "@/lib/data";

export default function WatchlistPage() {
  return (
    <Screen eyebrow="Screen 06" title="Watchlist & Briefs">
      <div className="grid grid-cols-2 gap-5">
        <Panel title="Watchlist">
          {entities.map((entity) => (
            <div className="flex justify-between border-b border-[var(--line-faint)] py-3 text-sm" key={entity.name}>
              <span>{entity.name}</span>
              <span className="mono text-[var(--text-tertiary)]">tracked</span>
            </div>
          ))}
        </Panel>
        <Panel title="Daily Brief Preview">
          Reality-layer changes are summarized with source links, confidence, and narrative gap.
        </Panel>
      </div>
    </Screen>
  );
}
