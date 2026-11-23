"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { type FormState, failed, formValues, succeeded } from "@/lib/forms";

/** The workspace owner asks to move it into a school where they are staff. */
export async function requestMove(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireStaff();
  const values = formValues(formData);
  if (!member.school.isWorkspace) return failed("Only a workspace can be moved.");
  const code = (values.schoolCode ?? "").trim();
  if (code.length < 4) return { status: "error", fieldErrors: { schoolCode: "Enter the school's code." }, values };
  const { error } = await supabase.rpc("request_workspace_move", { p_workspace_id: member.school.id, p_school_code: code });
  if (error) return { status: "error", fieldErrors: { schoolCode: error.message }, values };
  refresh();
  return succeeded("Request sent. The school's admins will review it.");
}

export async function cancelMove(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("cancel_workspace_move", { p_move_id: String(formData.get("moveId") ?? "") });
  if (error) return failed(error);
  refresh();
  return succeeded("Request cancelled.");
}

export async function approveMove(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("approve_workspace_move", { p_move_id: String(formData.get("moveId") ?? "") });
  if (error) return failed(error);
  redirect("/dashboard?moved=1");
}

export async function declineMove(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("decline_workspace_move", {
    p_move_id: String(formData.get("moveId") ?? ""),
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) return failed(error);
  redirect("/dashboard?moved=declined");
}
