import { pendingSchoolSchema, pendingStudentJoinSchema, schoolDetailsSchema } from "@rollcol/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { SchoolFields } from "@/components/school-fields";
import { SignOutButton } from "@/components/sign-out-button";
import { PageSkeleton } from "@/components/ui";
import { getSession, homeFor, requireUser } from "@/lib/auth";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";

export const metadata: Metadata = { title: "Set up your school" };

async function createSchool(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { supabase, member } = await requireUser();
  if (member.kind !== "none") redirect(homeFor(member));

  const values = formValues(formData);
  const parsed = schoolDetailsSchema.safeParse({
    ...values,
    registerMode: values.registerMode === "" ? undefined : values.registerMode,
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;

  const { error } = await supabase.rpc("create_school", {
    p_name: input.name,
    p_type: input.type,
    p_contact_phone: input.contactPhone,
    p_admin_full_name: input.adminFullName,
    p_admin_school_number: input.adminSchoolId,
    ...(input.type === "non_tertiary" && input.registerMode ? { p_register_mode: input.registerMode } : {}),
  });
  if (error) return failed(error, values);

  await supabase.auth.updateUser({ data: { pending_school: null } });
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
  const { supabase, member } = session;
  if (member.kind !== "none") redirect(homeFor(member));
  if (member.isPlatformAdmin) redirect("/platform");

  const { data } = await supabase.auth.getUser();
  const metadata: unknown = data.user?.user_metadata;

  // A student confirmed their email on the web; joining finishes in the app.
  if (pendingStudentJoinSchema.safeParse(metadata).success) redirect("/students-use-the-app");

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

  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">{defaults ? "Finish setting up your school" : "Set up your school"}</h1>
      <p className="mt-1 text-sm text-muted">
        {defaults
          ? "Your email is confirmed. Check these details, then create your school."
          : "Your account is not part of a school yet. Register your school below. If your school already uses RollCol, ask its admin to invite you instead."}
      </p>
      <ActionForm action={createSchool} className="mt-6 space-y-4">
        <SchoolFields defaults={defaults} />
        <FormMessage />
        <SubmitButton className="w-full" pendingLabel="Creating your school...">
          Create school
        </SubmitButton>
      </ActionForm>
      <div className="mt-5 flex justify-end">
        <SignOutButton variant="ghost" />
      </div>
    </div>
  );
}
