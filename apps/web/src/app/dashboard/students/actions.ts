"use server";

import { guardianSchema, personNameSchema, schoolIdSchema, studentRecordSchema } from "@rollcol/shared";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { type FormState, failed, formBoolean, formValues, invalid, succeeded } from "@/lib/forms";

export async function addStudent(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  if (member.school.type === "tertiary") return failed("Students at tertiary schools create their own accounts in the app.");
  const values = formValues(formData);
  const parsed = studentRecordSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase.from("students").insert({
    school_id: member.school.id,
    full_name: parsed.data.fullName,
    school_number: parsed.data.schoolId ?? null,
    class_id: parsed.data.classId,
  });
  if (error) return failed(error, values);
  refresh();
  return succeeded(`${parsed.data.fullName} added.`);
}

export async function setStudentStatus(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "disabled") return failed("Unknown status.");
  const { error } = await supabase
    .from("students")
    .update({ status })
    .eq("id", String(formData.get("studentId") ?? ""))
    .eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Saved.");
}

export async function updateStudent(studentId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const tertiary = member.school.type === "tertiary";

  const name = personNameSchema.safeParse(values.fullName);
  if (!name.success) return { ...invalid(name.error, values), fieldErrors: { fullName: name.error.issues[0]?.message } };
  const number = values.schoolId ? schoolIdSchema.safeParse(values.schoolId) : null;
  if (number && !number.success) {
    return { ...invalid(number.error, values), fieldErrors: { schoolId: number.error.issues[0]?.message } };
  }

  const emptyToNull = (value: string | undefined) => (value ? value : null);
  const { error } = await supabase
    .from("students")
    .update({
      full_name: name.data,
      // Tertiary students sign in with their school ID, so it cannot be cleared.
      ...(number ? { school_number: number.data } : tertiary ? {} : { school_number: null }),
      ...(tertiary
        ? { programme_id: emptyToNull(values.programmeId), batch_id: emptyToNull(values.batchId) }
        : { class_id: emptyToNull(values.classId) }),
    })
    .eq("id", studentId)
    .eq("school_id", member.school.id);
  if (error) return failed(error, values);
  refresh();
  return succeeded("Saved.");
}

export async function deleteStudent(studentId: string): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const { error } = await supabase.from("students").delete().eq("id", studentId).eq("school_id", member.school.id);
  if (error) return failed(error);
  redirect("/dashboard/students");
}

// Guardians. The database decides who may change them (admins, or teachers
// with a current delegation for students in their own classes).

export async function addGuardian(studentId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const values = formValues(formData);
  const parsed = guardianSchema.safeParse({ ...values, relationship: values.relationship || undefined });
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase.rpc("add_guardian_to_student", {
    p_student_id: studentId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    ...(parsed.data.relationship ? { p_relationship: parsed.data.relationship } : {}),
  });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Guardian added. They will get an SMS to say so.");
}

export async function updateGuardian(guardianId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const values = formValues(formData);
  const parsed = guardianSchema.pick({ fullName: true, phone: true }).safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase
    .from("guardians")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", guardianId);
  if (error) return failed(error, values);
  refresh();
  return succeeded("Saved.");
}

export async function setGuardianLinkOption(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const linkId = String(formData.get("linkId") ?? "");
  const option = String(formData.get("option") ?? "");
  const on = formBoolean(formData, "on") || formData.get("on") === "true";

  if (option === "alerts") {
    const { error } = await supabase.from("guardian_links").update({ alerts_enabled: on }).eq("id", linkId);
    if (error) return failed(error);
  } else if (option === "broadcasts") {
    const { error } = await supabase
      .from("guardians")
      .update({ broadcasts_enabled: on })
      .eq("id", String(formData.get("guardianId") ?? ""));
    if (error) return failed(error);
  } else if (option === "present") {
    const { error } = await supabase.rpc("set_present_alert_guardian", {
      p_student_id: String(formData.get("studentId") ?? ""),
      ...(on ? { p_link_id: linkId } : {}),
    });
    if (error) return failed(error);
  } else {
    return failed("Unknown option.");
  }
  refresh();
  return succeeded("Saved.");
}

export async function removeGuardianLink(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const { error, count } = await supabase
    .from("guardian_links")
    .delete({ count: "exact" })
    .eq("id", String(formData.get("linkId") ?? ""));
  if (error) return failed(error);
  if (count === 0) return failed("You cannot remove this guardian.");
  refresh();
  return succeeded("Removed.");
}
