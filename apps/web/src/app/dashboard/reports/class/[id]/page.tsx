import { isBelow, markLetter, periodWordTitle } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PeriodChips } from "@/components/period-chips";
import { ReportDownloads } from "@/components/report-downloads";
import { ReportViewBar } from "@/components/report-view-bar";
import { Badge, Card, EmptyState, PageHeader, Table, Td, formatLongDate } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { viewQuery, weekColumns } from "@/lib/report-view";
import { loadClassReport } from "@/lib/reports";
import { PrintLandscape } from "../../print-landscape";
import { PrintReport } from "../../print-report";
import { ReportGrid } from "../../report-grid";

export const metadata: Metadata = { title: "Class report" };

const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function dayParts(day: string) {
  const [weekday = "", date = "", month = ""] = shortDay.format(new Date(`${day}T00:00:00Z`)).replace(",", "").split(" ");
  return { weekday, date, month };
}

export default async function ClassReportPage({ params, searchParams }: PageProps<"/dashboard/reports/class/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, member } = await requireStaff();
  if (member.school.type === "tertiary") redirect("/dashboard/reports");
  const data = await loadClassReport(supabase, member, id, query);
  if (!data) notFound();
  const { klass, periods, period, view, threshold, report, subjects, heading } = data;
  const word = periodWordTitle(member.school.type);
  const path = `/dashboard/reports/class/${klass.id}`;
  const extra = { period: view.mode === "all" ? period?.id : undefined };
  const exportHref = `${path}/export?${viewQuery(view, extra)}`;
  const below = report.students.filter((s) => isBelow(s.rate, threshold));
  const held = new Set(report.days);
  // A week shows Monday to Friday even on days without a register, like a calendar.
  const columns = weekColumns(view, report.days) ?? report.days;
  const empty =
    view.mode === "week"
      ? "No registers were taken for this class this week. Use the arrows to see other weeks."
      : view.mode === "range"
        ? "No registers were taken for this class between these dates."
        : `No registers have been taken for this class in ${period?.name ?? "this term"} yet.`;

  return (
    <>
      <PrintLandscape />
      <div className="print:hidden">
        <PageHeader
          title={`${klass.name} attendance`}
          description={
            <Link href={`/dashboard/reports${period ? `?period=${period.id}` : ""}`} className="text-accent hover:underline">
              All reports
            </Link>
          }
          actions={report.days.length > 0 ? <ReportDownloads href={exportHref} /> : null}
        />
        <ReportViewBar
          path={path}
          view={view}
          extra={extra}
          allLabel={period ? `Whole ${word.toLowerCase()}: ${period.name}` : "All dates"}
          allNote={<PeriodChips periods={periods} currentId={period?.id} href={(p) => `${path}?${viewQuery({ mode: "all" }, { period: p })}`} />}
        />

        {report.days.length === 0 ? (
          <EmptyState>{empty}</EmptyState>
        ) : (
          <div className="space-y-6">
            <Card
              title="Register"
              description={`${report.days.length} ${report.days.length === 1 ? "school day" : "school days"} with a register. P present, L late, A absent. When a class is marked every period, a day counts as present if the pupil was in any period.`}
            >
              <ReportGrid
                columns={columns.map((day) => {
                  const { weekday, date, month } = dayParts(day);
                  return {
                    key: day,
                    label: (
                      <span title={formatLongDate(day)} className={`leading-tight ${held.has(day) ? "" : "opacity-50"}`}>
                        {weekday}
                        <br />
                        {date} {month}
                      </span>
                    ),
                  };
                })}
                totals={["Present", "Late", "Absent", "Attendance", "%"]}
                rows={report.students.map((student) => ({
                  key: student.id,
                  name: (
                    <Link href={`/dashboard/students/${student.id}`} className="hover:underline">
                      {student.name}
                    </Link>
                  ),
                  cells: columns.map((day) => {
                    if (!held.has(day)) return { key: day, value: "", tone: "" };
                    const letter = markLetter(student.marks[day] ?? null);
                    return { key: day, value: letter || "·", tone: letter === "P" || letter === "L" || letter === "A" ? letter : "" };
                  }),
                  totals: [
                    student.present,
                    student.late,
                    student.absent,
                    `${student.attended} out of ${student.held}`,
                    student.rate === null ? (
                      ""
                    ) : (
                      <Badge key="rate" tone={isBelow(student.rate, threshold) ? "danger" : "neutral"}>
                        {student.rate}%
                      </Badge>
                    ),
                  ],
                }))}
              />
              {view.mode === "week" && columns.length > report.days.length ? (
                <p className="mt-3 text-xs text-muted">Faded days had no register.</p>
              ) : null}
            </Card>

            <Card
              title="For report cards"
              description={`Each pupil's line for ${view.mode === "all" ? "their terminal report" : "these dates"}. Pupils below ${threshold}% are marked.`}
            >
              <Table headers={["Name", "School ID", "Attendance", "%"]} search="Search pupils">
                {report.students.map((student) => (
                  <tr key={student.id}>
                    <Td className="font-medium">{student.name}</Td>
                    <Td className="font-mono text-xs">{student.schoolNumber ?? ""}</Td>
                    <Td>
                      Attendance {student.attended} out of {student.held}
                    </Td>
                    <Td>
                      {student.rate === null ? "" : `${student.rate}%`}{" "}
                      {isBelow(student.rate, threshold) ? <Badge tone="danger">Below {threshold}%</Badge> : null}
                    </Td>
                  </tr>
                ))}
              </Table>
              {below.length > 0 ? (
                <p className="mt-3 text-sm text-muted">
                  {below.length} {below.length === 1 ? "pupil is" : "pupils are"} below {threshold}%.
                </p>
              ) : null}
            </Card>

            {subjects.length > 0 ? (
              <Card title="By subject" description="Lessons marked by subject teachers in these dates, and how each pupil did.">
                <Table headers={["Name", "Subject", "Lessons", "Present", "Late", "Absent"]} search="Search pupils or subjects">
                  {subjects.map((row) => (
                    <tr key={`${row.student_id}-${row.subject}`}>
                      <Td className="font-medium">{row.full_name}</Td>
                      <Td>{row.subject}</Td>
                      <Td>{row.held}</Td>
                      <Td>{row.present}</Td>
                      <Td>{row.late}</Td>
                      <Td>{row.absent > 0 ? <span className="text-danger">{row.absent}</span> : 0}</Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            ) : null}
          </div>
        )}
      </div>

      {report.days.length > 0 ? (
        <PrintReport
          school={heading.school}
          title={heading.title}
          period={heading.period}
          tables={[
            {
              headers: [
                "Name",
                ...report.days.map((day) => {
                  const { weekday, date, month } = dayParts(day);
                  return `${weekday} ${date} ${month}`;
                }),
                "P",
                "L",
                "A",
                "Attendance",
                "%",
              ],
              centreFrom: 1,
              rows: report.students.map((s) => ({
                key: s.id,
                flag: isBelow(s.rate, threshold),
                cells: [
                  s.name,
                  ...report.days.map((day) => markLetter(s.marks[day] ?? null)),
                  String(s.present),
                  String(s.late),
                  String(s.absent),
                  `${s.attended} out of ${s.held}`,
                  s.rate === null ? "" : `${s.rate}%${isBelow(s.rate, threshold) ? " (low)" : ""}`,
                ],
              })),
            },
            ...(subjects.length > 0
              ? [
                  {
                    title: "By subject",
                    headers: ["Name", "Subject", "Lessons", "Present", "Late", "Absent"],
                    centreFrom: 2,
                    rows: subjects.map((row) => ({
                      key: `${row.student_id}-${row.subject}`,
                      cells: [row.full_name, row.subject, String(row.held), String(row.present), String(row.late), String(row.absent)],
                    })),
                  },
                ]
              : []),
          ]}
          notes={[`P present, L late, A absent. Present and late count as attended. "(low)" means below ${threshold}%.`]}
        />
      ) : null}
    </>
  );
}
