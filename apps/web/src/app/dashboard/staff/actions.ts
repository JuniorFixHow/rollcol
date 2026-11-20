"use server";

import { guardianDelegationSchema, staffInviteSchema } from "@rollcol/shared";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formValues, invalid, succeeded } from "@/lib/forms";
import { createAdminClient, getSiteUrl } from "@/lib/supabase/admin";

export async function inviteStaff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = staffInviteSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;

  // Creating the Auth user needs the service role. Adding them to the school
  // does not: that insert runs as the admin, so RLS decides whether it is allowed.
  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/account/password`,
    data: { full_name: input.fullName },
  });
  if (inviteError || !invited.user) {
    if (inviteError?.code === "email_exists" || inviteError?.status === 422) {
      return failed("That email already has a RollCol account. Each account can belong to one school.", values);
    }
    return failed("We could not send the invite. Check the email address and try again.", values);
  }

  const { error } = await supabase.from("staff").insert({
    school_id: member.school.id,
    user_id: invited.user.id,
    school_number: input.schoolId,
    full_name: input.fullName,
    email: input.email,
    role: input.role,
  });
  if (error) {
    // Undo the invite so the person can be invited again once the problem is fixed.
    await admin.auth.admin.deleteUser(invited.user.id);
    return failed(error, values);
  }

  refresh();
  return succeeded(`Invite sent to ${input.email}.`);
}

export async function updateStaff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  const change = String(formData.get("change") ?? "");

  const patch =
    change === "make_admin"
      ? { role: "admin" as const }
      : change === "make_teacher"
        ? { role: "teacher" as const }
        : change === "disable"
          ? { status: "disabled" as const }
          : change === "enable"
            ? { status: "active" as const }
            : null;
  if (!patch) return failed("Unknown change.");

  const { error } = await supabase.from("staff").update(patch).eq("id", staffId).eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Saved.");
}

export async function removeStaff(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  if (staffId === member.id) return failed("You cannot remove yourself. Delete your account from Your account instead.");

  const { data, error } = await supabase
    .from("staff")
    .delete()
    .eq("id", staffId)
    .eq("school_id", member.school.id)
    .select("user_id")
    .maybeSingle();
  if (error) return failed(error);

  // Staff accounts exist only for their school, so the Auth user goes too.
  if (data?.user_id) await createAdminClient().auth.admin.deleteUser(data.user_id);
  refresh();
  return succeeded("Removed.");
}

export async function grantDelegation(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = guardianDelegationSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  // Valid to the end of the chosen day in Ghana (UTC+0). The database rejects past dates.
  const expiresAt = new Date(`${parsed.data.expiresOn}T23:59:59Z`);

  // One active delegation per teacher: end any current one first.
  // The database stamps revoked_at with its own clock.
  await supabase
    .from("guardian_delegations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("staff_id", parsed.data.staffId)
    .is("revoked_at", null);

  const { error } = await supabase.from("guardian_delegations").insert({
    school_id: member.school.id,
    staff_id: parsed.data.staffId,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Saved. The teacher can now manage guardians for their own classes.");
}

export async function revokeDelegation(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const delegationId = String(formData.get("delegationId") ?? "");
  const { error } = await supabase
    .from("guardian_delegations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", delegationId)
    .eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Stopped.");
}
