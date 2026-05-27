"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  Building2,
  Bell,
  Settings,
  Languages
} from "lucide-react";
import { OdimLogo } from "@/components/ui/odim-logo";
import { HuginnIcon } from "@/components/ui/huginn-icon";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import type { Messages } from "@/lib/i18n/messages";

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
};

function SidebarLink({ item }: Readonly<{ item: NavItem }>) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const Icon = item.icon;

  return (
    <Link href={item.href} className="group relative flex items-center justify-center">
      <span
        className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-md)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] ${
          active
            ? "text-[var(--rune)]"
            : "text-[var(--text-tertiary)] hover:bg-[var(--ink-700)] hover:text-[var(--text-secondary)]"
        }`}
        style={
          active
            ? {
                background: "linear-gradient(180deg, var(--rune-active-bg) 0%, var(--rune-active-fade) 100%)",
                boxShadow: "inset 0 1px 0 var(--line-faint), 0 0 14px var(--rune-active-glow)"
              }
            : undefined
        }
      >
        <Icon size={18} strokeWidth={1.4} />
        {active && (
          <span className="absolute -left-[13px] h-[18px] w-[2px] rounded-r-full bg-[var(--rune)]" />
        )}
      </span>
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute left-[calc(100%+10px)] z-50 -translate-x-1 whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] opacity-0 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100"
        style={{
          background: "var(--ink-700)",
          border: "1px solid var(--line-soft)",
          boxShadow: "var(--shadow-lg)"
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function Shell({
  children,
  messages,
  locale
}: Readonly<{ children: React.ReactNode; messages: Messages; locale: string }>) {
  const nav: NavItem[] = [
    { icon: Globe,      label: messages.shell.nav.map,     href: "/map" },
    { icon: Building2,  label: messages.shell.nav.entity,  href: "/entity" },
    { icon: Bell,       label: messages.shell.nav.alerts,  href: "/alerts" },
    { icon: HuginnIcon, label: messages.shell.nav.huginn,  href: "/huginn" },
    { icon: Settings,   label: messages.shell.nav.settings, href: "/settings" }
  ];

  return (
    <div className="min-h-screen bg-[var(--ink-950)]">
      {/* Desktop sidebar */}
      <aside
        className="md:fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col items-center py-5 md:flex"
        style={{
          background: "var(--ink-900)",
          borderRight: "1px solid var(--line-soft)",
          backgroundImage: "linear-gradient(180deg, var(--sidebar-sheen) 0%, transparent 40%)"
        }}
      >
        {/* Logo */}
        <Link href="/map" className="transition-opacity duration-[var(--dur-fast)] hover:opacity-80">
          <OdimLogo size={36} />
        </Link>

        <nav className="mt-7 grid gap-0.5">
          {nav.map((item) => (
            <SidebarLink item={item} key={item.href} />
          ))}
        </nav>

        {/* Language switcher */}
        <div className="mt-auto">
          <div className="group relative flex h-[38px] w-[38px] items-center justify-center">
            <Languages
              size={15}
              strokeWidth={1.5}
              className="text-[var(--text-quaternary)] transition-colors duration-[var(--dur-fast)] group-hover:text-[var(--text-tertiary)]"
            />
            <div
              className="pointer-events-none absolute left-[calc(100%+10px)] z-50 -translate-x-1 whitespace-nowrap rounded-[var(--radius-md)] p-2.5 opacity-0 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100"
              style={{
                background: "var(--ink-700)",
                border: "1px solid var(--line-soft)",
                boxShadow: "var(--shadow-lg)"
              }}
            >
              <LocaleSwitcher current={locale} />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="flex items-center gap-3 overflow-x-auto px-4 py-2.5 md:hidden"
        style={{
          background: "var(--ink-900)",
          borderBottom: "1px solid var(--line-soft)"
        }}
      >
        <OdimLogo size={28} />
        <nav className="flex gap-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                href={item.href}
                key={item.href}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] transition-all duration-[var(--dur-fast)] hover:bg-[var(--ink-700)] hover:text-[var(--text-secondary)]"
                title={item.label}
              >
                <Icon size={15} strokeWidth={1.5} />
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="min-h-screen md:ml-[calc(var(--sidebar-w)+20px)]">{children}</main>
    </div>
  );
}
