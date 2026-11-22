import { isBelow, markLetter } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PeriodChips } from "@/components/period-chips";
import { ReportDownloads } from "@/components/report-downloads";
import { Badge, Card, EmptyState, PageHeader, Table, Td, formatLongDate } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { loadClassReport } from "@/lib/reports";
import { ReportGrid } from "../../report-grid";
import { PrintLandscape } from "../../print-landscape";

export const metadata: Metadata = { title: "Class report" };

const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function ClassReportPage({ params, searchParams }: PageProps<"/dashboard/reports/class/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, member } = await requireStaff();
  if (member.school.type === "tertiary") redirect("/dashboard/reports");
  const data = await loadClassReport(supabase, member, id, query.period);
  if (!data) notFound();
  const { klass, periods, period, threshold, report, subjects } = data;
  const exportHref = `/dashboard/reports/class/${klass.id}/export${period ? `?period=${period.id}` : ""}`;
  const below = report.students.filter((s) => isBelow(s.rate, threshold));

  return (
    <>
      <PrintLandscape />
      <PageHeader
        title={`${klass.name} attendance`}
        description={
          <>
            {period ? period.name : "All dates"}
            <span className="print:hidden">
              {" · "}
              <Link href={`/dashboard/reports${period ? `?period=${period.id}` : ""}`} className="text-accent hover:underline">
                All reports
              </Link>
            </span>
          </>
        }
        actions={report.days.length > 0 ? <ReportDownloads href={exportHref} /> : null}
      />
      <p className="mb-4 hidden text-sm print:block">{member.school.name}</p>
      <PeriodChips periods={periods} currentId={period?.id} href={(p) => `/dashboard/reports/class/${klass.id}?period=${p}`} />

      {report.days.length === 0 ? (
        <EmptyState>No registers have been taken for this class in {period?.name ?? "this term"} yet.</EmptyState>
      ) : (
        <div className="space-y-6">
          <Card
            title="Register"
            description={`${report.days.length} school days from ${formatLongDate(report.days[0] ?? "")} to ${formatLongDate(
              report.days[report.days.length - 1] ?? "",
            )}. P present, L late, A absent. When a class is marked every period, a day counts as present if the pupil was in any period.`}
          >
            <ReportGrid
              columns={report.days.map((day) => {
                const [weekday, date, month] = shortDay.format(new Date(`${day}T00:00:00Z`)).replace(",", "").split(" ");
                return {
                  key: day,
                  label: (
                    <span title={formatLongDate(day)} className="leading-tight">
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
                cells: report.days.map((day) => {
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
          </Card>

          <Card
            title="For report cards"
            description={`Copy each pupil's line onto their terminal report. The Excel download has these on their own sheet. Pupils below ${threshold}% are marked.`}
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
            <Card title="By subject" description="Lessons marked by subject teachers in this term, and how each pupil did.">
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
    </>
  );
}
