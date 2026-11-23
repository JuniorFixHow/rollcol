import { UNVERIFIED_SCHOOL_LIMITS, WORKSPACE_FREE_STUDENTS, periodWord, staffRoleLabel } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { supabase, member } = await requireStaff();
  const { school } = member;
  const isAdmin = member.role === "admin";
  const tertiary = school.type === "tertiary";
  const workspace = school.isWorkspace;

  const count = (table: "staff" | "classes" | "courses" | "academic_periods" | "guardians") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("school_id", school.id);
  const studentCount = () =>
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id);

  const [students, staff, groups, periods, guardians, pending] = await Promise.all([
    studentCount().neq("status", "disabled"),
    count("staff"),
    count(tertiary ? "courses" : "classes"),
    count("academic_periods"),
    tertiary ? Promise.resolve({ count: 0 }) : count("guardians"),
    studentCount().eq("status", "pending"),
  ]);

  const stats = [
    { label: "Students", value: students.count ?? 0, href: "/dashboard/students" },
    ...(workspace ? [] : [{ label: "Staff", value: staff.count ?? 0, href: isAdmin ? "/dashboard/staff" : undefined }]),
    {
      label: tertiary ? "Courses" : "Classes",
      value: groups.count ?? 0,
      href: tertiary ? "/dashboard/courses" : "/dashboard/classes",
    },
  ];

  const workspaceSteps = [
    { done: (periods.count ?? 0) > 0, label: `Add the current ${periodWord(school.type)}`, href: "/dashboard/calendar" },
    tertiary
      ? { done: (groups.count ?? 0) > 0, label: "Add your courses", href: "/dashboard/courses" }
      : { done: (groups.count ?? 0) > 0, label: "Create your classes", href: "/dashboard/classes" },
    tertiary
      ? { done: (students.count ?? 0) > 0, label: "Give your students the workspace code so they can join in the app", href: "/dashboard/students" }
      : { done: (students.count ?? 0) > 0, label: "Add your pupils to their classes", href: "/dashboard/students" },
  ];

  const steps = workspace ? workspaceSteps : [
    { done: (periods.count ?? 0) > 0, label: `Add the current ${periodWord(school.type)}`, href: "/dashboard/calendar" },
    tertiary
      ? { done: (groups.count ?? 0) > 0, label: "Add courses and assign lecturers", href: "/dashboard/courses" }
      : { done: (groups.count ?? 0) > 0, label: "Create classes and choose class teachers", href: "/dashboard/classes" },
    { done: (staff.count ?? 0) > 1, label: `Invite ${tertiary ? "lecturers" : "teachers"}`, href: "/dashboard/staff" },
    tertiary
      ? { done: (students.count ?? 0) > 0, label: "Share the school code so students can join", href: "/dashboard/students" }
      : { done: (students.count ?? 0) > 0, label: "Add students to their classes", href: "/dashboard/students" },
    ...(tertiary
      ? []
      : [{ done: (guardians.count ?? 0) > 0, label: "Add guardians so parents get alerts", href: "/dashboard/students" }]),
  ];

  return (
    <>
      <PageHeader
        title={school.name}
        description={
          workspace
            ? `Your own workspace, ${member.fullName}. Only you can see and change it.`
            : `Signed in as ${member.fullName}, ${staffRoleLabel(member.role, school.type)}.`
        }
      />

      <div className="space-y-6">
        {workspace ? (
          <Notice title="A free workspace">
            You can have up to {WORKSPACE_FREE_STUDENTS} students in all your workspaces.
            {tertiary
              ? " Students check in with the RollCol app, as at a school."
              : " Guardians can be recorded, but free workspaces do not send SMS alerts."}
          </Notice>
        ) : school.status === "unverified" ? (
          <Notice tone="warning" title="RollCol is verifying your school">
            Until your school is verified you can add up to {UNVERIFIED_SCHOOL_LIMITS.students} students and{" "}
            {UNVERIFIED_SCHOOL_LIMITS.staff} staff
            {tertiary ? "." : ", and parents receive only guardian notices (no attendance alerts)."} We will contact the
            school on its registered phone number.
          </Notice>
        ) : null}
        {school.status === "suspended" ? (
          <Notice tone="danger" title="This school is suspended">
            You can view records, but you cannot add people. Contact RollCol support.
          </Notice>
        ) : null}
        {isAdmin && (pending.count ?? 0) > 0 ? (
          <Notice title={`${pending.count} ${pending.count === 1 ? "student is" : "students are"} waiting for approval`}>
            <Link href="/dashboard/students?status=pending" className="font-medium text-accent hover:underline">
              Review them
            </Link>
          </Notice>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => {
            const body = (
              <>
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{stat.value}</p>
              </>
            );
            return stat.href ? (
              <Link key={stat.label} href={stat.href} className="rounded-lg border border-line bg-surface p-5 hover:border-accent/40">
                {body}
              </Link>
            ) : (
              <div key={stat.label} className="rounded-lg border border-line bg-surface p-5">
                {body}
              </div>
            );
          })}
        </div>

        <Card
          title={workspace ? "Workspace code" : "School code"}
          description={
            workspace
              ? tertiary
                ? "Students enter it in the RollCol app, with their student ID, to join your courses."
                : "You can also sign in with this code and the school ID OWNER."
              : tertiary
                ? "Staff use it to sign in. Students enter it in the RollCol app to create their accounts."
                : "Staff use it with their school ID to sign in."
          }
        >
          <p className="font-mono text-3xl font-semibold tracking-[0.3em]">{school.code}</p>
        </Card>

        {isAdmin ? (
          <Card title="Getting started">
            <ol className="space-y-2">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`grid size-5 shrink-0 place-items-center rounded-full border text-xs ${
                      step.done ? "border-success bg-success text-white" : "border-line"
                    }`}
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <Link href={step.href} className={step.done ? "text-muted line-through" : "hover:text-accent"}>
                    {step.label}
                  </Link>
                  <span className="sr-only">{step.done ? "(done)" : "(to do)"}</span>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </div>
    </>
  );
}
