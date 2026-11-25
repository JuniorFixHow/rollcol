import { periodWordTitle, staffRoleLabel } from "@rollcol/shared";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { PageSkeleton } from "@/components/ui";
import { SchoolSwitcher } from "@/components/school-switcher";
import { requireStaff, staffMemberships } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { DashboardNav, type NavGroup } from "./nav";
import { UserMenu, type UserMenuProps } from "./user-menu";

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
          <div className="-mt-2 mb-4 hidden h-9 justify-end md:flex sm:-mt-4">
            <Suspense fallback={null}>
              <TopBar />
            </Suspense>
          </div>
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}

/** Who is signed in, for the account menu at the top right. */
async function userMenuProps(): Promise<UserMenuProps> {
  const { member, email } = await requireStaff();
  const unread = await getUnreadCount();
  return {
    name: member.fullName,
    subtitle: member.school.isWorkspace
      ? "Your workspace"
      : `${staffRoleLabel(member.role, member.school.type)}, ${member.school.name}`,
    email,
    unread,
    isPlatformAdmin: member.isPlatformAdmin,
  };
}

async function TopBar() {
  return <UserMenu {...await userMenuProps()} />;
}

async function Sidebar() {
  const { supabase, member, memberships } = await requireStaff();
  const { school, role } = member;
  const staffSchools = staffMemberships(memberships).map((m) => ({ id: m.school.id, name: m.school.name }));
  const isAdmin = role === "admin";
  const tertiary = school.type === "tertiary";
  // A workspace is one person: no staff, no programmes or batches, and SMS only on the Alerts plan.
  const workspace = school.isWorkspace;
  const workspaceSms =
    workspace && !tertiary ? (await supabase.rpc("school_features", { p_school_id: school.id })).data?.[0]?.sms === true : false;

  const attendance = [
    tertiary ? { href: "/dashboard/sessions", label: "Sessions" } : { href: "/dashboard/registers", label: "Registers" },
    ...(tertiary
      ? [{ href: "/dashboard/venues", label: "Venues" }]
      : workspace && !workspaceSms
        ? []
        : [{ href: "/dashboard/messages", label: "Messages" }]),
    ...(tertiary
      ? []
      : [
          { href: "/dashboard/absences", label: "Absence reports" },
          { href: "/dashboard/pickups", label: "Pickups" },
          ...(isAdmin ? [{ href: "/dashboard/school-day", label: "School day" }] : []),
        ]),
    { href: "/dashboard/reports", label: "Reports" },
    ...(tertiary && isAdmin ? [{ href: "/dashboard/phones", label: "Phones" }] : []),
  ];
  const people = [
    { href: "/dashboard/students", label: "Students" },
    ...(isAdmin && !workspace ? [{ href: "/dashboard/staff", label: "Staff" }] : []),
    ...(isAdmin && !tertiary ? [{ href: "/dashboard/parents", label: "Parent app" }] : []),
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
        ...(isAdmin
          ? [
              { href: "/dashboard/settings", label: "Settings" },
              { href: "/dashboard/billing", label: "Billing" },
            ]
          : []),
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
      actions={<UserMenu {...await userMenuProps()} />}
    />
  );
}
