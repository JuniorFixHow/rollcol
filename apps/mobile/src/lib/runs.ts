import { ghanaDate } from "./format";
import { supabase } from "./supabase";

export interface MyRun {
  id: string;
  approved_at: string | null;
  course: { code: string; title: string } | null;
  enrolments: { count: number }[];
}

/** Courses this person can run in the current semester (an admin: all of them). */
export async function loadMyRuns(schoolId: string, staffId: string, isAdmin: boolean): Promise<MyRun[]> {
  const today = ghanaDate();
  const { data: semester } = await supabase
    .from("academic_periods")
    .select("id")
    .eq("school_id", schoolId)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .maybeSingle();
  if (!semester) return [];
  const { data } = await supabase
    .from("course_runs")
    .select("id, approved_at, course:courses(code, title), enrolments(count), course_run_staff(staff_id)")
    .eq("academic_period_id", semester.id);
  return (data ?? [])
    .filter((run) => isAdmin || run.course_run_staff.some((row) => row.staff_id === staffId))
    .sort((a, b) => (a.course?.code ?? "").localeCompare(b.course?.code ?? ""));
}
