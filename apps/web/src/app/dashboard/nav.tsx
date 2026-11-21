"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
}

/** A heading with its links. Groups without a title are shown as plain links. */
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 5l5 5-5 5" />
    </svg>
  );
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Groups you open or close stay that way; the group of the current page is always open.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const link = (item: NavItem, nested: boolean) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`block rounded-md py-2 text-sm font-medium ${nested ? "pr-3 pl-6" : "px-3"} ${
          active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <nav aria-label="Dashboard" className="space-y-1">
      {groups.map((group, index) => {
        // A group with a single link is just that link (no heading to open).
        if (!group.title || group.items.length < 2) {
          return <div key={group.title ?? `plain-${index}`}>{group.items.map((item) => link(item, false))}</div>;
        }
        const containsActive = group.items.some((item) => isActive(pathname, item.href));
        const open = containsActive || (toggled[group.title] ?? false);
        const id = `nav-${group.title.toLowerCase().replace(/\W+/g, "-")}`;
        return (
          <div key={group.title}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              disabled={containsActive}
              onClick={() => setToggled((current) => ({ ...current, [group.title as string]: !open }))}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase hover:bg-surface-muted hover:text-foreground disabled:cursor-default disabled:hover:bg-transparent"
            >
              {group.title}
              <Chevron open={open} />
            </button>
            <div id={id} hidden={!open} className="space-y-0.5">
              {group.items.map((item) => link(item, true))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * The sidebar on larger screens. On phones, a bar with a Menu button that
 * opens the same links (with the theme and sign-out) in a panel.
 */
export function DashboardNav({ groups, header, footer }: { groups: NavGroup[]; header: ReactNode; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = groups.flatMap((group) => group.items).find((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Larger screens */}
      <div className="hidden min-h-0 flex-1 flex-col gap-4 md:flex">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks groups={groups} />
        </div>
        <div className="space-y-3">{footer}</div>
      </div>

      {/* Phones */}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 md:hidden">
        <p className="min-w-0 truncate text-sm font-medium">{current?.label ?? "Menu"}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium"
        >
          <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
          Menu
        </button>
      </div>
      {open ? (
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">{header}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-medium"
              >
                Close
              </button>
            </div>
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
            <div className="mt-auto space-y-3 border-t border-line pt-4">{footer}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
