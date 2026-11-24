"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StudentNav({ unread, school }: { unread: number; school: string }) {
  const path = usePathname();
  const links = [
    { href: "/student", label: "Courses", count: 0, active: path === "/student" || path.startsWith("/student/courses") },
    { href: "/student/notifications", label: "Notifications", count: unread, active: path.startsWith("/student/notifications") },
    { href: "/student/account", label: "Account", count: 0, active: path.startsWith("/student/account") },
  ];
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
      <span className="hidden max-w-56 truncate text-sm text-muted md:inline">{school}</span>
      <nav aria-label="Student" className="-mx-2 flex overflow-x-auto">
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
            {link.count > 0 ? (
              <span className="ml-1.5 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs leading-5 font-semibold text-white tabular-nums">
                {link.count > 99 ? "99+" : link.count}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
