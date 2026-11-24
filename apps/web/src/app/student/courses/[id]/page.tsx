import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, Notice, PageHeader, formatTime } from "@/components/ui";
import { requireStudent } from "@/lib/auth";

export const metadata: Metadata = { title: "Course" };

function dayName(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Accra" }).format(
    new Date(iso),
  );
}

/** The time now, read outside rendering. */
function currentTime(): number {
  return Date.now();
}

/** Every class of one course, and whether the student checked in. */
export default async function StudentCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, student } = await requireStudent();
  const { id } = await params;
  const [{ data: courses }, { data: sessions, error }] = await Promise.all([
    supabase.rpc("my_courses", { p_school_id: student.school.id }),
    supabase.rpc("my_course_sessions", { p_course_run_id: id }),
  ]);
  const course = (courses ?? []).find((c) => c.course_run_id === id && c.enrolled);
  if (!course) notFound();

  const now = currentTime();
  const items = sessions ?? [];
  const counted = items.filter((s) => !s.voided && new Date(s.ends_at).getTime() <= now);
  const attended = counted.filter((s) => s.checked_in_at !== null);
  const marks = attended.reduce((sum, s) => sum + Number(s.reward_marks), 0);

  return (
    <>
      <PageHeader
        title={`${course.code} · ${course.title}`}
        description={
          <Link href="/student" className="text-accent hover:underline">
            Your courses
          </Link>
        }
      />
      <div className="space-y-6">
        {error ? <Notice tone="warning">RollCol could not load this course. Refresh the page to try again.</Notice> : null}
        <Card>
          <p className="text-3xl font-semibold tabular-nums">
            {attended.length} of {counted.length}
          </p>
          <p className="text-sm text-muted">
            classes attended
            {counted.length > 0 ? ` (${Math.round((attended.length / counted.length) * 100)}%)` : ""}
            {marks > 0 ? ` · ${marks} marks` : ""}
          </p>
        </Card>
        {items.length === 0 ? (
          <EmptyState>No classes yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {items.map((s) => {
              const ended = new Date(s.ends_at).getTime() <= now;
              return (
                <li key={s.session_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{dayName(s.starts_at)}</p>
                    <p className="text-sm text-muted">
                      {formatTime(s.starts_at)} to {formatTime(s.ends_at)}
                      {s.method === "manual" ? " · added by your lecturer" : ""}
                    </p>
                  </div>
                  {s.voided ? (
                    <Badge>Cancelled</Badge>
                  ) : s.checked_in_at ? (
                    <Badge tone="success">{s.reward_marks > 0 ? `Present · ${s.reward_marks}` : "Present"}</Badge>
                  ) : ended ? (
                    <Badge tone="danger">Missed</Badge>
                  ) : (
                    <Badge tone="accent">Open</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
