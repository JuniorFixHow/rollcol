"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONS = {
  messages: (
    <Svg>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </Svg>
  ),
  notifications: (
    <Svg>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  ),
  account: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18.5a6.5 6.5 0 0 1 11 0" />
    </Svg>
  ),
} as const;

function HeaderIcon({ href, label, icon, count, active }: { href: string; label: string; icon: keyof typeof ICONS; count: number; active: boolean }) {
  const shown = count > 99 ? "99+" : String(count);
  return (
    <Link
      href={href}
      title={label}
      aria-label={count > 0 ? `${label}, ${shown} unread` : label}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex size-9 items-center justify-center rounded-full ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground"
      }`}
    >
      {ICONS[icon]}
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 min-w-4.5 rounded-full bg-accent px-1 text-center text-[10px] leading-4.5 font-semibold text-white tabular-nums"
        >
          {shown}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The parent header: Children, Pickups and Absences as links, and messages,
 * notifications and the account as icons at the top right.
 */
export function ParentNav({ unreadNotifications, unreadMessages }: { unreadNotifications: number; unreadMessages: number }) {
  const path = usePathname();
  const links = [
    { href: "/parent", label: "Children", active: path === "/parent" || path.startsWith("/parent/child") || path === "/parent/link" },
    { href: "/parent/pickups", label: "Pickups", active: path.startsWith("/parent/pickups") },
    { href: "/parent/absences", label: "Absences", active: path.startsWith("/parent/absences") },
  ];
  return (
    <>
      <nav aria-label="Parent" className="-mx-2 order-last flex w-full overflow-x-auto sm:order-none sm:mr-auto sm:w-auto">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.active ? "page" : undefined}
            className={`flex shrink-0 items-center rounded-md px-3 py-2 text-sm font-medium ${
              link.active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        <HeaderIcon href="/parent/messages" label="Messages" icon="messages" count={unreadMessages} active={path.startsWith("/parent/messages")} />
        <HeaderIcon
          href="/parent/notifications"
          label="Notifications"
          icon="notifications"
          count={unreadNotifications}
          active={path.startsWith("/parent/notifications")}
        />
        <HeaderIcon href="/parent/account" label="Account" icon="account" count={0} active={path.startsWith("/parent/account")} />
      </div>
    </>
  );
}
