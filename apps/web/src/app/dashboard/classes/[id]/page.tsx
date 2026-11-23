import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, FieldButton, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { periodLabel } from "@rollcol/shared";
import { Card, EmptyState, PageHeader, Table, Td, formatDate } from "@/components/ui";
import { RegisterStatusBadge } from "../../registers/status-badge";
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
  const perPeriod = school.registerMode === "per_period";

  const visible = await visibleClassIds(supabase, member);
  if (visible !== "all" && !visible.includes(id)) notFound();

  const [{ data: cls }, { data: students }, { data: classSubjects }, teachers, { data: subjects }] = await Promise.all([
    supabase.from("classes").select("id, name, class_teacher_id, periods_per_day").eq("id", id).eq("school_id", school.id).maybeSingle(),
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

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra" }).format(new Date());
  const [{ data: term }, { data: recentRegisters }] = await Promise.all([
    supabase
      .from("academic_periods")
      .select("id, name")
      .eq("school_id", school.id)
      .lte("starts_on", today)
      .gte("ends_on", today)
      .maybeSingle(),
    supabase
      .from("registers")
      .select("id, register_date, period_number, status, class_subject:class_subjects(subject:subjects(name))")
      .eq("class_id", cls.id)
      .order("register_date", { ascending: false })
      .order("period_number", { ascending: true })
      .limit(10),
  ]);
  const { data: schoolSettings } = await supabase
    .from("school_settings")
    .select("periods_per_day")
    .eq("school_id", school.id)
    .maybeSingle();
  const schoolPeriods = schoolSettings?.periods_per_day ?? 10;
  const { data: summary } = await supabase.rpc("class_attendance_summary", {
    p_class_id: cls.id,
    ...(term ? { p_academic_period_id: term.id } : {}),
  });
  const summaryById = new Map((summary ?? []).map((row) => [row.student_id, row]));
  const registerCount = summary?.[0]?.registers ?? 0;

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
        <Card
          title={`Students (${students?.length ?? 0})`}
          description={
            term
              ? `Attendance in ${term.name}: ${registerCount} ${registerCount === 1 ? "register" : "registers"} taken so far.`
              : "No term covers today, so these totals include every register. Add terms on the Terms page."
          }
        >
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
            <Table search="Search students" headers={["Student", "Present", "Late", "Absent", "Marks"]}>
              {(students ?? []).map((student) => {
                const totals = summaryById.get(student.id);
                return (
                  <tr key={student.id}>
                    <Td>
                      <Link href={`/dashboard/students/${student.id}`} className="font-medium hover:text-accent">
                        {student.full_name}
                      </Link>
                      {student.school_number ? <span className="ml-2 font-mono text-xs text-muted">{student.school_number}</span> : null}
                    </Td>
                    <Td className="tabular-nums">{totals?.present ?? 0}</Td>
                    <Td className="tabular-nums">{totals?.late ?? 0}</Td>
                    <Td className="tabular-nums">{totals?.absent ?? 0}</Td>
                    <Td className="tabular-nums font-medium">{Number(totals?.marks ?? 0)}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>

        <Card title="Recent registers">
          {(recentRegisters ?? []).length === 0 ? (
            <EmptyState>
              No registers yet.{" "}
              <Link href="/dashboard/registers" className="text-accent hover:underline">
                Take today&apos;s register
              </Link>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {(recentRegisters ?? []).map((register) => (
                <li key={register.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/dashboard/registers/${register.id}`} className="hover:text-accent">
                    {formatDate(register.register_date)} · {register.class_subject?.subject?.name ?? "Daily register"}
                    {register.period_number ? `, ${periodLabel(register.period_number)}` : ""}
                  </Link>
                  <RegisterStatusBadge status={register.status} />
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
            <Table search="Search subjects or teachers" headers={["Subject", "Teacher", ""]}>
              {sortedSubjects.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.subject?.name}</Td>
                  <Td className="text-muted">{row.teacher?.full_name ?? "Not set"}</Td>
                  <Td className="text-right">
                    {isAdmin ? (
                      <InlineAction
                        action={removeClassSubject}
                        hidden={{ classSubjectId: row.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={`Remove ${row.subject?.name ?? "this subject"} from ${cls.name}? Its period registers for this class are deleted too. The subject stays for other classes.`}
                      />
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
              <ActionForm action={assignSubjectTeacher.bind(null, cls.id)} className="mt-4 grid items-start gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <SelectField
                  name="subjectId"
                  label="Subject"
                  placeholder="Choose a subject"
                  options={(subjects ?? []).map((subject) => ({ value: subject.id, label: subject.name }))}
                />
                <SelectField name="teacherId" label="Teacher" placeholder="Choose later" options={teacherOptions} />
                <FieldButton>
                  <SubmitButton>Save</SubmitButton>
                </FieldButton>
                <div className="sm:col-span-3">
                  <FormMessage />
                </div>
              </ActionForm>
            )
          ) : null}
        </Card>

        {isAdmin ? (
          <Card title="Class details">
            <ActionForm
              action={updateClass.bind(null, cls.id)}
              className={`grid items-start gap-4 ${perPeriod ? "sm:grid-cols-[1fr_1fr_9rem_auto]" : "sm:grid-cols-[1fr_1fr_auto]"}`}
            >
              <TextField name="name" label="Class name" defaultValue={cls.name} />
              {school.isWorkspace ? null : (
                <SelectField
                  name="classTeacherId"
                  label="Class teacher"
                  placeholder="Not set"
                  defaultValue={cls.class_teacher_id ?? ""}
                  options={teacherOptions}
                />
              )}
              {perPeriod ? (
                <TextField
                  name="periodsPerDay"
                  label="Periods a day"
                  type="number"
                  inputMode="numeric"
                  placeholder={`School: ${schoolPeriods}`}
                  defaultValue={cls.periods_per_day ? String(cls.periods_per_day) : ""}
                  hint="Blank uses the school's number."
                />
              ) : null}
              <FieldButton>
                <SubmitButton>Save</SubmitButton>
              </FieldButton>
              <div className={perPeriod ? "sm:col-span-4" : "sm:col-span-3"}>
                <FormMessage />
              </div>
            </ActionForm>
            <div className="mt-6 border-t border-line pt-4">
              <InlineAction
                action={deleteClass.bind(null, cls.id)}
                label="Delete class"
                variant="danger"
                confirm={`Delete ${cls.name}? Its registers and their marks are deleted too. Its students stay in the school without a class, with their guardians.`}
              />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
