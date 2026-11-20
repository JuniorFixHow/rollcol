"use server";

import { classSchema, classSubjectSchema, subjectSchema } from "@rollcol/shared";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formValues, invalid, succeeded } from "@/lib/forms";

export async function createClass(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = classSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase.from("classes").insert({
    school_id: member.school.id,
    name: parsed.data.name,
    class_teacher_id: parsed.data.classTeacherId,
  });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Class created.");
}

export async function updateClass(classId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = classSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase
    .from("classes")
    .update({ name: parsed.data.name, class_teacher_id: parsed.data.classTeacherId })
    .eq("id", classId)
    .eq("school_id", member.school.id);
  if (error) return failed(error, values);
  refresh();
  return succeeded("Saved.");
}

export async function deleteClass(classId: string): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const { error } = await supabase.from("classes").delete().eq("id", classId).eq("school_id", member.school.id);
  if (error) return failed(error);
  redirect("/dashboard/classes");
}

export async function createSubject(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = subjectSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase.from("subjects").insert({ school_id: member.school.id, name: parsed.data.name });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Subject added.");
}

export async function removeSubject(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", String(formData.get("subjectId") ?? ""))
    .eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Removed.");
}

export async function assignSubjectTeacher(classId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = classSubjectSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase.from("class_subjects").upsert(
    {
      school_id: member.school.id,
      class_id: classId,
      subject_id: parsed.data.subjectId,
      teacher_id: parsed.data.teacherId,
    },
    { onConflict: "class_id,subject_id" },
  );
  if (error) return failed(error, values);
  refresh();
  return succeeded("Saved.");
}

export async function removeClassSubject(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const { error } = await supabase
    .from("class_subjects")
    .delete()
    .eq("id", String(formData.get("classSubjectId") ?? ""))
    .eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Removed.");
}
