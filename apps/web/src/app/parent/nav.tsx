"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-1.5 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs leading-5 font-semibold text-white tabular-nums">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

export function ParentNav({ unreadNotifications, unreadMessages }: { unreadNotifications: number; unreadMessages: number }) {
  const path = usePathname();
  const links = [
    { href: "/parent", label: "Children", count: 0, active: path === "/parent" || path.startsWith("/parent/child") || path === "/parent/link" },
    { href: "/parent/pickups", label: "Pickups", count: 0, active: path.startsWith("/parent/pickups") },
    { href: "/parent/absences", label: "Absences", count: 0, active: path.startsWith("/parent/absences") },
    { href: "/parent/messages", label: "Messages", count: unreadMessages, active: path.startsWith("/parent/messages") },
    { href: "/parent/notifications", label: "Notifications", count: unreadNotifications, active: path.startsWith("/parent/notifications") },
    { href: "/parent/account", label: "Account", count: 0, active: path.startsWith("/parent/account") },
  ];
  return (
    <nav aria-label="Parent" className="-mx-2 flex overflow-x-auto">
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
          <Count n={link.count} />
        </Link>
      ))}
    </nav>
  );
}
