import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Card, EmptyState, Notice, PageHeader, Table, Td } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { addBatch, removeRecord } from "../courses/actions";

export const metadata: Metadata = { title: "Batches" };

export default async function BatchesPage() {
  const { supabase, member } = await requireAdmin();
  if (member.school.type !== "tertiary") redirect("/dashboard");
  const thisYear = new Date().getFullYear();

  const [{ data: programmes }, { data: batches }] = await Promise.all([
    supabase.from("programmes").select("id, name").eq("school_id", member.school.id).order("name"),
    supabase
      .from("batches")
      .select("id, name, entry_year, source, programme:programmes(name), students(count)")
      .eq("school_id", member.school.id)
      .order("entry_year", { ascending: false, nullsFirst: false })
      .order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Batches"
        description="Intakes within a programme, for example the 2025 intake of Registered General Nursing. Optional: used to group students."
      />
      <div className="space-y-6">
        {(programmes ?? []).length === 0 ? (
          <Notice tone="neutral" title="Add a programme first">
            Every batch belongs to a programme.{" "}
            <Link href="/dashboard/programmes" className="text-accent hover:underline">
              Go to Programmes
            </Link>
          </Notice>
        ) : null}

        {(batches ?? []).length === 0 ? (
          <EmptyState>No batches yet.</EmptyState>
        ) : (
          <Table search="Search batches" headers={["Batch", "Programme", "Entry year", "Students", ""]}>
            {(batches ?? []).map((batch) => (
              <tr key={batch.id}>
                <Td className="font-medium">{batch.name}</Td>
                <Td className="text-sm">{batch.programme?.name}</Td>
                <Td className="text-sm tabular-nums">{batch.entry_year ?? "Not set"}</Td>
                <Td className="text-sm tabular-nums">{batch.students[0]?.count ?? 0}</Td>
                <Td>
                  <div className="flex justify-end">
                    {batch.source === "rollcol" ? (
                      <InlineAction
                        action={removeRecord}
                        hidden={{ table: "batches", id: batch.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={`Remove ${batch.name}? Its students stay, without a batch.`}
                      />
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        {(programmes ?? []).length > 0 ? (
          <Card title="Add a batch">
            <ActionForm action={addBatch} resetOnSuccess className="grid items-start gap-4 sm:grid-cols-3">
              <SelectField
                name="programmeId"
                label="Programme"
                placeholder="Choose a programme"
                defaultValue={(programmes ?? []).length === 1 ? (programmes ?? [])[0]?.id : undefined}
                options={(programmes ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
              <TextField name="name" label="Batch" placeholder={`${thisYear} intake`} autoComplete="off" />
              <TextField
                name="entryYear"
                label="Entry year (optional)"
                type="number"
                inputMode="numeric"
                min="1990"
                max={String(thisYear + 1)}
                step="1"
                placeholder={String(thisYear)}
              />
              <div className="space-y-3 sm:col-span-3">
                <FormMessage />
                <SubmitButton>Add batch</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
