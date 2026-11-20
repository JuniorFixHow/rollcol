import { emailSchema } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { type FormState, formValues, invalid, succeeded } from "@/lib/forms";
import { getSiteUrl } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reset your password" };

async function sendResetLink(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const values = formValues(formData);
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/account/password`,
  });
  // Same answer whether or not the email has an account.
  return succeeded("If that email has a RollCol account, a reset link is on its way.");
}

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter the email address on your RollCol account. Students can use this page too.</p>
      <ActionForm action={sendResetLink} className="mt-5 space-y-4">
        <TextField name="email" label="Email" type="email" inputMode="email" autoComplete="email" />
        <FormMessage />
        <SubmitButton className="w-full" pendingLabel="Sending...">
          Send reset link
        </SubmitButton>
      </ActionForm>
      <p className="mt-5 text-sm">
        <Link href="/sign-in" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
