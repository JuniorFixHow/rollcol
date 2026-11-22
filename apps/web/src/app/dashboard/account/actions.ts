"use server";

import { emailSchema, personNameSchema } from "@rollcol/shared";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { type FormState, failed, formValues, succeeded } from "@/lib/forms";
import { getSiteUrl } from "@/lib/supabase/admin";

/** Your name, in every school you belong to. */
export async function updateMyName(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const values = formValues(formData);
  const parsed = personNameSchema.safeParse(values.fullName);
  if (!parsed.success) {
    return { status: "error", message: "Check your name.", fieldErrors: { fullName: parsed.error.issues[0]?.message }, values };
  }
  const { error } = await supabase.rpc("update_my_name", { p_full_name: parsed.data });
  if (error) return failed(error);
  // Also the name on the sign-in account (used in emails from RollCol).
  await supabase.auth.updateUser({ data: { full_name: parsed.data } });
  revalidatePath("/dashboard", "layout");
  return succeeded("Your name is saved.");
}

/**
 * A new email takes effect when the person opens the link sent to it, so a
 * typing mistake cannot lock them out. The staff records follow it then.
 */
export async function updateMyEmail(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const values = formValues(formData);
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success) {
    return { status: "error", message: "Check the email address.", fieldErrors: { email: parsed.error.issues[0]?.message }, values };
  }
  const { data: current } = await supabase.auth.getUser();
  if (current.user?.email?.toLowerCase() === parsed.data.toLowerCase()) {
    return { status: "error", fieldErrors: { email: "This is already your email." }, values };
  }
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/dashboard/account` },
  );
  if (error) {
    if (error.code === "email_exists") {
      return { status: "error", fieldErrors: { email: "Another RollCol account already uses this email." }, values };
    }
    if (error.code === "over_email_send_rate_limit") return failed("Too many emails were sent. Wait a few minutes and try again.");
    return failed("We could not change your email. Please try again.");
  }
  return succeeded(
    `We sent a link to ${parsed.data}. Your email changes when you open it. Until then, keep signing in with your current email.`,
  );
}
