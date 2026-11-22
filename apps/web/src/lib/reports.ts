import "server-only";
import { buildClassReport, buildCourseReport, periodWordTitle } from "@rollcol/shared";
import type { StaffMember } from "@/lib/auth";
import { choosePeriod, lowAttendancePercent } from "@/lib/periods";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * A class's term: the register (days), the per-subject summary, and the
 * headings for files. Null when the class is not in this school or this
 * person cannot see it (the database checks too).
 */
export async function loadClassReport(supabase: Supabase, member: StaffMember, classId: string, requestedPeriod: unknown) {
  const { school } = member;
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("school_id", school.id)
    .maybeSingle();
  if (!klass) return null;

  const [{ periods, period }, threshold] = await Promise.all([
    choosePeriod(supabase, school.id, requestedPeriod),
    lowAttendancePercent(supabase, school.id),
  ]);
  const args = { p_class_id: klass.id, p_period_id: period?.id ?? null };
  const [days, subjects] = await Promise.all([
    supabase.rpc("class_register_days", args),
    supabase.rpc("class_subject_summary", args),
  ]);
  if (days.error?.code === "42501") return null;
  if (days.error) throw new Error(days.error.message);
  if (subjects.error) throw new Error(subjects.error.message);

  return {
    klass,
    periods,
    period,
    threshold,
    report: buildClassReport(days.data ?? []),
    subjects: subjects.data ?? [],
    heading: {
      school: school.name,
      title: `${klass.name} attendance register`,
      period: period ? `${periodWordTitle(school.type)}: ${period.name}` : "All dates",
      threshold,
    },
  };
}

/** A course's semester: every student by every session held. */
export async function loadCourseReport(supabase: Supabase, member: StaffMember, runId: string) {
  const { school } = member;
  const { data: run } = await supabase
    .from("course_runs")
    .select("id, course:courses(code, title), period:academic_periods(name)")
    .eq("id", runId)
    .eq("school_id", school.id)
    .maybeSingle();
  if (!run) return null;

  const [rows, threshold] = await Promise.all([
    supabase.rpc("course_run_report", { p_course_run_id: run.id }),
    lowAttendancePercent(supabase, school.id),
  ]);
  if (rows.error?.code === "42501") return null;
  if (rows.error) throw new Error(rows.error.message);

  const code = run.course?.code ?? "Course";
  const title = run.course?.title ?? "";
  return {
    run,
    code,
    title,
    threshold,
    report: buildCourseReport(rows.data ?? []),
    heading: {
      school: school.name,
      title: `${code} ${title}`.trim(),
      period: run.period ? `Semester: ${run.period.name}` : "",
      threshold,
    },
  };
}
