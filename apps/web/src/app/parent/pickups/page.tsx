import { formatPhoneForDisplay } from "@rollcol/shared";
import type { Metadata } from "next";
import { ActionForm, FieldButton, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, formatDateTime } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { ghanaToday } from "@/lib/parent";
import { nextDays, shortDay } from "@/lib/parent-days";
import { cancelPickup, createPickup } from "../actions";

export const metadata: Metadata = { title: "Pickup codes" };

const STATUS: Record<string, { label: string; tone: "accent" | "success" | "neutral" }> = {
  active: { label: "Ready", tone: "accent" },
  used: { label: "Collected", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Not used", tone: "neutral" },
};

/** Codes for someone else to collect a child; the teacher asks for the code. */
export default async function PickupsPage() {
  const { supabase } = await requireParent();
  const today = ghanaToday();
  const [{ data: pickups }, { data: children }] = await Promise.all([supabase.rpc("parent_pickups", {}), supabase.rpc("parent_children")]);
  const kids = (children ?? []).flatMap((c) => (c.student_id && c.full_name ? [{ value: c.student_id, label: c.full_name }] : []));

  return (
    <>
      <PageHeader
        title="Pickup codes"
        description="If someone else collects your child, make a code and give it to them. The teacher asks for it before releasing your child. A code works once, on its day, and you are told when your child is collected."
      />
      <div className="space-y-6">
        <Card title="Make a code">
          {kids.length === 0 ? (
            <p className="text-sm text-muted">Add your child first, on the Children page.</p>
          ) : (
            <ActionForm action={createPickup} className="grid items-start gap-4 sm:grid-cols-2" resetOnSuccess>
              <SelectField name="studentId" label="Child" options={kids} defaultValue={kids.length === 1 ? kids[0]?.value : undefined} placeholder="Choose a child" />
              <SelectField name="date" label="Day" options={nextDays(today, 8)} defaultValue={today} />
              <TextField name="collectorName" label="Who collects" hint="Their full name, as they will tell the teacher." autoComplete="off" />
              <TextField name="collectorPhone" label="Their phone (optional)" type="tel" inputMode="tel" autoComplete="off" />
              <div className="space-y-3 sm:col-span-2">
                <FormMessage />
                <FieldButton>
                  <SubmitButton pendingLabel="Making the code...">Make a code</SubmitButton>
                </FieldButton>
              </div>
            </ActionForm>
          )}
        </Card>

        <Card title="Your codes" description="From the last week and ahead.">
          {(pickups ?? []).length === 0 ? (
            <EmptyState>No pickup codes.</EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(pickups ?? []).map((p) => {
                const status = STATUS[p.status] ?? STATUS.expired;
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.status === "active" ? <span className="mr-2 font-mono text-lg tracking-widest">{p.code}</span> : null}
                        {p.collector_name}
                        {p.collector_phone ? <span className="text-muted"> · {formatPhoneForDisplay(p.collector_phone)}</span> : null}
                      </p>
                      <p className="text-sm text-muted">
                        {p.student_name} · {shortDay(p.pickup_date)}
                        {p.used_at ? ` · collected ${formatDateTime(p.used_at)}${p.released_by_name ? `, released by ${p.released_by_name}` : ""}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                      {p.status === "active" ? (
                        <InlineAction
                          action={cancelPickup}
                          hidden={{ id: p.id }}
                          label="Cancel"
                          variant="secondary"
                          confirm={`Cancel the code for ${p.collector_name}? It will no longer work.`}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
