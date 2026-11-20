import { periodWordTitle, staffRoleLabel } from "@rollcol/shared";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { PageSkeleton } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { DashboardNav, type NavItem } from "./nav";

// Every dashboard page depends on the signed-in user, so navigation into it blocks on the server.
export const instant = false;

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4 md:sticky md:top-0 md:max-h-screen">
          <Brand href="/dashboard" />
          <Suspense fallback={<div className="h-40 animate-pulse rounded bg-surface-muted" />}>
            <Sidebar />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}

async function Sidebar() {
  const { member } = await requireStaff();
  const { school, role } = member;
  const isAdmin = role === "admin";
  const tertiary = school.type === "tertiary";

  const items: NavItem[] = [{ href: "/dashboard", label: "Overview" }];
  items.push({ href: "/dashboard/students", label: "Students" });
  items.push(tertiary ? { href: "/dashboard/courses", label: "Courses" } : { href: "/dashboard/classes", label: "Classes" });
  if (isAdmin) {
    items.push({ href: "/dashboard/calendar", label: `${periodWordTitle(school.type)}s` });
    items.push({ href: "/dashboard/staff", label: "Staff" });
    items.push({ href: "/dashboard/settings", label: "Settings" });
  }
  items.push({ href: "/dashboard/account", label: "Your account" });

  return (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{school.name}</p>
        <p className="truncate text-xs text-muted">
          {member.fullName}, {staffRoleLabel(role, school.type)}
        </p>
      </div>
      <DashboardNav items={items} />
      <div className="mt-auto hidden md:block">
        {member.isPlatformAdmin ? (
          <a href="/platform" className="mb-2 block text-xs text-accent hover:underline">
            RollCol platform
          </a>
        ) : null}
        <SignOutButton variant="ghost" />
      </div>
    </>
  );
}
