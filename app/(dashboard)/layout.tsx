import { Shell } from "@/components/ui/shell";
import { CommandPalette } from "@/components/ui/command-palette";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { entities, alerts } from "@/lib/data";

export default async function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = getMessages(locale);

  // Cap at 100 to prevent large client payload; server search can replace this at scale
  const paletteEntities = entities.slice(0, 100).map((e) => ({ id: e.id, name: e.name }));
  const paletteAlerts = alerts.slice(0, 100).map((a) => ({ title: a.title }));

  return (
    <>
      <Shell messages={messages} locale={locale}>{children}</Shell>
      <CommandPalette
        entities={paletteEntities}
        alerts={paletteAlerts}
        labels={messages.shell.commandPalette}
      />
    </>
  );
}
