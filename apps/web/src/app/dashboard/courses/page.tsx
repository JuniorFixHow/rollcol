import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, FieldButton, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { listTeachers } from "@/lib/queries";
import { addCourse, addCourseRun, addLecturer, approveCourseRun, lecturerAddCourse, removeLecturer, removeRecord } from "./actions";

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

  const [runsResult, { data: courses }, lecturers, { data: rules }] = await Promise.all([
    semester
      ? supabase
          .from("course_runs")
          .select(
            "id, source, approved_at, course:courses(code, title), course_run_staff(staff_id, staff(full_name)), enrolments(count)",
          )
          .eq("academic_period_id", semester.id)
      : Promise.resolve({ data: [] }),
    supabase.from("courses").select("id, code, title, source").eq("school_id", school.id).order("code"),
    isAdmin ? listTeachers(supabase, school.id) : Promise.resolve([]),
    supabase.from("school_settings").select("course_approval_required").eq("school_id", school.id).maybeSingle(),
  ]);
  const approvalRequired = rules?.course_approval_required ?? true;
  const openSemesters = (semesters ?? []).filter((s) => s.ends_on >= today);

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
              <Table search="Search by code, title or lecturer" headers={["Course", "Lecturers", "Students", ""]}>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <Td>
                      <span className="font-mono text-xs text-muted">{run.course?.code}</span>
                      <span className="block font-medium">{run.course?.title}</span>
                      {run.approved_at ? null : (
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge tone="warning">Waiting for approval</Badge>
                          {isAdmin ? (
                            <InlineAction
                              action={approveCourseRun}
                              hidden={{ courseRunId: run.id }}
                              label="Approve"
                              variant="primary"
                              confirm={`Approve ${run.course?.code ?? "this course"}? Students can then join it, and its lecturers can run sessions.`}
                            />
                          ) : null}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <ul className="space-y-1">
                        {run.course_run_staff.map((row) => (
                          <li key={row.staff_id} className="flex items-center gap-2">
                            {row.staff?.full_name}
                            {isAdmin && !school.isWorkspace ? (
                              <InlineAction
                                action={removeLecturer}
                                hidden={{ courseRunId: run.id, staffId: row.staff_id }}
                                label="Remove"
                                variant="ghost"
                                confirm={`Remove ${row.staff?.full_name ?? "this lecturer"} from this course? They can no longer run check-in sessions for it. Past sessions stay.`}
                              />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      {isAdmin && !school.isWorkspace ? (
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
                <ActionForm action={addCourseRun} resetOnSuccess className="mt-5 grid items-start gap-4 sm:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="academicPeriodId" value={semester.id} />
                  <SelectField
                    name="courseId"
                    label="Course"
                    placeholder="Choose a course"
                    options={(courses ?? []).map((c) => ({ value: c.id, label: `${c.code} ${c.title}` }))}
                  />
                  <SelectField name="lecturerId" label="Lecturer" placeholder="Choose later" options={lecturerOptions} />
                  <FieldButton>
                    <SubmitButton>Add to semester</SubmitButton>
                  </FieldButton>
                  <div className="sm:col-span-3">
                    <FormMessage />
                  </div>
                </ActionForm>
              )
            ) : null}
          </Card>
        )}

        {!isAdmin && openSemesters.length > 0 ? (
          <Card
            title="Add a course you teach"
            description={
              approvalRequired
                ? "You become its lecturer. An admin approves it before students can join and you can run sessions."
                : "You become its lecturer, and students can join it straight away."
            }
          >
            <ActionForm action={lecturerAddCourse} resetOnSuccess className="grid items-start gap-4 sm:grid-cols-3">
              <TextField name="code" label="Course code" placeholder="NUR 201" autoCapitalize="characters" autoComplete="off" />
              <TextField
                name="title"
                label="Title"
                placeholder="Medical Nursing"
                autoComplete="off"
                hint="If the code already exists, its title is kept."
              />
              <SelectField
                name="periodId"
                label="Semester"
                defaultValue={semester && openSemesters.some((s) => s.id === semester.id) ? semester.id : openSemesters[0]?.id}
                options={openSemesters.map((s) => ({ value: s.id, label: s.name }))}
              />
              <div className="space-y-3 sm:col-span-3">
                <FormMessage />
                <SubmitButton>Add course</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        ) : null}

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
              <ActionForm action={addCourse} resetOnSuccess className="grid items-start gap-4 sm:grid-cols-[10rem_1fr_auto]">
                <TextField name="code" label="Code" placeholder="CSC 101" autoCapitalize="characters" />
                <TextField name="title" label="Title" placeholder="Introduction to Computing" />
                <FieldButton>
                  <SubmitButton>Add course</SubmitButton>
                </FieldButton>
                <div className="sm:col-span-3">
                  <FormMessage />
                </div>
              </ActionForm>
            </Card>

          </>
        ) : null}
      </div>
    </>
  );
}
