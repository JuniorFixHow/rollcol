import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { addProgramme, removeRecord } from "../courses/actions";

export const metadata: Metadata = { title: "Programmes" };

export default async function ProgrammesPage() {
  const { supabase, member } = await requireAdmin();
  if (member.school.type !== "tertiary" || member.school.isWorkspace) redirect("/dashboard");

  const { data: programmes } = await supabase
    .from("programmes")
    .select("id, name, code, source, batches(count), students(count)")
    .eq("school_id", member.school.id)
    .order("name");

  return (
    <>
      <PageHeader
        title="Programmes"
        description="What students study, for example Diploma in Registered General Nursing. Optional: used to group students. Each programme has batches (intakes) on the Batches page."
      />
      <div className="space-y-6">
        {(programmes ?? []).length === 0 ? (
          <EmptyState>No programmes yet.</EmptyState>
        ) : (
          <Table search="Search programmes" headers={["Programme", "Batches", "Students", ""]}>
            {(programmes ?? []).map((programme) => (
              <tr key={programme.id}>
                <Td>
                  <span className="font-medium">{programme.name}</span>
                  {programme.code ? <span className="ml-2 font-mono text-xs text-muted">{programme.code}</span> : null}
                </Td>
                <Td className="text-sm tabular-nums">
                  <Link href="/dashboard/batches" className="text-accent hover:underline">
                    {programme.batches[0]?.count ?? 0}
                  </Link>
                </Td>
                <Td className="text-sm tabular-nums">{programme.students[0]?.count ?? 0}</Td>
                <Td>
                  <div className="flex justify-end">
                    {programme.source === "rollcol" ? (
                      <InlineAction
                        action={removeRecord}
                        hidden={{ table: "programmes", id: programme.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={`Remove ${programme.name}? Its batches are removed too. Students stay, without a programme.`}
                      />
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        <Card title="Add a programme">
          <ActionForm action={addProgramme} resetOnSuccess className="grid items-start gap-4 sm:grid-cols-2">
            <TextField name="name" label="Programme" placeholder="Diploma in Registered General Nursing" autoComplete="off" />
            <TextField name="code" label="Code (optional)" placeholder="RGN" autoCapitalize="characters" autoComplete="off" />
            <div className="space-y-3 sm:col-span-2">
              <FormMessage />
              <SubmitButton>Add programme</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
