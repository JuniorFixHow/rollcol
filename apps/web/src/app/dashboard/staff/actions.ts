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

  // Someone who already has a RollCol account (staff or a student at another
  // school) is added straight away. Anyone else gets an invite email.
  // Finding or creating the Auth user needs the service role. Adding them to the
  // school does not: that insert runs as the admin, so RLS decides whether it is allowed.
  const admin = createAdminClient();
  const { data: existingUserId, error: lookupError } = await admin.rpc("find_user_id_by_email", { p_email: input.email });
  if (lookupError) return failed("We could not check that email address. Please try again.", values);

  let userId: string;
  let invitedNewAccount = false;
  if (existingUserId) {
    userId = existingUserId;
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: `${getSiteUrl()}/auth/confirm?next=/account/password`,
      // Shown in the invite email (see supabase/templates/invite.html).
      data: { full_name: input.fullName, school_name: member.school.name },
    });
    if (inviteError || !invited.user) {
      return failed("We could not send the invite. Check the email address and try again.", values);
    }
    userId = invited.user.id;
    invitedNewAccount = true;
  }

  const { error } = await supabase.from("staff").insert({
    school_id: member.school.id,
    user_id: userId,
    school_number: input.schoolId,
    full_name: input.fullName,
    email: input.email,
    role: input.role,
  });
  if (error) {
    // Undo a fresh invite so the person can be invited again once the problem is fixed.
    if (invitedNewAccount) await admin.auth.admin.deleteUser(userId);
    return failed(error, values);
  }

  refresh();
  if (!invitedNewAccount) {
    return succeeded(
      `${input.email} already has a RollCol account, so they were added straight away. They will see ${member.school.name} the next time they sign in.`,
    );
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

  // An account that no longer belongs to any school goes too. People who are
  // still staff or students elsewhere keep their account.
  if (data?.user_id) {
    const admin = createAdminClient();
    const { data: remaining } = await admin.rpc("membership_count", { p_user_id: data.user_id });
    if (remaining === 0) await admin.auth.admin.deleteUser(data.user_id);
  }
  refresh();
  return succeeded("Removed.");
}

export async function grantDelegation(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = guardianDelegationSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  // The chosen time is Ghana time, which is UTC+0. The database also rejects past times.
  const expiresAt = new Date(`${parsed.data.expiresAt}:00Z`);
  if (Number.isNaN(expiresAt.getTime())) return failed("Choose a date and time.", values);
  if (expiresAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    return failed("Choose a time later than now.", values);
  }

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
