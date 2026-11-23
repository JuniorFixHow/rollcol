import { periodWordTitle, staffRoleLabel } from "@rollcol/shared";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { PageSkeleton } from "@/components/ui";
import { SchoolSwitcher } from "@/components/school-switcher";
import { ThemePicker } from "@/components/theme";
import { requireStaff, staffMemberships } from "@/lib/auth";
import { DashboardNav, type NavGroup } from "./nav";

// Every dashboard page depends on the signed-in user, so navigation into it blocks on the server.
export const instant = false;

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center gap-4 p-4 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch">
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
  const { member, memberships } = await requireStaff();
  const { school, role } = member;
  const staffSchools = staffMemberships(memberships).map((m) => ({ id: m.school.id, name: m.school.name }));
  const isAdmin = role === "admin";
  const tertiary = school.type === "tertiary";
  // A workspace is one person: no staff, no SMS (free), no programmes or batches.
  const workspace = school.isWorkspace;

  const attendance = [
    tertiary ? { href: "/dashboard/sessions", label: "Sessions" } : { href: "/dashboard/registers", label: "Registers" },
    ...(tertiary
      ? [{ href: "/dashboard/venues", label: "Venues" }]
      : workspace
        ? []
        : [{ href: "/dashboard/messages", label: "Messages" }]),
    { href: "/dashboard/reports", label: "Reports" },
    ...(tertiary && isAdmin ? [{ href: "/dashboard/phones", label: "Phones" }] : []),
  ];
  const people = [
    { href: "/dashboard/students", label: "Students" },
    ...(isAdmin && !workspace ? [{ href: "/dashboard/staff", label: "Staff" }] : []),
  ];
  const academics = [
    tertiary ? { href: "/dashboard/courses", label: "Courses" } : { href: "/dashboard/classes", label: "Classes" },
    ...(tertiary && isAdmin && !workspace
      ? [
          { href: "/dashboard/programmes", label: "Programmes" },
          { href: "/dashboard/batches", label: "Batches" },
        ]
      : []),
    ...(isAdmin ? [{ href: "/dashboard/calendar", label: `${periodWordTitle(school.type)}s` }] : []),
  ];
  const groups: NavGroup[] = [
    { items: [{ href: "/dashboard", label: "Overview" }] },
    { title: "Attendance", items: attendance },
    { title: "People", items: people },
    { title: "Academics", items: academics },
    {
      items: [
        ...(isAdmin ? [{ href: "/dashboard/settings", label: "Settings" }] : []),
        { href: "/dashboard/account", label: "Your account" },
      ],
    },
  ];

  return (
    <DashboardNav
      groups={groups}
      header={
        <div className="min-w-0">
          {staffSchools.length > 1 ? (
            <SchoolSwitcher schools={staffSchools} currentId={school.id} />
          ) : (
            <p className="truncate text-sm font-medium">{school.name}</p>
          )}
          <p className="mt-1 truncate text-xs text-muted">
            {workspace ? `${member.fullName}, your workspace` : `${member.fullName}, ${staffRoleLabel(role, school.type)}`}
          </p>
        </div>
      }
      footer={
        <>
          <ThemePicker />
          {member.isPlatformAdmin ? (
            <a href="/platform" className="block text-xs text-accent hover:underline">
              RollCol platform
            </a>
          ) : null}
          <SignOutButton variant="ghost" />
        </>
      }
    />
  );
}
