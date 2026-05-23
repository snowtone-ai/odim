import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/ui/shell";

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
  title: "Odim",
  description: "Reality Intelligence OS"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
