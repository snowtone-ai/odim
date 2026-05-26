import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { WatchlistView } from "@/components/ui/watchlist-view";
import { watchlistBriefs } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function WatchlistPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.watchlist;

  return (
    <Screen eyebrow={`${messages.common.screen} 06`} title={screen.title}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title={screen.panels.watchlist}>
          <WatchlistView labels={screen.favorites} />
        </Panel>
        <Panel title={screen.panels.brief}>
          <div className="grid gap-3.5">
            {watchlistBriefs.map((item) => (
              <div
                className="pb-3.5"
                style={{ borderBottom: "1px solid var(--line-faint)" }}
                key={item.brief}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.name}
                  </span>
                  <span
                    className="mono shrink-0 text-[10px] uppercase tracking-[0.11em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.source}
                  </span>
                </div>
                <div className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {item.brief}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {screen.briefNote}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
