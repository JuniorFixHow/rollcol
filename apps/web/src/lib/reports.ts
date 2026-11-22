import "server-only";
import { buildClassReport, buildCourseReport, periodWordTitle } from "@rollcol/shared";
import type { StaffMember } from "@/lib/auth";
import { choosePeriod, lowAttendancePercent } from "@/lib/periods";
import { type Query, type ReportView, inView, parseView, viewLabel } from "@/lib/report-view";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * A class's term: the register (days), the per-subject summary, and the
 * headings for files. Null when the class is not in this school or this
 * person cannot see it (the database checks too).
 */
export async function loadClassReport(supabase: Supabase, member: StaffMember, classId: string, query: Query) {
  const { school } = member;
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("school_id", school.id)
    .maybeSingle();
  if (!klass) return null;

  const [{ periods, period }, threshold] = await Promise.all([
    choosePeriod(supabase, school.id, query.period),
    lowAttendancePercent(supabase, school.id),
  ]);
  const view = parseView(query);
  // A week or a date range can cross terms, so it reads every date and keeps the ones in view.
  const args = { p_class_id: klass.id, p_period_id: view.mode === "all" ? (period?.id ?? null) : null };
  const bounds = view.mode === "all" ? {} : { p_from: view.from, p_to: view.to };
  const [days, subjects] = await Promise.all([
    supabase.rpc("class_register_days", args),
    supabase.rpc("class_subject_summary", { ...args, ...bounds }),
  ]);
  if (days.error?.code === "42501") return null;
  if (days.error) throw new Error(days.error.message);
  if (subjects.error) throw new Error(subjects.error.message);

  const allLabel = period ? `${periodWordTitle(school.type)}: ${period.name}` : "All dates";
  return {
    klass,
    periods,
    period,
    view,
    threshold,
    report: buildClassReport((days.data ?? []).filter((row) => inView(view, row.day))),
    subjects: subjects.data ?? [],
    heading: {
      school: school.name,
      title: `${klass.name} attendance register`,
      period: viewLabel(view, allLabel),
      threshold,
    },
  };
}

/** A course's semester: every student by every session held. */
export async function loadCourseReport(supabase: Supabase, member: StaffMember, runId: string, query: Query) {
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

  const view: ReportView = parseView(query);
  const code = run.course?.code ?? "Course";
  const title = run.course?.title ?? "";
  return {
    run,
    code,
    title,
    threshold,
    view,
    report: buildCourseReport((rows.data ?? []).filter((row) => inView(view, row.starts_at))),
    heading: {
      school: school.name,
      title: `${code} ${title}`.trim(),
      period: viewLabel(view, run.period ? `Semester: ${run.period.name}` : "Whole semester"),
      threshold,
    },
  };
}
