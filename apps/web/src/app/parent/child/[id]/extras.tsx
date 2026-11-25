import { ABSENCE_REASONS, formatPhoneForDisplay, isAbsenceReason } from "@rollcol/shared";
import { ActionForm, FieldButton, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, formatDateTime, formatLongDate } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { ghanaToday } from "@/lib/parent";
import { cancelAbsence, cancelPickup, createPickup, reportAbsence } from "../../actions";

const PICKUP_STATUS: Record<string, { label: string; tone: "accent" | "success" | "neutral" }> = {
  active: { label: "Ready", tone: "accent" },
  used: { label: "Collected", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Not used", tone: "neutral" },
};

function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

function nextDays(today: string, count: number): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { value: iso, label: i === 0 ? `Today, ${shortDay(iso)}` : i === 1 ? `Tomorrow, ${shortDay(iso)}` : shortDay(iso) };
  });
}

/** Pickup codes and absence reports for one child. */
export async function ChildExtras({ studentId, firstName }: { studentId: string; firstName: string }) {
  const { supabase } = await requireParent();
  const today = ghanaToday();
  const [{ data: pickups }, { data: absences }] = await Promise.all([
    supabase.rpc("parent_pickups", { p_student_id: studentId }),
    supabase
      .from("absence_reports")
      .select("id, from_date, to_date, reason, note, status")
      .eq("student_id", studentId)
      .eq("status", "active")
      .gte("to_date", today)
      .order("from_date"),
  ]);
  const days = nextDays(today, 8);

  return (
    <>
      <Card
        title="Pickup codes"
        description={`If someone else collects ${firstName}, make a code and give it to them. The teacher asks for it before releasing ${firstName}. A code works once, on its day.`}
      >
        {(pickups ?? []).length > 0 ? (
          <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
            {(pickups ?? []).map((p) => {
              const status = PICKUP_STATUS[p.status] ?? PICKUP_STATUS.expired;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.status === "active" ? <span className="mr-2 font-mono text-lg tracking-widest">{p.code}</span> : null}
                      {p.collector_name}
                      {p.collector_phone ? <span className="text-muted"> · {formatPhoneForDisplay(p.collector_phone)}</span> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {shortDay(p.pickup_date)}
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
        ) : null}
        <ActionForm action={createPickup.bind(null, studentId)} className="grid items-start gap-4 sm:grid-cols-2" resetOnSuccess>
          <TextField name="collectorName" label="Who collects" hint="Their full name, as they will tell the teacher." autoComplete="off" />
          <TextField name="collectorPhone" label="Their phone (optional)" type="tel" inputMode="tel" autoComplete="off" />
          <SelectField name="date" label="Day" options={days} defaultValue={today} />
          <FieldButton>
            <SubmitButton pendingLabel="Making the code...">Make a code</SubmitButton>
          </FieldButton>
          <div className="sm:col-span-2">
            <FormMessage />
          </div>
        </ActionForm>
      </Card>

      <Card title="Report an absence" description={`Tell the school ahead if ${firstName} will be absent. The class teacher is told, and you get no absence alert for those days.`}>
        {(absences ?? []).length > 0 ? (
          <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
            {(absences ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
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
        ) : null}
        <ActionForm action={reportAbsence.bind(null, studentId)} className="grid items-start gap-4 sm:grid-cols-2" resetOnSuccess>
          <SelectField name="from" label="From" options={days} defaultValue={today} />
          <SelectField name="to" label="To" options={nextDays(today, 14)} defaultValue={today} hint="Up to two weeks." />
          <SelectField
            name="reason"
            label="Reason"
            placeholder="Choose a reason"
            options={Object.entries(ABSENCE_REASONS).map(([value, label]) => ({ value, label }))}
          />
          <TextField name="note" label="Note for the teacher (optional)" autoComplete="off" />
          <div className="space-y-3 sm:col-span-2">
            <FormMessage />
            <SubmitButton pendingLabel="Sending...">Report absence</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
