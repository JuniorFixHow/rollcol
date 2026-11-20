import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { listTeachers, visibleClassIds } from "@/lib/queries";
import { assignSubjectTeacher, deleteClass, removeClassSubject, updateClass } from "../actions";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: PageProps<"/dashboard/classes/[id]">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();
  const { school } = member;
  if (school.type === "tertiary") redirect("/dashboard/courses");
  const isAdmin = member.role === "admin";

  const visible = await visibleClassIds(supabase, member);
  if (visible !== "all" && !visible.includes(id)) notFound();

  const [{ data: cls }, { data: students }, { data: classSubjects }, teachers, { data: subjects }] = await Promise.all([
    supabase.from("classes").select("id, name, class_teacher_id").eq("id", id).eq("school_id", school.id).maybeSingle(),
    supabase
      .from("students")
      .select("id, full_name, school_number, status")
      .eq("class_id", id)
      .neq("status", "disabled")
      .order("full_name"),
    supabase
      .from("class_subjects")
      .select("id, subject:subjects(name), teacher:staff!class_subjects_teacher_id_school_id_fkey(full_name)")
      .eq("class_id", id),
    isAdmin ? listTeachers(supabase, school.id) : Promise.resolve([]),
    isAdmin ? supabase.from("subjects").select("id, name").eq("school_id", school.id).order("name") : Promise.resolve({ data: [] }),
  ]);
  if (!cls) notFound();

  const teacherOptions = teachers.map((teacher) => ({ value: teacher.id, label: teacher.full_name }));
  const sortedSubjects = [...(classSubjects ?? [])].sort((a, b) => (a.subject?.name ?? "").localeCompare(b.subject?.name ?? ""));

  return (
    <>
      <PageHeader
        title={cls.name}
        description={
          <Link href="/dashboard/classes" className="text-accent hover:underline">
            All classes
          </Link>
        }
      />

      <div className="space-y-6">
        <Card title={`Students (${students?.length ?? 0})`}>
          {(students ?? []).length === 0 ? (
            <EmptyState>
              No students in this class yet.{" "}
              {isAdmin ? (
                <Link href="/dashboard/students" className="text-accent hover:underline">
                  Add students
                </Link>
              ) : null}
            </EmptyState>
          ) : (
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {(students ?? []).map((student) => (
                <li key={student.id}>
                  <Link href={`/dashboard/students/${student.id}`} className="hover:text-accent">
                    {student.full_name}
                  </Link>
                  {student.school_number ? <span className="ml-2 font-mono text-xs text-muted">{student.school_number}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Subject teachers"
          description={
            school.registerMode === "per_period"
              ? "Each teacher marks the register for their own subject periods."
              : "Your school uses daily registers, so this is optional."
          }
        >
          {sortedSubjects.length === 0 ? (
            <EmptyState>No subjects on this class yet.</EmptyState>
          ) : (
            <Table headers={["Subject", "Teacher", ""]}>
              {sortedSubjects.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.subject?.name}</Td>
                  <Td className="text-muted">{row.teacher?.full_name ?? "Not set"}</Td>
                  <Td className="text-right">
                    {isAdmin ? (
                      <InlineAction action={removeClassSubject} hidden={{ classSubjectId: row.id }} label="Remove" variant="ghost" />
                    ) : null}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          {isAdmin ? (
            (subjects ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Add subjects on the{" "}
                <Link href="/dashboard/classes" className="text-accent hover:underline">
                  Classes page
                </Link>{" "}
                first.
              </p>
            ) : (
              <ActionForm action={assignSubjectTeacher.bind(null, cls.id)} className="mt-4 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <SelectField
                  name="subjectId"
                  label="Subject"
                  placeholder="Choose a subject"
                  options={(subjects ?? []).map((subject) => ({ value: subject.id, label: subject.name }))}
                />
                <SelectField name="teacherId" label="Teacher" placeholder="Choose later" options={teacherOptions} />
                <SubmitButton>Save</SubmitButton>
                <div className="sm:col-span-3">
                  <FormMessage />
                </div>
              </ActionForm>
            )
          ) : null}
        </Card>

        {isAdmin ? (
          <Card title="Class details">
            <ActionForm action={updateClass.bind(null, cls.id)} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <TextField name="name" label="Class name" defaultValue={cls.name} />
              <SelectField
                name="classTeacherId"
                label="Class teacher"
                placeholder="Not set"
                defaultValue={cls.class_teacher_id ?? ""}
                options={teacherOptions}
              />
              <SubmitButton>Save</SubmitButton>
              <div className="sm:col-span-3">
                <FormMessage />
              </div>
            </ActionForm>
            <div className="mt-6 border-t border-line pt-4">
              <InlineAction
                action={deleteClass.bind(null, cls.id)}
                label="Delete class"
                variant="danger"
                confirm={`Delete ${cls.name}? Its students stay, without a class.`}
              />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
