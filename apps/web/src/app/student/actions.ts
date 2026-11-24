"use server";

import { describeDatabaseError, studentJoinSchema } from "@rollcol/shared";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { type FormState, failed, formValues, invalid, succeeded } from "@/lib/forms";
import { rememberSchool } from "@/lib/school-actions";
import { createAdminClient } from "@/lib/supabase/admin";

/** Joins a course the student is registered for (their lecturer sees who joined). */
export async function joinCourse(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStudent();
  const { error } = await supabase.rpc("join_course_run", { p_course_run_id: String(formData.get("courseRunId") ?? "") });
  if (error) return failed(describeDatabaseError(error));
  refresh();
  return succeeded("Joined.");
}

/** Shows another of the student's schools or workspaces. */
export async function switchStudentSchool(formData: FormData): Promise<void> {
  const { students } = await requireStudent();
  const schoolId = String(formData.get("schoolId") ?? "");
  if (students.some((m) => m.school.id === schoolId)) await rememberSchool(schoolId);
  redirect("/student");
}

/** Joins another school, or a lecturer's workspace, with its code and the student's ID there. */
export async function joinAnotherSchool(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, student } = await requireStudent();
  const values = formValues(formData);
  const parsed = studentJoinSchema.safeParse({ ...values, fullName: values.fullName || student.fullName });
  if (!parsed.success) return invalid(parsed.error, values);
  const { error } = await supabase.rpc("join_school_as_student", {
    p_school_code: parsed.data.schoolCode,
    p_school_number: parsed.data.schoolId,
    p_full_name: parsed.data.fullName,
  });
  if (error) return failed(describeDatabaseError(error), values);
  refresh();
  return succeeded("Joined. Choose it under Your schools and workspaces.");
}

export async function deleteStudentAccount(): Promise<FormState> {
  const { supabase, userId } = await requireStudent();
  const { data: effects, error } = await supabase.rpc("account_deletion_effects");
  if (error) return failed(error);
  if (effects.some((e) => e.effect === "last_admin")) {
    return failed("You are the only admin of a school. Make another staff member an admin there first, on the dashboard.");
  }
  const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(userId);
  if (deleteError) return failed("We could not delete your account. Please try again.");
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?deleted=1");
}
