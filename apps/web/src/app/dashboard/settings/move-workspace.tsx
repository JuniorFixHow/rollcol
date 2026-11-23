import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { Card, Notice, formatDateTime } from "@/components/ui";
import type { StaffMember } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";
import { cancelMove, requestMove } from "../moves/actions";
import { MovePreview } from "../moves/move-preview";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Moving this workspace into a school: ask, wait, or see why it was declined. */
export async function MoveWorkspace({ supabase, member }: { supabase: Supabase; member: StaffMember }) {
  const { school } = member;
  const { data: moves } = await supabase
    .from("workspace_moves")
    .select("id, status, reason, created_at, decided_at, school:schools!workspace_moves_school_id_fkey(name)")
    .eq("workspace_id", school.id)
    .order("created_at", { ascending: false })
    .limit(3);
  const pending = moves?.find((move) => move.status === "pending");
  const lastDeclined = moves?.find((move) => move.status === "declined");
  const { data: preview } = pending ? await supabase.rpc("workspace_move_preview", { p_move_id: pending.id }) : { data: null };
  const kind = school.type === "tertiary" ? "a university or college" : "a basic or senior high school";

  return (
    <div className="mt-10">
      <Card
        title="Move into a school"
        description={`Joined ${kind} that uses RollCol? Move this workspace into it: your ${
          school.type === "tertiary" ? "courses, students and sessions" : "classes, pupils, guardians and registers"
        } become part of the school, and the workspace goes away. The school's admin approves it first.`}
      >
        {pending ? (
          <div className="space-y-4">
            <Notice title={`Waiting for ${pending.school?.name ?? "the school"}`}>
              You asked on {formatDateTime(pending.created_at)}. The school&apos;s admins see what will happen, below, and approve
              or decline it.
            </Notice>
            <MovePreview items={preview ?? []} />
            <InlineAction
              action={cancelMove}
              hidden={{ moveId: pending.id }}
              label="Cancel request"
              confirm="Cancel this request? Nothing moves, and you can ask again later."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {lastDeclined ? (
              <Notice tone="warning" title={`${lastDeclined.school?.name ?? "The school"} declined`}>
                {lastDeclined.reason}
              </Notice>
            ) : null}
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Ask the school&apos;s admin to invite you as staff, and accept the invitation.</li>
              <li>Get the school code from the admin, and enter it here.</li>
              <li>The admin checks what will happen (for example classes with the same name) and approves.</li>
            </ol>
            <ActionForm action={requestMove} className="max-w-md space-y-3">
              <TextField name="schoolCode" label="School code" autoComplete="off" autoCapitalize="characters" placeholder="For example K7QX2M" />
              <FormMessage />
              <SubmitButton pendingLabel="Sending...">Ask to move</SubmitButton>
            </ActionForm>
          </div>
        )}
      </Card>
    </div>
  );
}
