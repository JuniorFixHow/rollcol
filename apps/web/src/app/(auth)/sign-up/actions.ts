"use server";

import { accountSchema, schoolDetailsSchema } from "@rollcol/shared";
import { redirect } from "next/navigation";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";
import { getSiteUrl } from "@/lib/supabase/admin";
import { rememberSchool } from "@/lib/school-actions";
import { createClient } from "@/lib/supabase/server";

const signUpSchema = schoolDetailsSchema.and(accountSchema);

export async function registerSchool(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse({
    ...values,
    registerMode: values.registerMode === "" ? undefined : values.registerMode,
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;

  const pendingSchool = {
    name: input.name,
    type: input.type,
    register_mode: input.type === "tertiary" ? null : (input.registerMode ?? null),
    contact_phone: input.contactPhone,
    admin_full_name: input.adminFullName,
    admin_school_id: input.adminSchoolId,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/onboarding`,
      // Kept until the school is created, so sign-up can finish after email confirmation.
      data: { full_name: input.adminFullName, pending_school: pendingSchool },
    },
  });

  if (error) {
    if (error.code === "weak_password") return failed("Choose a stronger password.", values);
    if (error.code === "user_already_exists") return failed("An account with this email already exists. Sign in, then choose Register another school from Your account.", values);
    if (error.status === 429) return failed("Too many sign-ups from here. Wait a few minutes, then try again.", values);
    return failed("We could not create your account. Please try again.", values);
  }

  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return failed("An account with this email already exists. Sign in, then choose Register another school from Your account.", values);
  }

  if (!data.session) redirect("/sign-up/check-email");

  const { data: created, error: schoolError } = await supabase.rpc("create_school", {
    p_name: pendingSchool.name,
    p_type: pendingSchool.type,
    p_contact_phone: pendingSchool.contact_phone,
    p_admin_full_name: pendingSchool.admin_full_name,
    p_admin_school_number: pendingSchool.admin_school_id,
    ...(pendingSchool.register_mode ? { p_register_mode: pendingSchool.register_mode } : {}),
  });
  // The account exists either way; onboarding lets them fix and retry.
  if (schoolError) redirect("/onboarding");

  await supabase.auth.updateUser({ data: { pending_school: null } });
  const school = created[0];
  if (school) await rememberSchool(school.school_id);
  redirect("/dashboard");
}
