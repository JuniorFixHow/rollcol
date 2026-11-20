"use server";

import { type RegisterMarks, describeDatabaseError, isAttendanceMark, marksToPayload, startRegisterSchema } from "@rollcol/shared";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Starts today's register (or opens it, if someone already started it) and goes to it. */
export async function startRegister(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireStaff();
  if (member.school.type === "tertiary") return failed("Registers are for basic and senior high schools.");

  const values = formValues(formData);
  const parsed = startRegisterSchema.safeParse({
    classId: values.classId,
    classSubjectId: values.classSubjectId || undefined,
    periodNumber: values.periodNumber || undefined,
    rewardMarks: values.rewardMarks ?? "",
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;
  if (input.classSubjectId && !input.periodNumber) {
    return failed("Choose the period.", values);
  }

  const { data, error } = await supabase.rpc("open_register", {
    p_id: crypto.randomUUID(),
    p_class_id: input.classId,
    ...(input.classSubjectId ? { p_class_subject_id: input.classSubjectId } : {}),
    ...(input.periodNumber ? { p_period_number: input.periodNumber } : {}),
    p_reward_marks: input.rewardMarks,
  });
  if (error) return failed(error, values);
  redirect(`/dashboard/registers/${data.id}`);
}

export type SaveMarksResult = { ok: true; changed: number } | { ok: false; message: string };

/** Called by the register sheet as marks change. */
export async function saveMarks(registerId: string, marks: RegisterMarks): Promise<SaveMarksResult> {
  const { supabase } = await requireStaff();
  if (!UUID.test(registerId)) return { ok: false, message: "Register not found." };

  const clean: RegisterMarks = {};
  for (const [studentId, mark] of Object.entries(marks)) {
    if (!UUID.test(studentId)) continue;
    if (mark !== null && !isAttendanceMark(mark)) continue;
    clean[studentId] = mark;
  }
  if (Object.keys(clean).length === 0) return { ok: true, changed: 0 };

  const { data, error } = await supabase.rpc("save_register_marks", {
    p_register_id: registerId,
    p_marks: marksToPayload(clean),
  });
  if (error) return { ok: false, message: describeDatabaseError(error) };
  return { ok: true, changed: data };
}

export async function submitRegister(registerId: string): Promise<SaveMarksResult> {
  const { supabase } = await requireStaff();
  if (!UUID.test(registerId)) return { ok: false, message: "Register not found." };
  const { error } = await supabase.rpc("submit_register", { p_register_id: registerId });
  if (error) return { ok: false, message: describeDatabaseError(error) };
  refresh();
  return { ok: true, changed: 0 };
}
