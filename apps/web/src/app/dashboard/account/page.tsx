import { staffRoleLabel } from "@rollcol/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemePicker } from "@/components/theme";
import { Card, LinkButton, Notice, PageHeader } from "@/components/ui";
import { requireStaff, requireUser } from "@/lib/auth";
import { type FormState, failed } from "@/lib/forms";
import { switchSchool } from "@/lib/school-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateMyEmail, updateMyName } from "./actions";

export const metadata: Metadata = { title: "Your account" };

interface DeletionEffect {
  school_id: string;
  school_name: string;
  effect: string;
}

function namesOf(effects: readonly DeletionEffect[]): string {
  const names = effects.map((e) => e.school_name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

async function deleteAccount(): Promise<FormState> {
  "use server";
  const { supabase, userId } = await requireUser();

  // Ask the database what deletion would do. It also blocks the last admin itself.
  const { data: effects, error } = await supabase.rpc("account_deletion_effects");
  if (error) return failed(error);
  const blocked = effects.filter((e) => e.effect === "last_admin");
  if (blocked.length > 0) {
    return failed(`You are the only admin at ${namesOf(blocked)}. Make another staff member an admin there first.`);
  }

  const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(userId);
  if (deleteError) return failed("We could not delete your account. Please try again or contact support.");

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

export default async function AccountPage() {
  const { supabase, member, memberships } = await requireStaff();
  const [{ data: effectRows }, { data: user }] = await Promise.all([
    supabase.rpc("account_deletion_effects"),
    supabase.auth.getUser(),
    // Keeps staff records on the address the person signs in with.
    supabase.rpc("sync_my_email"),
  ]);
  const effects: DeletionEffect[] = effectRows ?? [];
  const blocked = effects.filter((e) => e.effect === "last_admin");
  const deletedSchools = effects.filter((e) => e.effect === "deletes_school");

  return (
    <>
      <PageHeader title="Your account" />
      <div className="space-y-6">
        <Card title="Your details" description="Your name is what colleagues, students and guardians see, in every school you belong to.">
          <div className="grid gap-6 lg:grid-cols-2">
            <ActionForm action={updateMyName} className="space-y-3">
              <TextField
                name="fullName"
                label="Full name"
                autoComplete="name"
                defaultValue={member.fullName}
                hint="Include your title if you use one, for example Mr. Samuel Ankrah or Dr. Felicia Mensah."
              />
              <FormMessage />
              <SubmitButton size="sm">Save name</SubmitButton>
            </ActionForm>
            <ActionForm action={updateMyEmail} className="space-y-3">
              <TextField
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                defaultValue={user.user?.email ?? ""}
                hint="You sign in with this email. We send a link to the new address to confirm it."
              />
              <FormMessage />
              <SubmitButton size="sm" variant="secondary">
                Change email
              </SubmitButton>
            </ActionForm>
          </div>
          {user.user?.new_email ? (
            <div className="mt-4">
              <Notice>
                Waiting for you to confirm {user.user.new_email}. Open the link we sent there. Until then you sign in with{" "}
                {user.user.email}.
              </Notice>
            </div>
          ) : null}
        </Card>

        <Card title="Sign-in details">
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">School code</dt>
            <dd className="font-mono">{member.school.code}</dd>
            <dt className="text-muted">School ID</dt>
            <dd className="font-mono">{member.schoolNumber}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">
            The school code and school ID are for {member.school.name}; only an admin can change your school ID or role. One
            email and password work for all your schools.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/account/password" variant="secondary" size="sm">
              Change password
            </LinkButton>
            <SignOutButton />
          </div>
        </Card>

        <Card title="Appearance" description="Follow your device, or always use light or dark. Remembered in this browser.">
          <ThemePicker />
        </Card>

        <Card title="Your schools and workspaces" description="One RollCol account can belong to several schools, and have its own workspaces.">
          <ul className="divide-y divide-line text-sm">
            {memberships.map((m) => {
              const current = m.school.id === member.school.id && m.kind === "staff";
              const role = m.kind === "staff" ? (m.school.isWorkspace ? "Your workspace" : staffRoleLabel(m.role, m.school.type)) : "Student";
              return (
                <li key={`${m.kind}-${m.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.school.name}</p>
                    <p className="text-xs text-muted">
                      {role} · School ID {m.schoolNumber}
                      {m.status !== "active" ? ` · ${m.status === "pending" ? "Waiting for approval" : "Turned off"}` : ""}
                    </p>
                  </div>
                  {current ? (
                    <span className="text-xs font-medium text-accent">Open now</span>
                  ) : m.kind === "staff" && m.status === "active" ? (
                    <form action={switchSchool}>
                      <input type="hidden" name="schoolId" value={m.school.id} />
                      <button type="submit" className="text-xs font-medium text-accent hover:underline">
                        Open dashboard
                      </button>
                    </form>
                  ) : m.kind === "student" ? (
                    <span className="text-xs text-muted">Uses the mobile app</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <LinkButton href="/onboarding" variant="secondary" size="sm">
              Register another school
            </LinkButton>
            <LinkButton href="/onboarding/workspace" variant="secondary" size="sm">
              Start a workspace
            </LinkButton>
          </div>
          <p className="mt-2 text-xs text-muted">
            A workspace is for you alone, without a school: your own classes or courses, for example extra classes.
          </p>
        </Card>

        <Card title="Delete your account" description="This removes your RollCol account from every school and signs you out. It cannot be undone.">
          {blocked.length > 0 ? (
            <Notice tone="warning">
              You are the only admin at {namesOf(blocked)}. Make another staff member an admin there before deleting your
              account.
            </Notice>
          ) : (
            <div className="space-y-4">
              {deletedSchools.length > 0 ? (
                <Notice tone="danger" title={deletedSchools.length === 1 ? "This also deletes a school" : "This also deletes schools"}>
                  You are the only staff member at {namesOf(deletedSchools)}, so{" "}
                  {deletedSchools.length === 1 ? "that school and all its records" : "those schools and all their records"}{" "}
                  (students, guardians and attendance) will be deleted too.
                </Notice>
              ) : (
                <p className="text-sm text-muted">Records you created for your schools, such as registers, stay with the schools.</p>
              )}
              <InlineAction
                action={deleteAccount}
                label="Delete my account"
                variant="danger"
                pendingLabel="Deleting..."
                confirm={
                  deletedSchools.length > 0
                    ? `Delete your account and ${namesOf(deletedSchools)}, with all records? This cannot be undone.`
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
