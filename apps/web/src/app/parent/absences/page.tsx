import { ABSENCE_REASONS, isAbsenceReason } from "@rollcol/shared";
import type { Metadata } from "next";
import { ActionForm, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Card, EmptyState, PageHeader, formatLongDate } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { ghanaToday } from "@/lib/parent";
import { nextDays, shortDay } from "@/lib/parent-days";
import { cancelAbsence, reportAbsence } from "../actions";

export const metadata: Metadata = { title: "Absences" };

/** Telling the school ahead that a child will be absent. */
export default async function AbsencesPage() {
  const { supabase } = await requireParent();
  const today = ghanaToday();
  const [{ data: absences }, { data: children }] = await Promise.all([
    supabase
      .from("absence_reports")
      .select("id, student_id, from_date, to_date, reason, note, status")
      .eq("status", "active")
      .gte("to_date", today)
      .order("from_date"),
    supabase.rpc("parent_children"),
  ]);
  const kids = (children ?? []).flatMap((c) => (c.student_id && c.full_name ? [{ value: c.student_id, label: c.full_name }] : []));
  const nameOf = new Map(kids.map((k) => [k.value, k.label]));

  return (
    <>
      <PageHeader
        title="Absences"
        description="Tell the school ahead if your child will be absent. The class teacher is told, your child starts as absent on the register, and you get no absence alert for those days."
      />
      <div className="space-y-6">
        <Card title="Report an absence">
          {kids.length === 0 ? (
            <p className="text-sm text-muted">Add your child first, on the Children page.</p>
          ) : (
            <ActionForm action={reportAbsence} className="grid items-start gap-4 sm:grid-cols-2" resetOnSuccess>
              <SelectField name="studentId" label="Child" options={kids} defaultValue={kids.length === 1 ? kids[0]?.value : undefined} placeholder="Choose a child" />
              <SelectField
                name="reason"
                label="Reason"
                placeholder="Choose a reason"
                options={Object.entries(ABSENCE_REASONS).map(([value, label]) => ({ value, label }))}
              />
              <SelectField name="from" label="From" options={nextDays(today, 8)} defaultValue={today} />
              <SelectField name="to" label="To" options={nextDays(today, 14)} defaultValue={today} hint="Up to two weeks." />
              <div className="sm:col-span-2">
                <TextField name="note" label="Note for the teacher (optional)" autoComplete="off" />
              </div>
              <div className="space-y-3 sm:col-span-2">
                <FormMessage />
                <SubmitButton pendingLabel="Sending...">Report absence</SubmitButton>
              </div>
            </ActionForm>
          )}
        </Card>

        <Card title="Reported absences" description="Today and ahead. Cancel one if your child will be in school after all.">
          {(absences ?? []).length === 0 ? (
            <EmptyState>No absences reported.</EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(absences ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {nameOf.get(a.student_id) ?? "Your child"} ·{" "}
                      {a.from_date === a.to_date ? formatLongDate(a.from_date) : `${shortDay(a.from_date)} to ${shortDay(a.to_date)}`}
                    </p>
                    <p className="text-sm text-muted">
                      {isAbsenceReason(a.reason) ? ABSENCE_REASONS[a.reason] : a.reason}
                      {a.note ? ` · ${a.note}` : ""}
                    </p>
                  </div>
                  <InlineAction
                    action={cancelAbsence}
                    hidden={{ id: a.id }}
                    label="Cancel"
                    variant="secondary"
                    confirm="Cancel this report? The school will expect your child again on these days."
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
