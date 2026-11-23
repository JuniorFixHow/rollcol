"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ThemePicker } from "@/components/theme";

export interface UserMenuProps {
  name: string;
  /** For example "Teacher, Test: Adenta Basic School". */
  subtitle: string;
  email: string | null;
  unread: number;
  isPlatformAdmin: boolean;
}

function initialsOf(name: string): string {
  const words = name
    .replace(/^(dr|mr|mrs|ms|prof|rev)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const itemClass = "block w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-surface-muted";

/**
 * The top right of the dashboard: a bell for notifications, and the person's
 * initials, which open their account menu.
 */
export function UserMenu({ name, subtitle, email, unread, isPlatformAdmin }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const count = unread > 99 ? "99+" : String(unread);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapper.current && event.target instanceof Node && !wrapper.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={wrapper} className="relative flex items-center gap-1.5">
      <Link
        href="/dashboard/notifications"
        aria-label={unread > 0 ? `Notifications, ${count} unread` : "Notifications"}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <BellIcon />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-4.5 rounded-full bg-accent px-1 text-center text-[10px] leading-4.5 font-semibold text-white tabular-nums"
          >
            {count}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        className="inline-flex size-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent hover:ring-2 hover:ring-accent/30"
      >
        {initialsOf(name)}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-40 mt-2 w-72 rounded-xl border border-line bg-surface p-2 shadow-lg"
        >
          <div className="border-b border-line px-3 pt-1 pb-3">
            <p className="truncate font-medium">{name}</p>
            {email ? <p className="truncate text-xs text-muted">{email}</p> : null}
            <p className="mt-1 truncate text-xs text-muted">{subtitle}</p>
          </div>
          <div className="py-1">
            <Link href="/dashboard/account" role="menuitem" onClick={close} className={itemClass}>
              Your account
            </Link>
            <Link href="/dashboard/notifications" role="menuitem" onClick={close} className={`${itemClass} flex items-center justify-between`}>
              Notifications
              {unread > 0 ? (
                <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs leading-5 font-semibold text-white tabular-nums">
                  {count}
                </span>
              ) : null}
            </Link>
            {isPlatformAdmin ? (
              <a href="/platform" role="menuitem" className={itemClass}>
                RollCol platform
              </a>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
            <span className="text-sm text-muted">Theme</span>
            <ThemePicker />
          </div>
          <form action="/auth/sign-out" method="post" className="border-t border-line pt-1">
            <button type="submit" role="menuitem" className={itemClass}>
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
