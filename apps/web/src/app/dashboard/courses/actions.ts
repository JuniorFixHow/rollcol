"use server";

import { batchSchema, courseRunSchema, courseSchema, programmeSchema } from "@rollcol/shared";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formValues, invalid, succeeded } from "@/lib/forms";

export async function addProgramme(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = programmeSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const { error } = await supabase
    .from("programmes")
    .insert({ school_id: member.school.id, name: parsed.data.name, code: parsed.data.code });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Programme added.");
}

export async function addBatch(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = batchSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const { error } = await supabase.from("batches").insert({
    school_id: member.school.id,
    programme_id: parsed.data.programmeId,
    name: parsed.data.name,
    entry_year: parsed.data.entryYear,
  });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Batch added.");
}

export async function addCourse(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = courseSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const { error } = await supabase
    .from("courses")
    .insert({ school_id: member.school.id, code: parsed.data.code, title: parsed.data.title });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Course added.");
}

export async function addCourseRun(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = courseRunSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { data: run, error } = await supabase
    .from("course_runs")
    .insert({
      school_id: member.school.id,
      course_id: parsed.data.courseId,
      academic_period_id: parsed.data.academicPeriodId,
    })
    .select("id")
    .single();
  if (error) return failed(error, values);

  if (parsed.data.lecturerId) {
    const { error: staffError } = await supabase
      .from("course_run_staff")
      .insert({ school_id: member.school.id, course_run_id: run.id, staff_id: parsed.data.lecturerId });
    if (staffError) return failed(staffError, values);
  }
  refresh();
  return succeeded("Course added to the semester.");
}

export async function addLecturer(courseRunId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return failed("Choose a lecturer.");
  const { error } = await supabase
    .from("course_run_staff")
    .insert({ school_id: member.school.id, course_run_id: courseRunId, staff_id: staffId });
  if (error) {
    if (error.code === "23505") return failed("That lecturer is already on this course.");
    return failed(error);
  }
  refresh();
  return succeeded("Lecturer added.");
}

export async function removeLecturer(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const { error } = await supabase
    .from("course_run_staff")
    .delete()
    .eq("course_run_id", String(formData.get("courseRunId") ?? ""))
    .eq("staff_id", String(formData.get("staffId") ?? ""))
    .eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Removed.");
}

export async function removeRecord(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");
  if (table !== "programmes" && table !== "batches" && table !== "courses" && table !== "course_runs") {
    return failed("Unknown record.");
  }
  const { error } = await supabase.from(table).delete().eq("id", id).eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Removed.");
}
