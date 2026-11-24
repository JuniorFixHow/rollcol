import type { Metadata } from "next";
import Link from "next/link";
import { InlineAction } from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader, formatTime } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { joinCourse } from "./actions";

export const metadata: Metadata = { title: "Your courses" };

function rateTone(rate: number): "success" | "warning" | "danger" {
  return rate >= 75 ? "success" : rate >= 50 ? "warning" : "danger";
}

/** The student's courses and attendance, classes open now, and courses they can join. */
export default async function StudentCoursesPage() {
  const { supabase, student } = await requireStudent();
  const [{ data: courses, error }, { data: open }] = await Promise.all([
    supabase.rpc("my_courses", { p_school_id: student.school.id }),
    supabase.rpc("my_open_sessions"),
  ]);
  const mine = (courses ?? []).filter((c) => c.enrolled);
  const others = (courses ?? []).filter((c) => !c.enrolled);
  const openHere = (open ?? []).filter((s) => s.school_id === student.school.id);

  return (
    <>
      <PageHeader
        title="Your courses"
        description={`${student.school.name}${courses?.[0] ? ` · ${courses[0].semester}` : ""}. Check in to classes with the RollCol app on your phone.`}
      />
      <div className="space-y-6">
        {student.status !== "active" ? (
          <Notice tone="warning">You can join courses once your school approves your account.</Notice>
        ) : null}
        {error ? <Notice tone="warning">RollCol could not load your courses. Refresh the page to try again.</Notice> : null}

        {openHere.length > 0 ? (
          <Card title="Open now" description="Check in with the RollCol app on your phone: it needs your phone's location.">
            <ul className="divide-y divide-line rounded-lg border border-line">
              {openHere.map((s) => (
                <li key={s.session_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {s.course_code} · {s.course_title}
                    </p>
                    <p className="text-sm text-muted">
                      {formatTime(s.starts_at)} to {formatTime(s.ends_at)}
                      {s.reward_marks > 0 ? ` · ${s.reward_marks} marks` : ""}
                    </p>
                  </div>
                  {s.checked_in_at ? <Badge tone="success">Checked in</Badge> : <Badge tone="accent">Check in in the app</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {mine.length === 0 && !error ? (
          <EmptyState>Join the courses you are registered for below, so you can check in to their classes.</EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {mine.map((course) => {
              const rate = course.sessions_held > 0 ? Math.round((course.attended / course.sessions_held) * 100) : null;
              return (
                <li key={course.course_run_id}>
                  <Link href={`/student/courses/${course.course_run_id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {course.code} · {course.title}
                      </span>
                      <span className="block text-sm text-muted">
                        {course.attended} of {course.sessions_held} classes
                        {course.marks > 0 ? ` · ${course.marks} marks` : ""}
                        {course.lecturers ? ` · ${course.lecturers}` : ""}
                      </span>
                    </span>
                    {rate !== null ? <Badge tone={rateTone(rate)}>{`${rate}%`}</Badge> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {student.status === "active" && others.length > 0 ? (
          <Card title="Other courses this semester" description="Join only the courses you are registered for. Your lecturer sees who joined.">
            <ul className="divide-y divide-line rounded-lg border border-line">
              {others.map((course) => (
                <li key={course.course_run_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {course.code} · {course.title}
                    </p>
                    {course.lecturers ? <p className="text-sm text-muted">{course.lecturers}</p> : null}
                  </div>
                  <InlineAction
                    action={joinCourse}
                    hidden={{ courseRunId: course.course_run_id }}
                    label="Join"
                    variant="secondary"
                    confirm={`Join ${course.code}? ${course.title}. You will get notifications when its classes open, and can check in to them in the app.`}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
