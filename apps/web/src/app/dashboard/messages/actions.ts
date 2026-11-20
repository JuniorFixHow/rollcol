"use server";

import { broadcastSchema, smsCreditGrantSchema, studentMessageSchema } from "@rollcol/shared";
import { refresh } from "next/cache";
import { requireAdmin, requirePlatformAdmin, requireStaff } from "@/lib/auth";
import { type FormState, failed, formValues, invalid, succeeded } from "@/lib/forms";

function sentMessage(count: number): string {
  return `Queued for ${count === 1 ? "1 guardian" : `${count} guardians`}. You can follow it below.`;
}

export async function sendBroadcast(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const parsed = broadcastSchema.safeParse({
    body: formData.get("body") ?? "",
    classIds: formData.getAll("classIds").map(String),
  });
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const { data, error } = await supabase.rpc("send_broadcast", {
    p_school_id: member.school.id,
    p_body: parsed.data.body,
    p_class_ids: parsed.data.classIds.length > 0 ? parsed.data.classIds : null,
  });
  if (error) return failed(error, formValues(formData));
  refresh();
  return succeeded(sentMessage(data));
}

export async function sendStudentMessage(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const parsed = studentMessageSchema.safeParse({
    studentId: formData.get("studentId") ?? "",
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const { data, error } = await supabase.rpc("send_student_message", {
    p_student_id: parsed.data.studentId,
    p_body: parsed.data.body,
  });
  if (error) return failed(error, formValues(formData));
  refresh();
  return succeeded(sentMessage(data));
}

export async function grantCredits(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requirePlatformAdmin();
  const values = formValues(formData);
  const parsed = smsCreditGrantSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { data, error } = await supabase.rpc("grant_sms_credits", {
    p_school_id: parsed.data.schoolId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) return failed(error, values);
  refresh();
  return succeeded(`Done. The school now has ${data} credits.`);
}
