import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { listTeachers } from "@/lib/queries";
import { addBatch, addCourse, addCourseRun, addLecturer, addProgramme, removeLecturer, removeRecord } from "./actions";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage({ searchParams }: PageProps<"/dashboard/courses">) {
  const params = await searchParams;
  const { supabase, member } = await requireStaff();
  const { school } = member;
  if (school.type !== "tertiary") redirect("/dashboard/classes");
  const isAdmin = member.role === "admin";

  const { data: semesters } = await supabase
    .from("academic_periods")
    .select("id, name, starts_on, ends_on")
    .eq("school_id", school.id)
    .order("starts_on", { ascending: false });

  // Display only: the semester containing today, else the latest one.
  const today = new Date().toISOString().slice(0, 10);
  const requested = typeof params.semester === "string" ? params.semester : "";
  const semester =
    (semesters ?? []).find((s) => s.id === requested) ??
    (semesters ?? []).find((s) => s.starts_on <= today && today <= s.ends_on) ??
    (semesters ?? [])[0];

  const [runsResult, { data: courses }, { data: programmes }, { data: batches }, lecturers] = await Promise.all([
    semester
      ? supabase
          .from("course_runs")
          .select(
            "id, source, course:courses(code, title), course_run_staff(staff_id, staff(full_name)), enrolments(count)",
          )
          .eq("academic_period_id", semester.id)
      : Promise.resolve({ data: [] }),
    supabase.from("courses").select("id, code, title, source").eq("school_id", school.id).order("code"),
    supabase.from("programmes").select("id, name, code, source").eq("school_id", school.id).order("name"),
    supabase.from("batches").select("id, name, programme_id, entry_year, source").eq("school_id", school.id).order("name"),
    isAdmin ? listTeachers(supabase, school.id) : Promise.resolve([]),
  ]);

  const allRuns = [...(runsResult.data ?? [])].sort((a, b) => (a.course?.code ?? "").localeCompare(b.course?.code ?? ""));
  const runs = isAdmin ? allRuns : allRuns.filter((run) => run.course_run_staff.some((row) => row.staff_id === member.id));
  const lecturerOptions = lecturers.map((l) => ({ value: l.id, label: l.full_name }));

  return (
    <>
      <PageHeader
        title={isAdmin ? "Courses" : "Your courses"}
        description="Students join the courses they are registered for in the RollCol app. Lecturers run check-in sessions for their courses."
      />

      <div className="space-y-6">
        {(semesters ?? []).length === 0 ? (
          <EmptyState>
            Add a semester first.{" "}
            {isAdmin ? (
              <Link href="/dashboard/calendar" className="text-accent hover:underline">
                Go to Semesters
              </Link>
            ) : null}
          </EmptyState>
        ) : (
          <Card title={semester ? semester.name : "Semester"}>
            {(semesters ?? []).length > 1 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {(semesters ?? []).map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/courses?semester=${s.id}`}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      s.id === semester?.id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            ) : null}

            {runs.length === 0 ? (
              <EmptyState>{isAdmin ? "No courses in this semester yet." : "You are not assigned to a course this semester."}</EmptyState>
            ) : (
              <Table headers={["Course", "Lecturers", "Students", ""]}>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <Td>
                      <span className="font-mono text-xs text-muted">{run.course?.code}</span>
                      <span className="block font-medium">{run.course?.title}</span>
                    </Td>
                    <Td>
                      <ul className="space-y-1">
                        {run.course_run_staff.map((row) => (
                          <li key={row.staff_id} className="flex items-center gap-2">
                            {row.staff?.full_name}
                            {isAdmin ? (
                              <InlineAction
                                action={removeLecturer}
                                hidden={{ courseRunId: run.id, staffId: row.staff_id }}
                                label="Remove"
                                variant="ghost"
                              />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      {isAdmin ? (
                        <ActionForm action={addLecturer.bind(null, run.id)} className="mt-2 flex items-center gap-2">
                          <label className="sr-only" htmlFor={`lecturer-${run.id}`}>
                            Add lecturer
                          </label>
                          <select id={`lecturer-${run.id}`} name="staffId" className="h-8 rounded-md border border-line bg-surface px-2 text-sm">
                            <option value="">Add lecturer</option>
                            {lecturerOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <SubmitButton size="sm" variant="secondary">
                            Add
                          </SubmitButton>
                          <FormMessage />
                        </ActionForm>
                      ) : null}
                    </Td>
                    <Td className="tabular-nums">{run.enrolments[0]?.count ?? 0}</Td>
                    <Td className="text-right">
                      {isAdmin && run.source === "rollcol" ? (
                        <InlineAction
                          action={removeRecord}
                          hidden={{ table: "course_runs", id: run.id }}
                          label="Remove"
                          variant="ghost"
                          confirm="Remove this course from the semester? Students' enrolments in it are removed too."
                        />
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}

            {isAdmin && semester ? (
              (courses ?? []).length === 0 ? (
                <p className="mt-4 text-sm text-muted">Add courses below first.</p>
              ) : (
                <ActionForm action={addCourseRun} resetOnSuccess className="mt-5 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="academicPeriodId" value={semester.id} />
                  <SelectField
                    name="courseId"
                    label="Course"
                    placeholder="Choose a course"
                    options={(courses ?? []).map((c) => ({ value: c.id, label: `${c.code} ${c.title}` }))}
                  />
                  <SelectField name="lecturerId" label="Lecturer" placeholder="Choose later" options={lecturerOptions} />
                  <SubmitButton>Add to semester</SubmitButton>
                  <div className="sm:col-span-3">
                    <FormMessage />
                  </div>
                </ActionForm>
              )
            ) : null}
          </Card>
        )}

        {isAdmin ? (
          <>
            <Card title="Course catalogue" description="Every course the school offers. Add a course to a semester above.">
              {(courses ?? []).length > 0 ? (
                <ul className="mb-4 divide-y divide-line rounded-md border border-line">
                  {(courses ?? []).map((course) => (
                    <li key={course.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span>
                        <span className="font-mono text-xs text-muted">{course.code}</span> {course.title}
                        {course.source === "stediis" ? (
                          <span className="ml-2">
                            <Badge>Managed in Stediis</Badge>
                          </span>
                        ) : null}
                      </span>
                      {course.source === "rollcol" ? (
                        <InlineAction
                          action={removeRecord}
                          hidden={{ table: "courses", id: course.id }}
                          label="Remove"
                          variant="ghost"
                          confirm={`Remove ${course.code}? It is removed from every semester.`}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ActionForm action={addCourse} resetOnSuccess className="grid items-end gap-4 sm:grid-cols-[10rem_1fr_auto]">
                <TextField name="code" label="Code" placeholder="CSC 101" autoCapitalize="characters" />
                <TextField name="title" label="Title" placeholder="Introduction to Computing" />
                <SubmitButton>Add course</SubmitButton>
                <div className="sm:col-span-3">
                  <FormMessage />
                </div>
              </ActionForm>
            </Card>

            <Card title="Programmes and batches" description="Optional. Used to group students, for example BSc Nursing, 2025 intake.">
              {(programmes ?? []).length > 0 ? (
                <ul className="mb-4 space-y-3">
                  {(programmes ?? []).map((programme) => (
                    <li key={programme.id} className="rounded-md border border-line p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">
                          {programme.name}
                          {programme.code ? <span className="ml-2 font-mono text-xs text-muted">{programme.code}</span> : null}
                        </span>
                        {programme.source === "rollcol" ? (
                          <InlineAction
                            action={removeRecord}
                            hidden={{ table: "programmes", id: programme.id }}
                            label="Remove"
                            variant="ghost"
                            confirm={`Remove ${programme.name} and its batches?`}
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 text-muted">
                        {(batches ?? [])
                          .filter((b) => b.programme_id === programme.id)
                          .map((b) => b.name)
                          .join(", ") || "No batches yet"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="grid gap-6 lg:grid-cols-2">
                <ActionForm action={addProgramme} resetOnSuccess>
                  <TextField name="name" label="Programme" placeholder="BSc Nursing" />
                  <TextField name="code" label="Code (optional)" autoCapitalize="characters" />
                  <FormMessage />
                  <SubmitButton variant="secondary">Add programme</SubmitButton>
                </ActionForm>
                {(programmes ?? []).length > 0 ? (
                  <ActionForm action={addBatch} resetOnSuccess>
                    <SelectField
                      name="programmeId"
                      label="Programme"
                      placeholder="Choose a programme"
                      options={(programmes ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    />
                    <TextField name="name" label="Batch" placeholder="2025 intake" />
                    <TextField name="entryYear" label="Entry year (optional)" type="number" inputMode="numeric" />
                    <FormMessage />
                    <SubmitButton variant="secondary">Add batch</SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
