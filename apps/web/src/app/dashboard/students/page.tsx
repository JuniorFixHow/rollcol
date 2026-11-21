import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { visibleClassIds } from "@/lib/queries";
import { addStudent, setStudentStatus } from "./actions";

export const metadata: Metadata = { title: "Students" };

const STATUSES = ["active", "pending", "disabled"] as const;
type StatusFilter = (typeof STATUSES)[number];

export default async function StudentsPage({ searchParams }: PageProps<"/dashboard/students">) {
  const params = await searchParams;
  const { supabase, member } = await requireStaff();
  const { school } = member;
  const isAdmin = member.role === "admin";
  const tertiary = school.type === "tertiary";

  const statusParam = typeof params.status === "string" ? params.status : "";
  const status: StatusFilter = (STATUSES as readonly string[]).includes(statusParam) ? (statusParam as StatusFilter) : "active";
  const classFilter = typeof params.class === "string" ? params.class : "";

  const visible = tertiary ? "all" : await visibleClassIds(supabase, member);

  let query = supabase
    .from("students")
    .select(
      "id, full_name, school_number, status, source, class:classes(name), programme:programmes(name), batch:batches(name), guardian_links(count)",
    )
    .eq("school_id", school.id)
    .eq("status", status)
    .order("full_name")
    .limit(500);
  if (classFilter) query = query.eq("class_id", classFilter);
  if (visible !== "all") query = query.in("class_id", visible);

  let classQuery = supabase.from("classes").select("id, name").eq("school_id", school.id).is("archived_at", null).order("name");
  if (visible !== "all") classQuery = classQuery.in("id", visible);

  const [{ data: students, error }, { data: classes }, { data: settings }] = await Promise.all([
    query,
    tertiary ? Promise.resolve({ data: [] }) : classQuery,
    supabase.from("school_settings").select("student_approval_required").eq("school_id", school.id).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);

  const statusLabels: Record<StatusFilter, string> = { active: "Active", pending: "Waiting for approval", disabled: "Turned off" };
  const filterHref = (next: { status?: string; class?: string }) => {
    const search = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextClass = next.class ?? classFilter;
    if (nextStatus !== "active") search.set("status", nextStatus);
    if (nextClass) search.set("class", nextClass);
    const query = search.toString();
    return `/dashboard/students${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title={isAdmin || tertiary ? "Students" : "Your students"}
        description={
          tertiary
            ? `Students create their accounts in the RollCol app with your school code, ${school.code}.${
                settings?.student_approval_required ? " An admin approves each new student." : ""
              }`
            : "Students do not have accounts. Teachers mark registers, and guardians receive SMS alerts."
        }
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {(tertiary || isAdmin ? STATUSES : (["active"] as const)).map((value) => (
            <Link
              key={value}
              href={filterHref({ status: value })}
              className={`rounded-full border px-3 py-1 text-sm ${
                value === status ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-foreground"
              }`}
            >
              {statusLabels[value]}
            </Link>
          ))}
          {!tertiary && (classes ?? []).length > 0 ? (
            <form className="ml-auto" action="/dashboard/students">
              {status !== "active" ? <input type="hidden" name="status" value={status} /> : null}
              <label className="sr-only" htmlFor="class-filter">
                Class
              </label>
              <select
                id="class-filter"
                name="class"
                defaultValue={classFilter}
                className="h-9 rounded-md border border-line bg-surface px-2 text-sm"
              >
                <option value="">All classes</option>
                {(classes ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="ml-2 text-sm text-accent hover:underline">
                Show
              </button>
            </form>
          ) : null}
        </div>

        {students.length === 0 ? (
          <EmptyState>
            {status === "pending" ? "No students are waiting for approval." : "No students here yet."}
          </EmptyState>
        ) : (
          <Table search="Search by name, school ID, class or programme" headers={tertiary ? ["Name", "School ID", "Programme", ""] : ["Name", "School ID", "Class", "Guardians"]}>
            {students.map((student) => (
              <tr key={student.id}>
                <Td>
                  <Link href={`/dashboard/students/${student.id}`} className="font-medium text-accent hover:underline">
                    {student.full_name}
                  </Link>
                  {student.source === "stediis" ? (
                    <span className="ml-2">
                      <Badge>Managed in Stediis</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td className="font-mono text-xs">{student.school_number}</Td>
                {tertiary ? (
                  <>
                    <Td className="text-muted">
                      {[student.programme?.name, student.batch?.name].filter(Boolean).join(", ") || "Not set"}
                    </Td>
                    <Td className="text-right">
                      {isAdmin && student.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <InlineAction
                            action={setStudentStatus}
                            hidden={{ studentId: student.id, status: "active" }}
                            label="Approve"
                            variant="primary"
                          />
                          <InlineAction
                            action={setStudentStatus}
                            hidden={{ studentId: student.id, status: "disabled" }}
                            label="Decline"
                            confirm={`Decline ${student.full_name}? They will not be able to check in.`}
                          />
                        </div>
                      ) : null}
                    </Td>
                  </>
                ) : (
                  <>
                    <Td className="text-muted">{student.class?.name ?? "No class"}</Td>
                    <Td>
                      {(student.guardian_links[0]?.count ?? 0) === 0 ? (
                        <Badge tone="warning">None</Badge>
                      ) : (
                        <span className="tabular-nums">{student.guardian_links[0]?.count}</span>
                      )}
                    </Td>
                  </>
                )}
              </tr>
            ))}
          </Table>
        )}
        {students.length === 500 ? <Notice tone="neutral">Showing the first 500. Choose a class to narrow the list.</Notice> : null}

        {isAdmin && !tertiary ? (
          <Card title="Add a student">
            <ActionForm action={addStudent} resetOnSuccess className="grid gap-4 sm:grid-cols-3">
              <TextField name="fullName" label="Full name" autoComplete="off" />
              <TextField name="schoolId" label="School ID" hint="Optional, for example the admission number." autoCapitalize="characters" />
              <SelectField
                name="classId"
                label="Class"
                placeholder="No class yet"
                defaultValue={classFilter}
                options={(classes ?? []).map((item) => ({ value: item.id, label: item.name }))}
              />
              <div className="space-y-3 sm:col-span-3">
                <FormMessage />
                <SubmitButton>Add student</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
