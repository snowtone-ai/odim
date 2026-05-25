import { Panel } from "@/components/ui/panel";
import { Screen } from "@/components/ui/screen";
import { watchlistBriefs } from "@/lib/data";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";

export default async function WatchlistPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const screen = messages.screens.watchlist;

  return (
    <Screen eyebrow={`${messages.common.screen} 06`} title={screen.title}>
      <div className="grid grid-cols-2 gap-5">
        <Panel title={screen.panels.watchlist}>
          {watchlistBriefs.map((item) => (
            <div className="border-b border-[var(--line-faint)] py-3 text-sm" key={item.name}>
              <div className="flex justify-between">
                <span>{item.name}</span>
                <span className="mono text-[var(--text-tertiary)]">{messages.common.tracked}</span>
              </div>
              <div className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{item.source}</div>
            </div>
          ))}
        </Panel>
        <Panel title={screen.panels.brief}>
          <div className="grid gap-3">
            {watchlistBriefs.map((item) => (
              <div className="border-b border-[var(--line-faint)] pb-3 text-sm" key={item.brief}>
                {item.brief}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
