import { ABSENCE_REASONS, type RegisterMarks, isAbsenceReason, isAttendanceMark, marksLabel, periodLabel } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, PageHeader, formatLongDate, formatTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { RegisterStatusBadge } from "../status-badge";
import { RegisterSheet } from "./register-sheet";

export const metadata: Metadata = { title: "Register" };

function ghanaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra" }).format(new Date());
}

export default async function RegisterPage({ params }: PageProps<"/dashboard/registers/[id]">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();
  const { school } = member;
  const isAdmin = member.role === "admin";

  const { data: register } = await supabase
    .from("registers")
    .select(
      "id, class_id, class_subject_id, period_number, register_date, status, reward_marks, closes_at, submitted_at, class:classes(name, class_teacher_id), class_subject:class_subjects(teacher_id, subject:subjects(name))",
    )
    .eq("id", id)
    .eq("school_id", school.id)
    .maybeSingle();
  if (!register) notFound();

  const [{ data: students }, { data: entries }, { data: reports }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, school_number")
      .eq("class_id", register.class_id)
      .neq("status", "disabled")
      .order("full_name"),
    supabase.from("register_entries").select("student_id, mark").eq("register_id", register.id),
    // Parents' absence reports covering this day.
    supabase
      .from("absence_reports")
      .select("student_id, reason, note")
      .eq("status", "active")
      .lte("from_date", register.register_date)
      .gte("to_date", register.register_date),
  ]);
  const reported = new Map(
    (reports ?? []).map((r) => [
      r.student_id,
      `${isAbsenceReason(r.reason) ? ABSENCE_REASONS[r.reason] : r.reason}${r.note ? ` (${r.note})` : ""}`,
    ]),
  );

  const marks: RegisterMarks = {};
  for (const entry of entries ?? []) {
    if (isAttendanceMark(entry.mark)) marks[entry.student_id] = entry.mark;
  }

  // The database applies the same rules; this decides what to show.
  const canTake =
    isAdmin || register.class?.class_teacher_id === member.id || register.class_subject?.teacher_id === member.id;
  const sameDay = register.register_date === ghanaToday();
  const editable = canTake && (isAdmin || sameDay);

  const subjectName = register.class_subject?.subject?.name;
  const title = `${register.class?.name ?? "Class"}${subjectName ? `, ${subjectName}` : ""}`;

  return (
    <>
      <PageHeader
        title={title}
        description={
          <>
            {formatLongDate(register.register_date)} · {periodLabel(register.period_number)}
            {register.reward_marks > 0 ? ` · ${marksLabel(Number(register.reward_marks))} for attending` : ""}
          </>
        }
        actions={<RegisterStatusBadge status={register.status} />}
      />

      <div className="space-y-4">
        {register.status === "open" ? (
          <Notice>
            Marks save as you go. Submit when you are done; otherwise the register closes on its own at{" "}
            {formatTime(register.closes_at)}. You can still correct marks for the rest of the day, for example when a child
            arrives late.
          </Notice>
        ) : null}
        {!editable && canTake && !sameDay ? (
          <Notice tone="neutral">This register is from an earlier day. Only an admin can change it now.</Notice>
        ) : null}
        {!canTake ? <Notice tone="neutral">You can view this register. Its teacher or an admin marks it.</Notice> : null}

        <Card>
          {(students ?? []).length === 0 ? (
            <p className="text-sm text-muted">
              This class has no students.{" "}
              <Link href="/dashboard/students" className="text-accent hover:underline">
                Add students
              </Link>
            </p>
          ) : (
            <RegisterSheet
              registerId={register.id}
              students={(students ?? []).map((s) => ({
                id: s.id,
                name: s.full_name,
                number: s.school_number,
                reported: reported.get(s.id) ?? null,
              }))}
              initialMarks={marks}
              editable={editable}
              open={register.status === "open"}
            />
          )}
        </Card>

        <Link href="/dashboard/registers" className="inline-block text-sm text-accent hover:underline">
          Back to today&apos;s registers
        </Link>
      </div>
    </>
  );
}
