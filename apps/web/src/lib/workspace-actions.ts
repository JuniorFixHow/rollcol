"use server";

import { accountSchema, workspaceDetailsSchema } from "@rollcol/shared";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";
import { rememberSchool } from "@/lib/school-actions";
import { getSiteUrl } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function readWorkspace(values: Record<string, string>) {
  return workspaceDetailsSchema.safeParse({
    ...values,
    registerMode: values.type === "non_tertiary" && values.registerMode ? values.registerMode : undefined,
  });
}

async function create(
  supabase: Supabase,
  input: { name: string; type: "tertiary" | "non_tertiary"; registerMode?: "daily" | "per_period" | null; contactPhone: string; fullName: string },
) {
  return supabase.rpc("create_workspace", {
    p_name: input.name,
    p_type: input.type,
    p_contact_phone: input.contactPhone,
    p_full_name: input.fullName,
    ...(input.type === "non_tertiary" && input.registerMode ? { p_register_mode: input.registerMode } : {}),
  });
}

/** A signed-in person starts a workspace (onboarding, or from Your account). */
export async function createWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const values = formValues(formData);
  const parsed = readWorkspace(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const { data, error } = await create(supabase, parsed.data);
  if (error) return failed(error, values);
  await supabase.auth.updateUser({ data: { pending_workspace: null } });
  const created = data[0];
  if (created) await rememberSchool(created.school_id);
  redirect("/dashboard");
}

const signUpSchema = workspaceDetailsSchema.and(accountSchema);

/** A new account and its workspace in one go. */
export async function registerWorkspace(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse({
    ...values,
    registerMode: values.type === "non_tertiary" && values.registerMode ? values.registerMode : undefined,
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;
  const pendingWorkspace = {
    name: input.name,
    type: input.type,
    register_mode: input.type === "tertiary" ? null : (input.registerMode ?? null),
    contact_phone: input.contactPhone,
    full_name: input.fullName,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/onboarding/workspace`,
      // Kept until the workspace is created, so sign-up can finish after email confirmation.
      data: { full_name: input.fullName, pending_workspace: pendingWorkspace },
    },
  });
  const exists = "An account with this email already exists. Sign in, then choose Start a workspace from Your account.";
  if (error) {
    if (error.code === "weak_password") return failed("Choose a stronger password.", values);
    if (error.code === "user_already_exists") return failed(exists, values);
    if (error.status === 429) return failed("Too many sign-ups from here. Wait a few minutes, then try again.", values);
    return failed("We could not create your account. Please try again.", values);
  }
  if (data.user && data.user.identities?.length === 0) return failed(exists, values);
  if (!data.session) redirect("/sign-up/check-email");

  const { data: created, error: createError } = await create(supabase, {
    ...input,
    registerMode: pendingWorkspace.register_mode,
  });
  // The account exists either way; onboarding lets them fix and retry.
  if (createError) redirect("/onboarding/workspace");
  await supabase.auth.updateUser({ data: { pending_workspace: null } });
  const workspace = created[0];
  if (workspace) await rememberSchool(workspace.school_id);
  redirect("/dashboard");
}
