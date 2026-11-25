"use server";

import { describeDatabaseError, isAbsenceReason, normalisePhone } from "@rollcol/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { type FormState, failed, formValues, succeeded } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";

/** Links the parent's children: one of a child's names, as the school has it. */
export async function linkChildren(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const values = formValues(formData);
  const name = (values.name ?? "").trim();
  if (name.length < 2) return failed("Type one of your child's names, as the school has it.", values);

  const { data, error } = await supabase.rpc("parent_link_children", { p_name: name });
  if (error) {
    if (/too many tries/i.test(error.message)) {
      return failed("Too many tries. Try again tomorrow, or ask the school to check your child's name.", values);
    }
    if (/already linked/i.test(error.message)) {
      return failed("Your children are already linked at every school that has your number.", values);
    }
    return failed("RollCol could not link your child. Please try again.", values);
  }
  const result = data[0];
  if (!result || result.linked + result.pending === 0) {
    return failed("That name does not match a child on the school's records with your number. Check the spelling and try again.", values);
  }
  revalidatePath("/parent", "layout");
  if (result.remaining > 0) {
    return succeeded(
      result.pending > 0
        ? "Done. The school will confirm the link. Another school also has your number: type the name of your child there."
        : "Linked. Another school also has your number: type the name of your child there.",
    );
  }
  redirect("/parent");
}

/** The parent removes a school (they can link again with a child's name). */
export async function unlinkSchool(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("parent_unlink", { p_link_id: String(formData.get("linkId") ?? "") });
  if (error) return failed("RollCol could not remove this link. Please try again.");
  refresh();
  return succeeded("Removed.");
}

/** Deletes messages from the parent's own list; the school keeps its record. */
export async function deleteMessages(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const id = Number(formData.get("messageId"));
  const all = formData.get("all") === "true";
  if (!all && (!Number.isSafeInteger(id) || id <= 0)) return failed("Choose a message.");
  const { error } = await supabase.rpc("parent_delete_messages", all ? {} : { p_ids: [id] });
  if (error) return failed("RollCol could not delete this. Please try again.");
  revalidatePath("/parent", "layout");
  if (!all) redirect("/parent/messages");
  return succeeded("Deleted.");
}

/** Opening Messages (or one message) clears its unread count. */
export async function markMessagesRead(smsId: number | null): Promise<void> {
  const { supabase } = await requireParent();
  await supabase.rpc("mark_messages_read", smsId ? { p_sms_id: smsId } : {});
  revalidatePath("/parent", "layout");
}

export async function deleteParentAccount(): Promise<FormState> {
  const { supabase, userId } = await requireParent();
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) return failed("We could not delete your account. Please try again.");
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?deleted=1");
}

/** A pickup code for someone else to collect the child (today or within a week). */
export async function createPickup(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const values = formValues(formData);
  const studentId = values.studentId ?? "";
  if (!studentId) return failed("Choose the child.", values);
  const name = (values.collectorName ?? "").trim();
  if (name.length < 2) return failed("Type the name of the person collecting your child.", values);
  const phone = (values.collectorPhone ?? "").trim();
  const normalised = phone ? normalisePhone(phone) : null;
  if (phone && !normalised) return failed("Check the collector's phone number, or leave it empty.", values);
  const { data, error } = await supabase.rpc("parent_create_pickup", {
    p_student_id: studentId,
    p_date: values.date || null,
    p_collector_name: name,
    p_collector_phone: normalised,
  });
  if (error) return failed(describeDatabaseError(error), values);
  refresh();
  return succeeded(`Code ${data[0]?.code ?? ""} is ready for ${name}. Give it to them: the teacher asks for it before releasing your child.`);
}

export async function cancelPickup(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("parent_cancel_pickup", { p_id: String(formData.get("id") ?? "") });
  if (error) return failed(describeDatabaseError(error));
  refresh();
  return succeeded("Cancelled.");
}

/** Tells the school ahead that the child will be absent. */
export async function reportAbsence(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const values = formValues(formData);
  const studentId = values.studentId ?? "";
  if (!studentId) return failed("Choose the child.", values);
  if (!values.from) return failed("Choose the first day.", values);
  if (!isAbsenceReason(values.reason)) return failed("Choose a reason.", values);
  const { error } = await supabase.rpc("parent_report_absence", {
    p_student_id: studentId,
    p_from: values.from,
    p_to: values.to || values.from,
    p_reason: values.reason,
    p_note: values.note || null,
  });
  if (error) return failed(describeDatabaseError(error), values);
  refresh();
  return succeeded("Reported. The class teacher has been told.");
}

export async function cancelAbsence(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("parent_cancel_absence", { p_id: String(formData.get("id") ?? "") });
  if (error) return failed(describeDatabaseError(error));
  refresh();
  return succeeded("Cancelled.");
}
