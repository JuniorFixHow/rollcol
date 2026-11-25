"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, succeeded } from "@/lib/forms";

function linkId(formData: FormData): string {
  return String(formData.get("linkId") ?? "");
}

export async function approveParentLink(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("approve_parent_link", { p_link_id: linkId(formData) });
  if (error) return failed(error);
  refresh();
  return succeeded("Confirmed.");
}

export async function removeParentLink(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("remove_parent_link", { p_link_id: linkId(formData) });
  if (error) return failed(error);
  refresh();
  return succeeded("Removed.");
}

export async function setLinkApproval(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const required = formData.get("required") === "true";
  const { error } = await supabase.rpc("set_parent_link_approval", { p_school_id: member.school.id, p_required: required });
  if (error) return failed(error);
  refresh();
  return succeeded(required ? "New links now wait for an admin." : "New links work straight away.");
}

/** Approving changes the guardian's number (both numbers are told by SMS; the app link ends). */
export async function decideNumberChange(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const approve = formData.get("approve") === "true";
  const { error } = await supabase.rpc("decide_phone_request", { p_id: String(formData.get("id") ?? ""), p_approve: approve });
  if (error) return failed(error);
  refresh();
  return succeeded(approve ? "Approved. The guardian's number is changed." : "Declined. The parent has been told.");
}
