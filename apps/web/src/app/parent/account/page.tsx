import { formatPhoneForDisplay } from "@rollcol/shared";
import type { Metadata } from "next";
import { NotificationSettings, PARENT_KINDS } from "@/app/dashboard/notifications/notification-settings";
import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { ThemePicker } from "@/components/theme";
import { Badge, Card, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { cancelNumberChange, deleteParentAccount, requestNumberChange, unlinkSchool } from "../actions";

export const metadata: Metadata = { title: "Account" };

export default async function ParentAccountPage() {
  const { supabase, phone } = await requireParent();
  const [{ data: links }, { data: settings }, { data: requests }] = await Promise.all([
    supabase.rpc("parent_my_links"),
    supabase.from("notification_settings").select("kind, enabled"),
    supabase.from("guardian_phone_requests").select("id, school_id, new_phone").eq("status", "pending"),
  ]);
  const enabled = Object.fromEntries((settings ?? []).map((s) => [s.kind, s.enabled]));

  return (
    <>
      <PageHeader title="Account" description={`${formatPhoneForDisplay(phone)} · Parent account. You sign in with this number and a code sent by SMS.`} />
      <div className="space-y-6">
        <Card title="Your children's schools" description="Removing a school stops you seeing those children. You can add them again with one of their names.">
          <ul className="divide-y divide-line rounded-lg border border-line">
            {(links ?? []).map((link) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{link.school_name}</p>
                  <p className="text-sm text-muted">
                    {link.status === "pending" ? "Waiting for the school to confirm" : link.children.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {link.status === "pending" ? <Badge tone="warning">Waiting</Badge> : null}
                  <InlineAction
                    action={unlinkSchool}
                    hidden={{ linkId: link.id }}
                    label={link.status === "pending" ? "Cancel" : "Remove"}
                    variant="secondary"
                    confirm={
                      link.status === "pending"
                        ? "Cancel this link? The school will not be asked to confirm it."
                        : `Remove ${link.school_name}? You will no longer see these children in RollCol. You can add them again with one of their names.`
                    }
                  />
                </div>
              </li>
            ))}
            {(links ?? []).length === 0 ? <li className="px-4 py-3 text-sm text-muted">No school is linked yet.</li> : null}
          </ul>
          <LinkButton href="/parent/link" variant="secondary" className="mt-4">
            Add a child
          </LinkButton>
        </Card>

        <Card
          title="Your phone number"
          description="Got a new number? Ask each school to use it. Once a school approves, it uses the new number for messages, and you sign in to RollCol with it."
        >
          <ul className="divide-y divide-line rounded-lg border border-line">
            {(links ?? [])
              .filter((link) => link.status === "active")
              .map((link) => {
                const pending = (requests ?? []).find((r) => r.school_id === link.school_id);
                return (
                  <li key={link.id} className="space-y-3 px-4 py-3">
                    <p className="font-medium">{link.school_name}</p>
                    {pending ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm">
                          <Badge tone="warning">Waiting</Badge> You asked to use {formatPhoneForDisplay(pending.new_phone)}.
                        </p>
                        <InlineAction action={cancelNumberChange} hidden={{ id: pending.id }} label="Cancel" variant="secondary" />
                      </div>
                    ) : (
                      <ActionForm action={requestNumberChange} className="flex flex-wrap items-end gap-3" resetOnSuccess>
                        <input type="hidden" name="linkId" value={link.id} />
                        <div className="w-56">
                          <TextField name="phone" label="New number" type="tel" inputMode="tel" autoComplete="tel" />
                        </div>
                        <SubmitButton variant="secondary" pendingLabel="Sending...">
                          Ask the school
                        </SubmitButton>
                        <div className="w-full">
                          <FormMessage />
                        </div>
                      </ActionForm>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>

        <Card title="Notifications" description="Choose what is sent to your phone when you use the RollCol app. The same settings are in the app.">
          <NotificationSettings
            initial={enabled}
            kinds={PARENT_KINDS}
            note="Turned-off notifications are not sent by SMS instead: you still find them in Messages. Notices about your link to the school are always sent."
          />
        </Card>

        <Card title="Appearance">
          <ThemePicker />
        </Card>

        <Card title="Sign out and delete">
          <div className="flex flex-wrap items-center gap-3">
            <form action="/auth/sign-out" method="post">
              <button type="submit" className={buttonClass("secondary")}>
                Sign out
              </button>
            </form>
            <InlineAction
              action={deleteParentAccount}
              label="Delete my account"
              variant="danger"
              pendingLabel="Deleting..."
              confirm="Delete your RollCol parent account? Your links to your children are removed. This cannot be undone. You can make a new account with your number later."
            />
          </div>
          <p className="mt-3 text-sm text-muted">Deleting your account removes your links to your children. The school keeps your number on its records.</p>
        </Card>
      </div>
    </>
  );
}
