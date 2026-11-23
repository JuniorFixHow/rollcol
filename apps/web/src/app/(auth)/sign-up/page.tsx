import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { SchoolFields } from "@/components/school-fields";
import { registerSchool } from "./actions";
import { SignUpChoice } from "./sign-up-choice";

export const metadata: Metadata = { title: "Register your school" };

export default function SignUpPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <SignUpChoice current="school" />
      <h1 className="text-xl font-semibold">Register your school</h1>
      <p className="mt-1 text-sm text-muted">
        Start right away. RollCol checks every new school, and some limits apply until yours is verified. Teaching on your
        own? Choose <strong className="font-medium text-foreground">Just me</strong> above.
      </p>

      <ActionForm action={registerSchool} className="mt-6 space-y-4">
        <SchoolFields />
        <hr className="border-line" />
        <TextField name="email" label="Your email" type="email" inputMode="email" autoComplete="email" />
        <TextField name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." />
        <FormMessage />
        <SubmitButton className="w-full" pendingLabel="Creating your account...">
          Create school account
        </SubmitButton>
        <p className="text-xs text-muted">
          By registering, you agree to our{" "}
          <a href="/terms" className="text-accent hover:underline">
            terms of use
          </a>{" "}
          and to handle student and guardian details as described in our{" "}
          <a href="/privacy" className="text-accent hover:underline">
            privacy policy
          </a>
          .
        </p>
      </ActionForm>

      <p className="mt-5 text-sm text-muted">
        <a href="/pricing" className="text-accent hover:underline">
          See prices
        </a>{" "}
        · Already registered?{" "}
        <Link href="/sign-in" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
