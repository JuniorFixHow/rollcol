import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, FieldButton, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { listTeachers, visibleClassIds } from "@/lib/queries";
import { createClass, createSubject, removeSubject } from "./actions";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const { supabase, member } = await requireStaff();
  const { school } = member;
  if (school.type === "tertiary") redirect("/dashboard/courses");
  const isAdmin = member.role === "admin";
  const perPeriod = school.registerMode === "per_period";

  const visible = await visibleClassIds(supabase, member);
  let query = supabase
    .from("classes")
    .select("id, name, class_teacher:staff!classes_class_teacher_id_school_id_fkey(full_name), students(count)")
    .eq("school_id", school.id)
    .is("archived_at", null)
    .order("name");
  if (visible !== "all") query = query.in("id", visible);

  const [{ data: classes, error }, teachers, { data: subjects }] = await Promise.all([
    query,
    isAdmin ? listTeachers(supabase, school.id) : Promise.resolve([]),
    isAdmin ? supabase.from("subjects").select("id, name").eq("school_id", school.id).order("name") : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title={isAdmin ? "Classes" : "Your classes"}
        description={
          perPeriod
            ? "Each subject teacher marks the register for their own periods."
            : "The class teacher marks the register once a day."
        }
      />
      <div className="space-y-6">
        {classes.length === 0 ? (
          <EmptyState>{isAdmin ? "No classes yet. Create the first one below." : "You are not assigned to any class yet."}</EmptyState>
        ) : (
          <Table headers={["Class", "Class teacher", "Students"]}>
            {classes.map((item) => (
              <tr key={item.id}>
                <Td>
                  <Link href={`/dashboard/classes/${item.id}`} className="font-medium text-accent hover:underline">
                    {item.name}
                  </Link>
                </Td>
                <Td className="text-muted">{item.class_teacher?.full_name ?? "Not set"}</Td>
                <Td className="tabular-nums">{item.students[0]?.count ?? 0}</Td>
              </tr>
            ))}
          </Table>
        )}

        {isAdmin ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Create a class" description='For example "Basic 4" or "Form 2 Science A".'>
              <ActionForm action={createClass} resetOnSuccess>
                <TextField name="name" label="Class name" />
                <SelectField
                  name="classTeacherId"
                  label="Class teacher"
                  placeholder="Choose later"
                  options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.full_name }))}
                />
                <FormMessage />
                <SubmitButton>Create class</SubmitButton>
              </ActionForm>
            </Card>

            <Card
              title="Subjects"
              description={perPeriod ? "Assign subject teachers on each class page." : "Optional for daily registers."}
            >
              {(subjects ?? []).length > 0 ? (
                <ul className="mb-4 divide-y divide-line rounded-md border border-line">
                  {(subjects ?? []).map((subject) => (
                    <li key={subject.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      {subject.name}
                      <InlineAction
                        action={removeSubject}
                        hidden={{ subjectId: subject.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={`Remove ${subject.name}? It is removed from every class, and its period registers are deleted with it. Registers of other subjects are not affected.`}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              <ActionForm action={createSubject} resetOnSuccess className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <TextField name="name" label="New subject" placeholder="Integrated Science" />
                  </div>
                  <FieldButton always>
                    <SubmitButton>Add</SubmitButton>
                  </FieldButton>
                </div>
                <FormMessage />
              </ActionForm>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}
