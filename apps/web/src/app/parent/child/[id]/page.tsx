import { addDays, mondayOf, rangeLabel, schoolDayText } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { ghanaToday, markLabel } from "@/lib/parent";

export const metadata: Metadata = { title: "Attendance" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dayName(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

/** A child's school days a week at a time, Monday to Friday, with arrows. */
export default async function ChildPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase } = await requireParent();
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const today = ghanaToday();
  const thisWeek = mondayOf(today);
  const week = weekParam && DATE.test(weekParam) && weekParam <= thisWeek ? mondayOf(weekParam) : thisWeek;
  const friday = addDays(week, 4);

  const [{ data: children }, { data: days, error }, { data: times }] = await Promise.all([
    supabase.rpc("parent_children"),
    supabase.rpc("parent_child_days", { p_student_id: id, p_from: week, p_to: friday }),
    supabase.rpc("parent_school_days", { p_student_id: id, p_from: week, p_to: friday }),
  ]);
  const timesByDay = new Map((times ?? []).map((t) => [t.day, t]));
  const child = (children ?? []).find((c) => c.student_id === id);
  if (!child || !child.full_name) notFound();

  const byDay = new Map((days ?? []).map((d) => [d.day, d.mark]));
  const held = (days ?? []).length;
  const attended = (days ?? []).filter((d) => d.mark === "present" || d.mark === "late").length;
  const arrow = "inline-flex size-9 items-center justify-center rounded-md border border-line text-lg hover:border-accent hover:text-accent";

  return (
    <>
      <PageHeader
        title={child.full_name}
        description={
          <>
            {child.class_name ? `${child.class_name} · ` : ""}
            {child.school_name} ·{" "}
            <Link href="/parent" className="text-accent hover:underline">
              Your children
            </Link>
          </>
        }
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/parent/child/${id}?week=${addDays(week, -7)}`} className={arrow} aria-label="Previous week">
            ‹
          </Link>
          <div className="text-center">
            <p className="font-semibold">{rangeLabel(week, friday)}</p>
            {week !== thisWeek ? (
              <Link href={`/parent/child/${id}`} className="text-sm text-accent hover:underline">
                Back to this week
              </Link>
            ) : null}
          </div>
          {week < thisWeek ? (
            <Link href={`/parent/child/${id}?week=${addDays(week, 7)}`} className={arrow} aria-label="Next week">
              ›
            </Link>
          ) : (
            <span className={`${arrow} opacity-30`} aria-hidden>
              ›
            </span>
          )}
        </div>

        {error ? <Notice tone="warning">RollCol could not load these days. Refresh the page to try again.</Notice> : null}

        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {[0, 1, 2, 3, 4].map((offset) => {
            const day = addDays(week, offset);
            const time = timesByDay.get(day);
            const label = day > today ? { label: "Coming up", tone: "neutral" as const } : markLabel(byDay.get(day) ?? null, byDay.has(day));
            return (
              <li key={day} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {dayName(day)}
                    {day === today ? <span className="text-muted"> (today)</span> : null}
                  </span>
                  {time ? (
                    <span className={`block text-sm ${time.changed ? "font-medium text-warning" : "text-muted"}`}>
                      {time.changed && !time.closed ? "Changed: " : ""}
                      {schoolDayText(time)}
                    </span>
                  ) : null}
                </span>
                <Badge tone={label.tone}>{label.label}</Badge>
              </li>
            );
          })}
        </ul>

        <Card title="This week">
          <p>{held === 0 ? "No registers this week." : `Attendance ${attended} out of ${held}`}</p>
          <p className="mt-2 text-sm text-muted">A day counts as present if your child was present or late in any register that day.</p>
        </Card>
      </div>
    </>
  );
}
