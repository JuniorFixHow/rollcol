import { WORKSPACE_FREE_STUDENTS, pendingWorkspaceSchema } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { SignOutButton } from "@/components/sign-out-button";
import { PageSkeleton } from "@/components/ui";
import { WorkspaceFields } from "@/components/workspace-fields";
import { getSession } from "@/lib/auth";
import { createWorkspace } from "@/lib/workspace-actions";
import { SignUpChoice } from "../../sign-up/sign-up-choice";

export const metadata: Metadata = { title: "Start your workspace" };

export const instant = false;

export default function WorkspaceOnboardingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/onboarding/workspace");
  const { supabase, memberships } = session;
  const { data } = await supabase.auth.getUser();
  const pending = pendingWorkspaceSchema.safeParse(data.user?.user_metadata);
  const defaults = pending.success
    ? {
        name: pending.data.pending_workspace.name,
        type: pending.data.pending_workspace.type,
        registerMode: pending.data.pending_workspace.register_mode ?? undefined,
        contactPhone: pending.data.pending_workspace.contact_phone,
        fullName: pending.data.pending_workspace.full_name,
      }
    : undefined;
  const another = !defaults && memberships.length > 0;

  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      {defaults ? null : <SignUpChoice current="workspace" base="/onboarding" />}
      <h1 className="text-xl font-semibold">{defaults ? "Finish setting up your workspace" : "Start your own workspace"}</h1>
      <p className="mt-1 text-sm text-muted">
        {defaults
          ? "Your email is confirmed. Check these details, then create your workspace."
          : `For you alone, without a school: your own classes or courses, registers, students and reports. Free for up to ${WORKSPACE_FREE_STUDENTS} students.${
              another ? " Your schools are not affected, and you can switch between them and your workspace." : ""
            }`}
      </p>
      <ActionForm action={createWorkspace} className="mt-6 space-y-4">
        <WorkspaceFields defaults={defaults} />
        <FormMessage />
        <SubmitButton className="w-full" pendingLabel="Creating your workspace...">
          Create workspace
        </SubmitButton>
      </ActionForm>
      <div className="mt-5 flex items-center justify-between gap-3">
        {another ? (
          <Link href="/dashboard" className="text-sm text-accent hover:underline">
            Back to the dashboard
          </Link>
        ) : (
          <span />
        )}
        <SignOutButton variant="ghost" />
      </div>
    </div>
  );
}
