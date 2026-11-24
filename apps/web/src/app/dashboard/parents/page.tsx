import { formatPhoneForDisplay } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InlineAction } from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { approveParentLink, removeParentLink, setLinkApproval } from "./actions";

export const metadata: Metadata = { title: "Parent app" };

/**
 * Who uses the RollCol app as a parent: each link joins an app account to one
 * guardian record (and so to every child on it).
 */
export default async function ParentAppPage() {
  const { supabase, member } = await requireAdmin();
  const { school } = member;
  if (school.type === "tertiary") redirect("/dashboard");

  const [linksResult, settingsResult, featuresResult] = await Promise.all([
    supabase.rpc("school_parent_links", { p_school_id: school.id }),
    supabase.from("school_settings").select("parent_link_approval").eq("school_id", school.id).maybeSingle(),
    supabase.rpc("school_features", { p_school_id: school.id }),
  ]);
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
