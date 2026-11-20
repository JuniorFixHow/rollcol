import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InlineAction } from "@/components/form";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, LinkButton, Notice, PageHeader } from "@/components/ui";
import { requireStaff, requireUser } from "@/lib/auth";
import { type FormState, failed } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Your account" };

async function deleteAccount(): Promise<FormState> {
  "use server";
  const { supabase, userId } = await requireUser();

  // Ask the database what deletion would do. It also blocks the last admin itself.
  const { data: effect, error } = await supabase.rpc("account_deletion_effect");
  if (error) return failed(error);
  if (effect === "last_admin") {
    return failed("You are the only admin. Make another staff member an admin first.");
  }

  const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(userId);
  if (deleteError) return failed("We could not delete your account. Please try again or contact support.");

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

export default async function AccountPage() {
  const { supabase, member } = await requireStaff();
  const [{ data: effect }, { data: user }] = await Promise.all([
    supabase.rpc("account_deletion_effect"),
    supabase.auth.getUser(),
  ]);

  return (
    <>
      <PageHeader title="Your account" />
      <div className="space-y-6">
        <Card title="Sign-in details">
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">Name</dt>
            <dd>{member.fullName}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{user.user?.email}</dd>
            <dt className="text-muted">School code</dt>
            <dd className="font-mono">{member.school.code}</dd>
            <dt className="text-muted">School ID</dt>
            <dd className="font-mono">{member.schoolNumber}</dd>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/account/password" variant="secondary" size="sm">
              Change password
            </LinkButton>
            <SignOutButton />
          </div>
        </Card>

        <Card title="Delete your account" description="This removes your RollCol account and signs you out. It cannot be undone.">
          {effect === "last_admin" ? (
            <Notice tone="warning">You are the only admin. Make another staff member an admin before deleting your account.</Notice>
          ) : (
            <div className="space-y-4">
              {effect === "deletes_school" ? (
                <Notice tone="danger" title="This also deletes your school">
                  You are the only staff member, so {member.school.name} and all its records (students, guardians and
                  attendance) will be deleted too.
                </Notice>
              ) : (
                <p className="text-sm text-muted">Records you created for the school, such as registers, stay with the school.</p>
              )}
              <InlineAction
                action={deleteAccount}
                label="Delete my account"
                variant="danger"
                pendingLabel="Deleting..."
                confirm={
                  effect === "deletes_school"
                    ? `Delete your account and ${member.school.name}, with all its records? This cannot be undone.`
                    : "Delete your RollCol account? This cannot be undone."
                }
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
