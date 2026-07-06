import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/locale";

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Reality Intelligence OS — Substrate layer detection before narrative confirmation";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Odim — Substrate Intelligence",
    template: "%s — Odim"
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Odim — Substrate Intelligence",
    description: DESCRIPTION,
    siteName: "Odim",
    type: "website",
    url: "/",
    images: ["/odim-logo.png"]
  },
  twitter: {
    card: "summary",
    title: "Odim — Substrate Intelligence",
    description: DESCRIPTION,
    images: ["/odim-logo.png"]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
