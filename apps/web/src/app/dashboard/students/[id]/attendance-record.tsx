import { attendanceRate, buildClassReport, isBelow } from "@rollcol/shared";
import Link from "next/link";
import { Badge, Card, EmptyState, Table, Td, formatLongDate } from "@/components/ui";
import type { StaffMember } from "@/lib/auth";
import { choosePeriod, lowAttendancePercent } from "@/lib/periods";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** This term's (or semester's) attendance for one student. */
export async function AttendanceRecord({
  supabase,
  member,
  student,
}: {
  supabase: Supabase;
  member: StaffMember;
  student: { id: string; class_id: string | null; first_name: string };
}) {
  const { school } = member;
  const tertiary = school.type === "tertiary";
  const isAdmin = member.role === "admin";
  // Lecturers see a student's attendance in each course's report instead.
  if (tertiary && !isAdmin) return null;

  const [{ period }, threshold] = await Promise.all([choosePeriod(supabase, school.id, null), lowAttendancePercent(supabase, school.id)]);
  const title = `Attendance${period ? `, ${period.name}` : ""}`;

  if (tertiary) {
    const { data: courses } = await supabase.rpc("student_course_attendance", {
      p_student_id: student.id,
      p_period_id: period?.id ?? null,
    });
    const list = courses ?? [];
    return (
      <Card title={title} description="Sessions held for each course this student joined, and how many they attended.">
        {list.length === 0 ? (
          <EmptyState>This student has not joined any courses this semester.</EmptyState>
        ) : (
          <Table headers={["Course", "Attended", "%", "Marks"]}>
            {list.map((row) => {
              const rate = attendanceRate(row.attended, row.held);
              return (
                <tr key={row.course_run_id}>
                  <Td>
                    <Link href={`/dashboard/reports/course/${row.course_run_id}`} className="font-medium text-accent hover:underline">
                      {row.code}
                    </Link>
                    <span className="block text-xs text-muted">{row.title}</span>
                  </Td>
                  <Td>{row.held === 0 ? <span className="text-muted">No sessions yet</span> : `${row.attended} of ${row.held}`}</Td>
                  <Td>{rate === null ? "" : <Badge tone={isBelow(rate, threshold) ? "danger" : "neutral"}>{rate}%</Badge>}</Td>
                  <Td>{row.marks}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    );
  }

  // Other classes whose registers mark this pupil (for example a class moved in from a workspace).
  const { data: classes } = await supabase.rpc("student_register_classes", { p_student_id: student.id });
  const otherClasses = (classes ?? []).filter((c) => !c.is_own);
  const others = (
    await Promise.all(
      otherClasses.map(async (c) => {
        const { data: rows } = await supabase.rpc("class_register_days", { p_class_id: c.class_id, p_period_id: period?.id ?? null });
        const line = buildClassReport((rows ?? []).filter((row) => row.student_id === student.id)).students[0];
        return line && line.held > 0 ? { id: c.class_id, name: c.class_name, line } : null;
      }),
    )
  ).filter((other) => other !== null);
  const otherList =
    others.length > 0 ? (
      <div className="mt-5">
        <p className="text-sm font-medium">Also marked in</p>
        <ul className="mt-2 divide-y divide-line rounded-md border border-line text-sm">
          {others.map((other) => (
            <li key={other.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
              <Link href={`/dashboard/reports/class/${other.id}?view=all${period ? `&period=${period.id}` : ""}`} className="text-accent hover:underline">
                {other.name}
              </Link>
              <span>
                Attendance {other.line.attended} out of {other.line.held}
                {other.line.rate === null ? "" : ` (${other.line.rate}%)`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  if (!student.class_id) {
    return (
      <Card title={title}>
        <EmptyState>Put {student.first_name} in a class to see their attendance.</EmptyState>
        {otherList}
      </Card>
    );
  }
  const { data: days } = await supabase.rpc("class_register_days", {
    p_class_id: student.class_id,
    p_period_id: period?.id ?? null,
  });
  const record = buildClassReport((days ?? []).filter((row) => row.student_id === student.id)).students[0];
  if (!record || record.held === 0) {
    return (
      <Card title={title}>
        <EmptyState>No registers have been taken for {student.first_name}&apos;s class this term yet.</EmptyState>
        {otherList}
      </Card>
    );
  }
  const missed = Object.entries(record.marks)
    .filter(([, mark]) => mark !== "present")
    .sort(([a], [b]) => b.localeCompare(a));

  return (
    <Card
      title={title}
      description={
        <>
          For the report card ({student.first_name}&apos;s own class). Present and late both count.{" "}
          <Link href={`/dashboard/reports/class/${student.class_id}${period ? `?period=${period.id}` : ""}`} className="text-accent hover:underline">
            See the class register
          </Link>
        </>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="text-2xl font-semibold">
          Attendance {record.attended} out of {record.held}
        </p>
        {record.rate === null ? null : (
          <Badge tone={isBelow(record.rate, threshold) ? "danger" : "success"}>
            {record.rate}%{isBelow(record.rate, threshold) ? `, below ${threshold}%` : ""}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        {record.present} present, {record.late} late, {record.absent} absent
        {record.held - record.present - record.late - record.absent > 0
          ? `, ${record.held - record.present - record.late - record.absent} not marked`
          : ""}
        .
      </p>
      {missed.length > 0 ? (
        <ul className="mt-4 divide-y divide-line rounded-md border border-line text-sm">
          {missed.map(([day, mark]) => (
            <li key={day} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>{formatLongDate(day)}</span>
              <Badge tone={mark === "late" ? "warning" : mark === "absent" ? "danger" : "neutral"}>
                {mark === "late" ? "Late" : mark === "absent" ? "Absent" : "Not marked"}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {otherList}
    </Card>
  );
}
