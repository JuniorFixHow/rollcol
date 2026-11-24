import type { Metadata } from "next";
import { NotificationSettings, STUDENT_KINDS } from "@/app/dashboard/notifications/notification-settings";
import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { ThemePicker } from "@/components/theme";
import { Badge, Card, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { deleteStudentAccount, joinAnotherSchool, switchStudentSchool } from "../actions";

export const metadata: Metadata = { title: "Account" };

export default async function StudentAccountPage() {
  const { supabase, student, students, email } = await requireStudent();
  const { data: settings } = await supabase.from("notification_settings").select("kind, enabled");
  const enabled = Object.fromEntries((settings ?? []).map((s) => [s.kind, s.enabled]));

  return (
    <>
      <PageHeader title="Account" description={`${student.fullName} · ${email ?? ""}`} />
      <div className="space-y-6">
        <Card title="Your schools and workspaces" description="One email and password work for all of them.">
          <ul className="divide-y divide-line rounded-lg border border-line">
            {students.map((m) => (
              <li key={m.school.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{m.school.name}</p>
                  <p className="text-sm text-muted">
                    {m.school.isWorkspace ? "Workspace" : "School"} code {m.school.code} · School ID {m.schoolNumber}
                    {m.status !== "active" ? " · waiting for approval" : ""}
                  </p>
                </div>
                {m.school.id === student.school.id ? (
                  <Badge tone="accent">Showing</Badge>
                ) : (
                  <form action={switchStudentSchool}>
                    <input type="hidden" name="schoolId" value={m.school.id} />
                    <button type="submit" className={buttonClass("secondary", "sm")}>
                      Show
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-accent">Join another school or a lecturer&apos;s workspace</summary>
            <ActionForm action={joinAnotherSchool} className="mt-3 grid max-w-md gap-4" resetOnSuccess>
              <TextField name="schoolCode" label="School or workspace code" autoCapitalize="characters" autoComplete="off" />
              <TextField name="schoolId" label="Your school ID there" autoCapitalize="characters" autoComplete="off" />
              <TextField name="fullName" label="Full name" defaultValue={student.fullName} autoComplete="name" />
              <FormMessage />
              <SubmitButton pendingLabel="Joining...">Join</SubmitButton>
            </ActionForm>
          </details>
        </Card>

        <Card title="Check-in phone">
          <p className="text-sm text-muted">
            You check in to classes with the RollCol app on one registered phone. Its status, and changing to a new phone, are
            in the app under Account.
          </p>
        </Card>

        <Card title="Notifications" description="Choose what is sent to your phone. The same settings are in the app.">
          <NotificationSettings initial={enabled} kinds={STUDENT_KINDS} note="Security notices, such as your account signing in on a new phone, are always sent." />
        </Card>

        <Card title="Appearance">
          <ThemePicker />
        </Card>

        <Card title="Password, sign out and delete">
          <div className="flex flex-wrap items-center gap-3">
            <LinkButton href="/account/password" variant="secondary">
              Change password
            </LinkButton>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className={buttonClass("secondary")}>
                Sign out
              </button>
            </form>
            <InlineAction
              action={deleteStudentAccount}
              label="Delete my account"
              variant="danger"
              pendingLabel="Deleting..."
              confirm="Delete your RollCol account? You leave every school and workspace, and your check-in records go with it. This cannot be undone."
            />
          </div>
        </Card>
      </div>
    </>
  );
}
