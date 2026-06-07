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
import { KeyboardNav } from "@/components/ui/keyboard-nav";
import { PushNotificationPrompt } from "@/components/ui/push-notification-prompt";
import type { Messages } from "@/lib/i18n/messages";
import { useAlertState } from "@/lib/stores/alert-state";
import { alerts as fixtureAlerts } from "@/lib/data";

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
};

function AlertsBadge({ count }: Readonly<{ count: number }>) {
  if (count === 0) return null;
  return (
    <span
      className="mono absolute flex items-center justify-center font-medium"
      style={{
        top: -4,
        right: -8,
        background: "var(--critical)",
        color: "white",
        fontSize: 10,
        borderRadius: "50%",
        minWidth: 16,
        height: 16,
        padding: "0 2px",
        lineHeight: 1,
        pointerEvents: "none"
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({ item, badge }: Readonly<{ item: NavItem; badge?: number }>) {
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
        {badge !== undefined && <AlertsBadge count={badge} />}
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

function MobileNav({ nav, alertsUnread }: Readonly<{ nav: NavItem[]; alertsUnread: number }>) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        const badge = item.href === "/alerts" ? alertsUnread : 0;
        return (
          <Link
            href={item.href}
            key={item.href}
            className="relative flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 transition-all duration-[var(--dur-fast)]"
            title={item.label}
            style={{
              background: active ? "var(--rune-active-bg)" : "transparent",
              color: active ? "var(--rune)" : "var(--text-tertiary)"
            }}
          >
            <Icon size={14} strokeWidth={1.5} />
            {active && (
              <span className="mono text-[9px] uppercase tracking-[0.08em]">
                {item.label}
              </span>
            )}
            {badge > 0 && (
              <span
                className="mono absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-medium"
                style={{ background: "var(--critical)", color: "white" }}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({
  children,
  messages,
  locale
}: Readonly<{ children: React.ReactNode; messages: Messages; locale: string }>) {
  const { unreadCount } = useAlertState();
  const allAlertIds = fixtureAlerts.map((a) => a.id);
  const alertsUnread = unreadCount(allAlertIds);

  const nav: NavItem[] = [
    { icon: Globe,      label: messages.shell.nav.map,     href: "/map" },
    { icon: Building2,  label: messages.shell.nav.entity,  href: "/entity" },
    { icon: Bell,       label: messages.shell.nav.alerts,  href: "/alerts" },
    { icon: HuginnIcon, label: messages.shell.nav.huginn,  href: "/huginn" },
    { icon: Settings,   label: messages.shell.nav.settings, href: "/settings" }
  ];

  return (
    <div className="min-h-screen bg-[var(--ink-950)]">
      <KeyboardNav />
      <PushNotificationPrompt />
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
          <OdimLogo size={30} />
        </Link>

        <nav className="mt-7 grid gap-0.5">
          {nav.map((item) => (
            <SidebarLink
              item={item}
              key={item.href}
              badge={item.href === "/alerts" ? alertsUnread : undefined}
            />
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
        <OdimLogo size={24} />
        <MobileNav nav={nav} alertsUnread={alertsUnread} />
      </div>

      <main className="min-h-screen md:ml-[calc(var(--sidebar-w)+20px)]">{children}</main>
    </div>
  );
}
