import { periodLabel } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, FieldButton, FormMessage, SelectField, SubmitButton, TextField } from "@/components/form";
import { Card, EmptyState, LinkButton, PageHeader, formatLongDate, formatTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { startRegister } from "./actions";
import { RegisterStatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Registers" };

function periodOptions(count: number) {
  return Array.from({ length: count }, (_, index) => ({ value: String(index + 1), label: `Period ${index + 1}` }));
}

export default async function RegistersPage() {
  const { supabase, member } = await requireStaff();
  const { school } = member;
  if (school.type === "tertiary") redirect("/dashboard");
  const isAdmin = member.role === "admin";
  const perPeriod = school.registerMode === "per_period";

  const { data: rows, error } = await supabase.rpc("registers_today", { p_school_id: school.id });
  if (error) throw new Error(error.message);

  // Group by class, keeping the database order (class, then subject).
  const groups = new Map<string, { className: string; rows: typeof rows }>();
  for (const row of rows) {
    const group = groups.get(row.class_id) ?? { className: row.class_name, rows: [] };
    group.rows.push(row);
    groups.set(row.class_id, group);
  }

  return (
    <>
      <PageHeader
        title="Registers"
        description={
          <>
            {formatLongDate(new Date())}.{" "}
            {perPeriod ? "Each subject teacher marks their own periods." : "Class teachers mark one register a day."}
            {isAdmin ? (
              <>
                {" "}
                Closing times are in{" "}
                <Link href="/dashboard/settings" className="text-accent hover:underline">
                  Settings
                </Link>
                .
              </>
            ) : null}
          </>
        }
      />

      {groups.size === 0 ? (
        <EmptyState>
          {perPeriod
            ? "You have no subjects to mark. An admin assigns subject teachers on each class's page."
            : "You are not the class teacher of any class. An admin chooses class teachers on the Classes page."}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([classId, group]) => (
            <Card key={classId} title={group.className}>
              <ul className="divide-y divide-line">
                {group.rows.map((row) => {
                  const key = `${row.class_subject_id ?? "daily"}-${row.register_id ?? "new"}`;
                  const title = perPeriod ? `${row.subject_name ?? "Subject"}${row.period_number ? `, ${periodLabel(row.period_number)}` : ""}` : "Today's register";

                  if (row.register_id) {
                    return (
                      <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="font-medium">{title}</p>
                          <p className="text-sm text-muted">
                            {row.marked_count} of {row.student_count} marked
                            {row.status === "open" && row.closes_at ? ` · closes at ${formatTime(row.closes_at)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {row.status ? <RegisterStatusBadge status={row.status} /> : null}
                          <LinkButton href={`/dashboard/registers/${row.register_id}`} size="sm" variant={row.status === "open" ? "primary" : "secondary"}>
                            {row.status === "open" ? "Continue" : "View"}
                          </LinkButton>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={key} className="py-3 first:pt-0 last:pb-0">
                      <p className="mb-3 font-medium">
                        {perPeriod ? (row.subject_name ?? "Subject") : "Today's register"}{" "}
                        <span className="font-normal text-muted">· {row.student_count} students</span>
                      </p>
                      {row.student_count === 0 ? (
                        <p className="text-sm text-muted">Add students to this class before taking a register.</p>
                      ) : (
                        <ActionForm
                          action={startRegister}
                          className={`grid items-start gap-3 ${perPeriod ? "sm:grid-cols-[10rem_10rem_auto]" : "sm:grid-cols-[10rem_auto]"}`}
                        >
                          <input type="hidden" name="classId" value={row.class_id} />
                          {row.class_subject_id ? <input type="hidden" name="classSubjectId" value={row.class_subject_id} /> : null}
                          {perPeriod ? <SelectField name="periodNumber" label="Period" placeholder="Choose" options={periodOptions(row.periods_per_day)} /> : null}
                          <TextField
                            name="rewardMarks"
                            label="Marks (optional)"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="0.25"
                            placeholder="0"
                          />
                          <FieldButton>
                            <SubmitButton pendingLabel="Starting...">Take register</SubmitButton>
                          </FieldButton>
                          <div className={perPeriod ? "sm:col-span-3" : "sm:col-span-2"}>
                            <FormMessage />
                          </div>
                        </ActionForm>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
          <p className="text-xs text-muted">
            Optional marks go to every child marked present or late, and add up for the term on each class&apos;s page.
          </p>
        </div>
      )}
    </>
  );
}
