import { passwordSchema } from "@rollcol/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { homeFor, requireUser } from "@/lib/auth";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";

export const metadata: Metadata = { title: "Choose a password" };

async function setPassword(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { supabase, member } = await requireUser();
  const values = formValues(formData);
  const parsed = passwordSchema.safeParse(values.password);
  if (!parsed.success) return { ...invalid(parsed.error), fieldErrors: { password: parsed.error.issues[0]?.message } };
  if (values.password !== values.confirmPassword) {
    return { status: "error", message: "The passwords do not match.", fieldErrors: { confirmPassword: "Enter the same password again." } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return failed("Choose a password you have not used before.");
    if (error.code === "weak_password") return failed("Choose a stronger password.");
    return failed("We could not save your password. Open the link from your email again.");
  }
  redirect(homeFor(member));
}

// Reached from invite and password reset emails, which sign the person in first.
export default function SetPasswordPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Choose a password</h1>
      <p className="mt-1 text-sm text-muted">You will use it with your email or school ID to sign in.</p>
      <ActionForm action={setPassword} className="mt-5 space-y-4">
        <TextField name="password" label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." />
        <TextField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />
        <FormMessage />
        <SubmitButton className="w-full">Save password</SubmitButton>
      </ActionForm>
    </div>
  );
}
