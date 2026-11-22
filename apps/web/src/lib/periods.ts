import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface Period {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

/**
 * The school's terms or semesters (newest first) and the one to show: the one
 * asked for, else the one containing today, else the latest.
 */
export async function choosePeriod(supabase: Supabase, schoolId: string, requested: unknown) {
  const { data } = await supabase
    .from("academic_periods")
    .select("id, name, starts_on, ends_on")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: false });
  const periods: Period[] = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const wanted = typeof requested === "string" ? requested : "";
  const period =
    periods.find((p) => p.id === wanted) ??
    periods.find((p) => p.starts_on <= today && today <= p.ends_on) ??
    periods[0] ??
    null;
  return { periods, period };
}

export async function lowAttendancePercent(supabase: Supabase, schoolId: string): Promise<number> {
  const { data } = await supabase.from("school_settings").select("low_attendance_percent").eq("school_id", schoolId).maybeSingle();
  return data?.low_attendance_percent ?? 75;
}
