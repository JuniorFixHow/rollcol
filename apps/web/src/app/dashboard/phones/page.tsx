import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InlineAction } from "@/components/form";
import { Badge, EmptyState, Notice, PageHeader, Table, Td, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { approvePhone } from "../sessions/actions";

export const metadata: Metadata = { title: "Phones" };

export default async function PhonesPage() {
  const { supabase, member } = await requireAdmin();
  if (member.school.type !== "tertiary") redirect("/dashboard");
  const { data: changes, error } = await supabase.rpc("pending_device_changes", { p_school_id: member.school.id });
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Phones"
        description="Each student checks in from one phone. When they sign in on a new phone, it becomes their check-in phone after 48 hours, unless you approve it sooner."
      />
      <div className="space-y-6">
        <Notice tone="neutral" title="Before approving">
          Check that the student asked for this, in person or by calling them. Someone else signing in to their account
          could be trying to check in for them. After two phone changes in a semester, only an admin can approve.
        </Notice>

        {(changes ?? []).length === 0 ? (
          <EmptyState>No phone changes waiting.</EmptyState>
        ) : (
          <Table headers={["Student", "New phone", "Current phone", "Becomes active", ""]}>
            {(changes ?? []).map((change) => (
              <tr key={change.device_id}>
                <Td>
                  <span className="block font-medium">{change.student_name}</span>
                  <span className="block font-mono text-xs text-muted">{change.school_number ?? "No school ID"}</span>
                </Td>
                <Td className="text-sm">
                  {change.new_label}
                  <span className="block text-xs text-muted">Asked {formatDateTime(change.requested_at)}</span>
                </Td>
                <Td className="text-sm">{change.old_label ?? "None"}</Td>
                <Td className="text-sm">
                  {change.active_from ? (
                    formatDateTime(change.active_from)
                  ) : (
                    <Badge tone="warning">Needs an admin</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <InlineAction
                      action={approvePhone}
                      hidden={{ deviceId: change.device_id }}
                      label="Approve now"
                      variant="primary"
                      confirm={`Approve ${change.new_label} for ${change.student_name}? It becomes their check-in phone straight away, and ${change.old_label ?? "their old phone"} stops working for check-in.`}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </>
  );
}
