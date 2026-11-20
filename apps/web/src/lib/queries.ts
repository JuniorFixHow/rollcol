import type { StaffMember } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Active teaching staff, for "choose a teacher" lists. */
export async function listTeachers(supabase: Supabase, schoolId: string) {
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Classes the signed-in teacher teaches (as class teacher or subject teacher).
 * Admins get every class. The database applies the same rule for guardians.
 */
export async function visibleClassIds(supabase: Supabase, member: StaffMember): Promise<string[] | "all"> {
  if (member.role === "admin") return "all";
  const [asClassTeacher, asSubjectTeacher] = await Promise.all([
    supabase.from("classes").select("id").eq("class_teacher_id", member.id),
    supabase.from("class_subjects").select("class_id").eq("teacher_id", member.id),
  ]);
  const ids = new Set<string>();
  for (const row of asClassTeacher.data ?? []) ids.add(row.id);
  for (const row of asSubjectTeacher.data ?? []) ids.add(row.class_id);
  return [...ids];
}
