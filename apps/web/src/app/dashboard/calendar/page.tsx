import { academicPeriodSchema, periodWord, periodWordTitle } from "@rollcol/shared";
import type { Metadata } from "next";
import { refresh } from "next/cache";
import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, Table, Td, formatDate } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formValues, invalid, succeeded } from "@/lib/forms";

export const metadata: Metadata = { title: "Calendar" };

async function addPeriod(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const parsed = academicPeriodSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await supabase.from("academic_periods").insert({
    school_id: member.school.id,
    kind: member.school.type === "tertiary" ? "semester" : "term",
    name: parsed.data.name,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
  });
  if (error) return failed(error, values);
  refresh();
  return succeeded("Added.");
}

async function removePeriod(_: FormState, formData: FormData): Promise<FormState> {
  "use server";
  const { supabase, member } = await requireAdmin();
  const periodId = String(formData.get("periodId") ?? "");
  const { count } = await supabase
    .from("course_runs")
    .select("id", { count: "exact", head: true })
    .eq("academic_period_id", periodId)
    .eq("school_id", member.school.id);
  if (count && count > 0) {
    return failed(
      `This semester has ${count} ${count === 1 ? "course" : "courses"}. Remove them from the semester on the Courses page first.`,
    );
  }
  const { error } = await supabase
    .from("academic_periods")
    .delete()
    .eq("id", periodId)
    .eq("school_id", member.school.id);
  if (error) return failed(error);
  refresh();
  return succeeded("Removed.");
}

export default async function CalendarPage() {
  const { supabase, member } = await requireAdmin();
  const { school } = member;
  const word = periodWord(school.type);
  const title = `${periodWordTitle(school.type)}s`;

  const { data: periods, error } = await supabase
    .from("academic_periods")
    .select("id, name, starts_on, ends_on, source")
    .eq("school_id", school.id)
    .order("starts_on", { ascending: false });
  if (error) throw new Error(error.message);

  // Display only; anything time sensitive is decided by the database clock.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title={title}
        description={`Attendance, reward marks and billing are counted per ${word}. ${title} cannot overlap.`}
      />
      <div className="space-y-6">
        {periods.length === 0 ? (
          <EmptyState>No {word}s yet. Add the current one below.</EmptyState>
        ) : (
          <Table headers={["Name", "Starts", "Ends", ""]}>
            {periods.map((period) => {
              const current = period.starts_on <= today && today <= period.ends_on;
              return (
                <tr key={period.id}>
                  <Td>
                    <span className="font-medium">{period.name}</span>
                    {current ? (
                      <span className="ml-2">
                        <Badge tone="success">Current</Badge>
                      </span>
                    ) : null}
                    {period.source === "stediis" ? (
                      <span className="ml-2">
                        <Badge>Managed in Stediis</Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td>{formatDate(period.starts_on)}</Td>
                  <Td>{formatDate(period.ends_on)}</Td>
                  <Td className="text-right">
                    {period.source === "rollcol" ? (
                      <InlineAction
                        action={removePeriod}
                        hidden={{ periodId: period.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={
                          member.school.type === "tertiary"
                            ? `Remove ${period.name}? Only a semester without courses can be removed. Check-in sessions and marks are not deleted.`
                            : `Remove ${period.name}? No registers or marks are deleted. Totals on class pages are worked out from term dates, so registers from these dates count again as soon as a term covers them.`
                        }
                      />
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}

        <Card title={`Add a ${word}`}>
          <ActionForm action={addPeriod} resetOnSuccess className="grid gap-4 sm:grid-cols-3">
            <TextField
              name="name"
              label="Name"
              placeholder={school.type === "tertiary" ? "First Semester 2026/2027" : "First Term 2026/2027"}
            />
            <TextField name="startsOn" label="Starts" type="date" />
            <TextField name="endsOn" label="Ends" type="date" />
            <div className="space-y-3 sm:col-span-3">
              <FormMessage />
              <SubmitButton>Add {word}</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
