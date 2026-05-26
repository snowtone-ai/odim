import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/ui/shell";
import { CommandPalette } from "@/components/ui/command-palette";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/locale";
import { entities, alerts } from "@/lib/data";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-spectral"
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono"
});

export const metadata: Metadata = {
  title: "Odim — Substrate Intelligence",
  description: "Reality Intelligence OS — Substrate layer detection before narrative confirmation"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = getMessages(locale);

  // Cap at 100 to prevent large client payload; server search can replace this at scale
  const paletteEntities = entities.slice(0, 100).map((e) => ({ id: e.id, name: e.name }));
  const paletteAlerts = alerts.slice(0, 100).map((a) => ({ title: a.title }));

  return (
    <html lang={locale} className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <Shell messages={messages} locale={locale}>{children}</Shell>
        <CommandPalette
          entities={paletteEntities}
          alerts={paletteAlerts}
          labels={messages.shell.commandPalette}
        />
      </body>
    </html>
  );
}
