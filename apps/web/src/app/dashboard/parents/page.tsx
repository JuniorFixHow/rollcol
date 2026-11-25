import { formatPhoneForDisplay } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InlineAction } from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { approveParentLink, decideNumberChange, removeParentLink, setLinkApproval } from "./actions";

export const metadata: Metadata = { title: "Parent app" };

/**
 * Who uses the RollCol app as a parent: each link joins an app account to one
 * guardian record (and so to every child on it).
 */
export default async function ParentAppPage() {
  const { supabase, member } = await requireAdmin();
  const { school } = member;
  if (school.type === "tertiary") redirect("/dashboard");

  const [linksResult, settingsResult, featuresResult, requestsResult] = await Promise.all([
    supabase.rpc("school_parent_links", { p_school_id: school.id }),
    supabase.from("school_settings").select("parent_link_approval").eq("school_id", school.id).maybeSingle(),
    supabase.rpc("school_features", { p_school_id: school.id }),
    supabase.rpc("school_phone_requests", { p_school_id: school.id }),
  ]);
  const requests = requestsResult.data ?? [];
  if (linksResult.error) throw new Error(linksResult.error.message);
  const links = linksResult.data ?? [];
  const approval = settingsResult.data?.parent_link_approval ?? false;
  const available = featuresResult.data?.[0]?.sms === true;
  const pending = links.filter((l) => l.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Parent app"
        description="Parents sign in to the RollCol app with the phone number on their guardian record and a code sent by SMS, then type one of their child's names. They see their children's attendance and the messages you send them."
      />
      <div className="space-y-6">
        {!available ? (
          <Notice tone="warning" title="Not available yet">
            {school.isWorkspace
              ? "Parents can use the app with workspaces on the Alerts plan."
              : "Parents can use the app once RollCol has verified your school."}{" "}
            <Link href="/dashboard/billing" className="font-medium text-accent hover:underline">
              Billing
            </Link>
          </Notice>
        ) : null}

        <Card
          title="Confirm new links"
          description={
            approval
              ? "On: a parent who types a correct name waits until an admin confirms the link here."
              : "Off: a parent who types a correct name is linked straight away. Turn this on if you want to check each parent first."
          }
        >
          <InlineAction
            action={setLinkApproval}
            hidden={{ required: approval ? "false" : "true" }}
            label={approval ? "Turn off" : "Turn on"}
            variant="secondary"
          />
        </Card>

        {requests.length > 0 ? (
          <Card
            title="New numbers parents asked for"
            description="Approving changes the guardian's number. Both numbers get an SMS about it, and the parent signs in to RollCol with the new number. Call the old number first if you are not sure."
          >
            <ul className="divide-y divide-line rounded-lg border border-line">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.guardian_name}</p>
                    <p className="text-sm text-muted">
                      {formatPhoneForDisplay(r.old_phone)} to <span className="font-medium text-foreground">{formatPhoneForDisplay(r.new_phone)}</span>
                      {r.children.length > 0 ? ` · ${r.children.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <InlineAction
                      action={decideNumberChange}
                      hidden={{ id: r.id, approve: "true" }}
                      label="Approve"
                      variant="primary"
                      confirm={`Change ${r.guardian_name}'s number to ${formatPhoneForDisplay(r.new_phone)}? Both numbers get an SMS about it.`}
                    />
                    <InlineAction action={decideNumberChange} hidden={{ id: r.id, approve: "false" }} label="Decline" variant="secondary" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {pending > 0 ? (
          <Notice tone="accent" title={`${pending} ${pending === 1 ? "link waits" : "links wait"} for you`}>
            Check that the number belongs to the child&apos;s parent before confirming, for example by calling it.
          </Notice>
        ) : null}

        {links.length === 0 ? (
          <EmptyState>
            No parents use the app yet. Tell parents to install RollCol and choose Parent on the sign-in screen, with
            the number you have for them.
          </EmptyState>
        ) : (
          <Table search="Search by guardian, phone or child" headers={["Guardian", "Children", "Linked", ""]}>
            {links.map((link) => (
              <tr key={link.id}>
                <Td>
                  <span className="block font-medium">{link.guardian_name}</span>
                  <span className="block text-xs text-muted">{formatPhoneForDisplay(link.phone)}</span>
                </Td>
                <Td className="text-sm">{link.children.length > 0 ? link.children.join(", ") : "No active children"}</Td>
                <Td className="text-sm">
                  {link.status === "pending" ? <Badge tone="warning">Waiting</Badge> : formatDateTime(link.approved_at ?? link.created_at)}
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-2">
                    {link.status === "pending" ? (
                      <InlineAction
                        action={approveParentLink}
                        hidden={{ linkId: link.id }}
                        label="Confirm"
                        variant="primary"
                        confirm={`Confirm ${link.guardian_name} (${formatPhoneForDisplay(link.phone)})? They will see the attendance of ${link.children.join(", ") || "their children"}.`}
                      />
                    ) : null}
                    <InlineAction
                      action={removeParentLink}
                      hidden={{ linkId: link.id }}
                      label="Remove"
                      variant="secondary"
                      confirm={`Remove ${link.guardian_name}'s app link? They stop seeing their children in the app and are told. They can link again with a child's name, unless you change or remove their number.`}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        <p className="text-sm text-muted">
          A link ends by itself when you change or remove the guardian&apos;s phone number, or remove the guardian.
          Parents still get your SMS alerts and messages as before.
        </p>
      </div>
    </>
  );
}
