import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineAction } from "@/components/form";
import { ReasonAction } from "@/components/reason-action";
import { Card, Notice, PageHeader, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { approveMove, declineMove } from "../actions";
import { MovePreview } from "../move-preview";

export const metadata: Metadata = { title: "Workspace move" };

export default async function MovePage({ params }: PageProps<"/dashboard/moves/[id]">) {
  const { id } = await params;
  const { supabase, member } = await requireAdmin();
  const { data: move } = await supabase
    .from("workspace_moves")
    .select("id, workspace_name, requested_by_name, status, reason, created_at, decided_at")
    .eq("id", id)
    .eq("school_id", member.school.id)
    .maybeSingle();
  if (!move) notFound();
  const pending = move.status === "pending";
  const { data: preview, error } = pending ? await supabase.rpc("workspace_move_preview", { p_move_id: move.id }) : { data: [], error: null };
  if (error) throw new Error(error.message);
  const items = preview ?? [];
  const blocked = items.some((item) => item.severity === "blocker");
  const tertiary = member.school.type === "tertiary";

  return (
    <>
      <PageHeader
        title={`Move ${move.workspace_name} into ${member.school.name}?`}
        description={
          <>
            {move.requested_by_name} asked on {formatDateTime(move.created_at)}.{" "}
            <Link href="/dashboard" className="text-accent hover:underline">
              Back to the overview
            </Link>
          </>
        }
      />
      <div className="space-y-6">
        {!pending ? (
          <Notice tone={move.status === "approved" ? "success" : "warning"} title={`This request was ${move.status}`}>
            {move.reason ?? (move.decided_at ? formatDateTime(move.decided_at) : "")}
          </Notice>
        ) : (
          <>
            <Card
              title="What will happen"
              description={`${move.requested_by_name} keeps teaching ${
                tertiary ? "their courses" : "their classes"
              } as staff here. Everything moves in one step; if anything goes wrong, nothing moves.`}
            >
              <MovePreview items={items} />
            </Card>
            <div className="flex flex-wrap gap-3">
              {blocked ? null : (
                <InlineAction
                  action={approveMove}
                  hidden={{ moveId: move.id }}
                  label="Approve and move"
                  variant="primary"
                  pendingLabel="Moving..."
                  confirm={`Move ${move.workspace_name} into ${member.school.name}? This cannot be undone: the workspace is deleted, and its records belong to the school from now on.`}
                />
              )}
              <ReasonAction
                action={declineMove}
                hidden={{ moveId: move.id }}
                label="Decline"
                title="Decline this move?"
                message={`${move.requested_by_name} sees your reason, so tell them what to do instead.`}
                placeholder="Please add the extra classes as a club instead"
                confirmLabel="Decline"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
