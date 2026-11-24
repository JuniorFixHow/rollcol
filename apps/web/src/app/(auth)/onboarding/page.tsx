import { pendingSchoolSchema, pendingStudentJoinSchema, pendingWorkspaceSchema, schoolDetailsSchema } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { SchoolFields } from "@/components/school-fields";
import { SignOutButton } from "@/components/sign-out-button";
import { PageSkeleton } from "@/components/ui";
import { getSession, requireUser } from "@/lib/auth";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";
import { rememberSchool } from "@/lib/school-actions";
import { SignUpChoice } from "../sign-up/sign-up-choice";

export const metadata: Metadata = { title: "Set up your school" };

// This page depends on the signed-in user, so navigation into it blocks on the server
// (the same as the dashboard and platform pages).
export const instant = false;

async function createSchool(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { isParent, supabase } = await requireUser();
  if (isParent) redirect("/parent");

  const values = formValues(formData);
  const parsed = schoolDetailsSchema.safeParse({
    ...values,
    registerMode: values.registerMode === "" ? undefined : values.registerMode,
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;

  const { data, error } = await supabase.rpc("create_school", {
    p_name: input.name,
    p_type: input.type,
    p_contact_phone: input.contactPhone,
    p_admin_full_name: input.adminFullName,
    p_admin_school_number: input.adminSchoolId,
    ...(input.type === "non_tertiary" && input.registerMode ? { p_register_mode: input.registerMode } : {}),
  });
  if (error) return failed(error, values);

  await supabase.auth.updateUser({ data: { pending_school: null } });
  const created = data[0];
  if (created) await rememberSchool(created.school_id);
  redirect("/dashboard");
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/onboarding");
  const { supabase, memberships } = session;

  const { data } = await supabase.auth.getUser();
  const metadata: unknown = data.user?.user_metadata;

  const studentJoin = pendingStudentJoinSchema.safeParse(metadata);
  if (studentJoin.success) {
    // A student confirmed their email on the web: finish joining here, as the app does.
    const join = studentJoin.data.pending_join;
    if (!memberships.some((m) => m.school.code === join.school_code)) {
      const { error } = await supabase.rpc("join_school_as_student", {
        p_school_code: join.school_code,
        p_school_number: join.school_id,
        p_full_name: join.full_name,
      });
      if (error) redirect("/students-use-the-app");
    }
    await supabase.auth.updateUser({ data: { pending_join: null } });
    redirect("/student");
  }
  // Signed up for a workspace and confirmed the email.
  if (pendingWorkspaceSchema.safeParse(metadata).success) redirect("/onboarding/workspace");

  const pending = pendingSchoolSchema.safeParse(metadata);
  const defaults = pending.success
    ? {
        name: pending.data.pending_school.name,
        type: pending.data.pending_school.type,
        registerMode: pending.data.pending_school.register_mode ?? undefined,
        contactPhone: pending.data.pending_school.contact_phone,
        adminFullName: pending.data.pending_school.admin_full_name,
        adminSchoolId: pending.data.pending_school.admin_school_id,
      }
    : undefined;

  // Someone who already belongs to a school is registering another one.
  const another = !defaults && memberships.length > 0;
  const title = defaults ? "Finish setting up your school" : another ? "Register another school" : "Set up your school";
  const intro = defaults
    ? "Your email is confirmed. Check these details, then create your school."
    : another
      ? "You will be this school's first admin. Your other schools are not affected, and you can switch between them from the dashboard."
      : "Your account is not part of a school yet. Register your school below. If your school already uses RollCol, ask its admin to invite you instead. Teaching on your own? Choose Just me.";

  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      {defaults ? null : <SignUpChoice current="school" base="/onboarding" />}
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{intro}</p>
      <ActionForm action={createSchool} className="mt-6 space-y-4">
        <SchoolFields defaults={defaults} />
        <FormMessage />
        <SubmitButton className="w-full" pendingLabel="Creating your school...">
          Create school
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
