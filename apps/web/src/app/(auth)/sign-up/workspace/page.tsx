import { WORKSPACE_FREE_STUDENTS } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { WorkspaceFields } from "@/components/workspace-fields";
import { registerWorkspace } from "@/lib/workspace-actions";
import { SignUpChoice } from "../sign-up-choice";

export const metadata: Metadata = { title: "Start your workspace" };

export default function WorkspaceSignUpPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <SignUpChoice current="workspace" />
      <h1 className="text-xl font-semibold">Start your own workspace</h1>
      <p className="mt-1 text-sm text-muted">
        For one teacher or lecturer, without a school: your own classes or courses, registers, students and reports. Free for
        up to {WORKSPACE_FREE_STUDENTS} students.
      </p>

      <ActionForm action={registerWorkspace} className="mt-6 space-y-4">
        <WorkspaceFields />
        <hr className="border-line" />
        <TextField name="email" label="Your email" type="email" inputMode="email" autoComplete="email" />
        <TextField name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." />
        <FormMessage />
        <SubmitButton className="w-full" pendingLabel="Creating your workspace...">
          Create workspace
        </SubmitButton>
        <p className="text-xs text-muted">
          By registering, you agree to handle student and guardian details as described in our{" "}
          <a href="/privacy" className="text-accent hover:underline">
            privacy policy
          </a>
          .
        </p>
      </ActionForm>

      <p className="mt-5 text-sm text-muted">
        Already registered?{" "}
        <Link href="/sign-in" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
