"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  Globe2,
  Languages,
  Search,
  Settings2
} from "lucide-react";
import { OdimLogo } from "@/components/ui/odim-logo";
import { HuginnIcon } from "@/components/ui/huginn-icon";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { KeyboardNav } from "@/components/ui/keyboard-nav";
import type { Messages } from "@/lib/i18n/messages";
import { useAlertState } from "@/lib/stores/alert-state";
import { alerts as fixtureAlerts } from "@/lib/data";

type NavItem = {
  icon: React.ElementType;
  label: string;
  mobileLabel: string;
  href: string;
};

function AlertsBadge({ count, unreadLabel }: Readonly<{ count: number; unreadLabel: string }>) {
  if (count === 0) return null;

  return (
    <span
      className="mono absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center px-1 text-[11px] font-medium leading-none"
      style={{
        borderRadius: "999px",
        background: "var(--critical, #e2745b)",
        color: "var(--field, #0a1016)"
      }}
      aria-label={`${count} ${unreadLabel}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/map" && pathname.startsWith(`${href}/`));
}

function RailLink({ item, badge, unreadLabel }: Readonly<{ item: NavItem; badge?: number; unreadLabel: string }>) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="group relative flex min-h-11 w-11 items-center justify-center border-l-2 border-transparent px-2 text-left transition-colors duration-[120ms] ease-out hover:bg-[color-mix(in_srgb,var(--signal,#4c90f0)_8%,transparent)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal,#4c90f0)] motion-reduce:transition-none min-[1200px]:w-full min-[1200px]:justify-start min-[1200px]:gap-3 min-[1200px]:px-3"
      style={
        active
          ? {
              borderLeftColor: "var(--signal, #4c90f0)",
              background: "color-mix(in srgb, var(--signal, #4c90f0) 12%, transparent)",
              color: "var(--text, var(--text-primary, #e8eff2))"
            }
          : { color: "var(--text-secondary, #8d97ab)" }
      }
    >
      <span className="relative inline-flex shrink-0 items-center justify-center" aria-hidden="true">
        <Icon size={18} strokeWidth={1.7} />
        {badge !== undefined ? <AlertsBadge count={badge} unreadLabel={unreadLabel} /> : null}
      </span>
      <span className="hidden text-[13px] leading-5 min-[1200px]:inline">{item.label}</span>
      <span
        className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-x-1 -translate-y-1/2 whitespace-nowrap border px-2.5 py-1.5 text-[12px] opacity-0 transition-[opacity,transform] duration-[120ms] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none motion-reduce:translate-x-0 motion-reduce:translate-y-0 min-[1200px]:hidden"
        style={{
          background: "var(--surface, var(--ink-850, #131d26))",
          borderColor: "var(--line-soft)",
          color: "var(--text, var(--text-primary, #e8eff2))"
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}

function MobileNav({ nav, alertsUnread, unreadLabel, navigationLabel }: Readonly<{ nav: NavItem[]; alertsUnread: number; unreadLabel: string; navigationLabel: string }>) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={navigationLabel}
      data-testid="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex min-h-[68px] w-full max-w-[390px] border-t px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden"
      style={{
        background: "var(--surface, var(--ink-900, #131d26))",
        borderColor: "var(--line-soft)"
      }}
    >
      {nav.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);
        const badge = item.href === "/alerts" ? alertsUnread : 0;

        return (
          <Link
            href={item.href}
            key={item.href}
            aria-current={active ? "page" : undefined}
            className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 border-transparent px-1 text-center transition-colors duration-[120ms] ease-out hover:bg-[color-mix(in_srgb,var(--signal,#4c90f0)_8%,transparent)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal,#4c90f0)] motion-reduce:transition-none"
            style={
              active
                ? {
                    borderTopColor: "var(--signal, #4c90f0)",
                    color: "var(--signal, #4c90f0)"
                  }
                : { color: "var(--text-secondary, #8d97ab)" }
            }
          >
            <span className="relative inline-flex" aria-hidden="true">
              <Icon size={17} strokeWidth={1.7} />
              {badge > 0 ? <AlertsBadge count={badge} unreadLabel={unreadLabel} /> : null}
            </span>
            <span className="truncate text-[11px] leading-4">{item.mobileLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function EvidenceThread({ messages }: Readonly<{ messages: Messages }>) {
  const thread = messages.shell.frame.thread;

  return (
    <div
      className="hidden border-l-2 py-1 pl-3 min-[1200px]:block"
      style={{ borderColor: "var(--evidence, #5cc6d2)" }}
      aria-label={messages.shell.frame.threadLabel}
    >
      <div className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--evidence, #5cc6d2)" }}>
        {messages.shell.frame.threadLabel}
      </div>
      <div className="mt-2 grid gap-1 text-[11px]" style={{ color: "var(--text-secondary, #8d97ab)" }}>
        <span>{thread.source}</span>
        <span>{thread.entity}</span>
        <span>{thread.signal}</span>
        <span>{thread.action}</span>
      </div>
    </div>
  );
}

export function Shell({
  children,
  messages,
  locale
}: Readonly<{ children: React.ReactNode; messages: Messages; locale: string }>) {
  const pathname = usePathname();
  const { unreadCount } = useAlertState();
  const allAlertIds = fixtureAlerts.map((a) => a.id);
  const alertsUnread = unreadCount(allAlertIds);

  const desktopNav: NavItem[] = [
    { icon: Globe2, label: messages.shell.nav.map, mobileLabel: messages.shell.mobileNav.map, href: "/map" },
    { icon: Building2, label: messages.shell.nav.entity, mobileLabel: messages.shell.mobileNav.entity, href: "/entity" },
    { icon: Bell, label: messages.shell.nav.alerts, mobileLabel: messages.shell.mobileNav.alerts, href: "/alerts" },
    { icon: HuginnIcon, label: messages.shell.nav.huginn, mobileLabel: messages.shell.mobileNav.huginn, href: "/huginn" },
    { icon: Settings2, label: messages.shell.nav.settings, mobileLabel: messages.shell.mobileNav.settings, href: "/settings" }
  ];
  const mobileNav = [desktopNav[2], desktopNav[0], desktopNav[1], desktopNav[3], desktopNav[4]];
  const currentItem = desktopNav.find((item) => isActivePath(pathname, item.href)) ?? desktopNav[0];

  function openCommandPalette() {
    window.dispatchEvent(new CustomEvent("odim:open-command", { detail: { source: "frame" } }));
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--field, var(--ink-950, #0a1016))",
        color: "var(--text, var(--text-primary, #e8eff2))"
      }}
    >
      <KeyboardNav labels={messages.shell.keyboard} />

      <aside
        aria-label={messages.shell.frame.railLabel}
        data-testid="desktop-rail"
        className="fixed inset-y-0 left-0 z-40 hidden w-[68px] flex-col border-r px-2 py-4 md:flex min-[1200px]:w-[220px] min-[1200px]:px-3"
        style={{
          background: "var(--surface, var(--ink-900, #131d26))",
          borderColor: "var(--line-soft)"
        }}
      >
        <Link
          href="/map"
          aria-label={`Odim — ${messages.shell.nav.map}`}
          className="flex min-h-11 items-center justify-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal,#4c90f0)] min-[1200px]:justify-start min-[1200px]:gap-3 min-[1200px]:px-2"
        >
          <OdimLogo size={28} />
          <span className="hidden min-[1200px]:block">
            <span className="block text-[13px] font-semibold tracking-[0.08em]">ODIM</span>
            <span className="mono block text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--text-secondary, #8d97ab)" }}>
              {messages.shell.productCategory}
            </span>
          </span>
        </Link>

        <nav aria-label={messages.shell.frame.railNavLabel} className="mt-8 grid gap-1">
          {desktopNav.map((item) => (
            <RailLink
              item={item}
              key={item.href}
              badge={item.href === "/alerts" ? alertsUnread : undefined}
              unreadLabel={messages.shell.frame.unreadAlerts}
            />
          ))}
        </nav>

        <div className="mt-auto grid gap-5">
          <EvidenceThread messages={messages} />
          <div className="flex items-center justify-center min-[1200px]:justify-start min-[1200px]:px-2">
            <Languages size={15} aria-hidden="true" style={{ color: "var(--text-secondary, #8d97ab)" }} />
            <span className="sr-only">{messages.shell.frame.languageLabel}</span>
            <div className="ml-2 hidden min-[1200px]:block">
              <LocaleSwitcher current={locale} label={messages.shell.frame.languageLabel} />
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen pb-[78px] md:max-[1199px]:ml-[68px] md:pb-0 min-[1200px]:ml-[220px]" data-testid="dashboard-frame">
        <header
          data-testid="context-strip"
          className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b px-4 sm:px-5 min-[1200px]:px-6"
          style={{
            background: "color-mix(in srgb, var(--field, #0a1016) 94%, transparent)",
            borderColor: "var(--line-soft)"
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="md:hidden">
              <OdimLogo size={22} />
            </div>
            <div className="min-w-0">
              <div className="mono truncate text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary, #8d97ab)" }}>
                ODIM / {currentItem.label}
              </div>
              <div className="hidden truncate text-[11px] sm:block" style={{ color: "var(--text-secondary, #8d97ab)" }}>
                {messages.shell.frame.workspaceNote}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="command-trigger"
            aria-label={messages.shell.frame.commandLabel}
            aria-keyshortcuts="Control+K Meta+K"
            onClick={openCommandPalette}
            className="flex min-h-11 min-w-11 items-center gap-2 border px-2.5 text-left transition-colors duration-[120ms] hover:bg-[color-mix(in_srgb,var(--signal,#4c90f0)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal,#4c90f0)] motion-reduce:transition-none sm:min-w-40 sm:px-3"
            style={{
              background: "var(--surface, var(--ink-900, #131d26))",
              borderColor: "var(--line-soft)",
              color: "var(--text-secondary, #8d97ab)"
            }}
          >
            <Search size={16} aria-hidden="true" />
            <span className="hidden flex-1 text-[12px] sm:inline">{messages.shell.frame.commandLabel}</span>
            <kbd className="mono hidden text-[11px] sm:inline" style={{ color: "var(--text-tertiary, #5c6780)" }}>⌘K</kbd>
          </button>

          <div
            className="hidden min-h-8 items-center gap-2 border px-2.5 sm:flex"
            data-testid="source-status"
            role="status"
            style={{
              borderColor: "var(--line-soft)",
              color: "var(--text-secondary, #8d97ab)"
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--text-secondary, #8d97ab)" }} aria-hidden="true" />
            <span className="mono text-[11px] uppercase tracking-[0.08em]">{messages.shell.frame.fixtureStatus}</span>
          </div>

          <div className="hidden sm:block">
            <span className="sr-only">{messages.shell.frame.languageLabel}</span>
            <LocaleSwitcher current={locale} label={messages.shell.frame.languageLabel} />
          </div>
        </header>

        {children}
      </main>

      <MobileNav
        nav={mobileNav}
        alertsUnread={alertsUnread}
        unreadLabel={messages.shell.frame.unreadAlerts}
        navigationLabel={messages.shell.frame.railNavLabel}
      />
    </div>
  );
}
