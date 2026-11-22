import { isBelow } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportDownloads } from "@/components/report-downloads";
import { Badge, Card, EmptyState, PageHeader, formatDateTime, formatTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { loadCourseReport } from "@/lib/reports";
import { PrintLandscape } from "../../print-landscape";
import { ReportGrid } from "../../report-grid";

export const metadata: Metadata = { title: "Course report" };

const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Accra" });

export default async function CourseReportPage({ params }: PageProps<"/dashboard/reports/course/[id]">) {
  const { id } = await params;
  const { supabase, member } = await requireStaff();
  if (member.school.type !== "tertiary") redirect("/dashboard/reports");
  const data = await loadCourseReport(supabase, member, id);
  if (!data) notFound();
  const { run, code, title, threshold, report } = data;
  const below = report.students.filter((s) => isBelow(s.rate, threshold));

  return (
    <>
      <PrintLandscape />
      <PageHeader
        title={`${code} attendance`}
        description={
          <>
            {title}
            {run.period ? ` · ${run.period.name}` : null}
            <span className="print:hidden">
              {" · "}
              <Link href="/dashboard/reports" className="text-accent hover:underline">
                All reports
              </Link>
            </span>
          </>
        }
        actions={report.sessions.length > 0 ? <ReportDownloads href={`/dashboard/reports/course/${run.id}/export`} /> : null}
      />
      <p className="mb-4 hidden text-sm print:block">{member.school.name}</p>

      {report.sessions.length === 0 ? (
        <EmptyState>No sessions have been held for this course yet. Cancelled sessions are not counted.</EmptyState>
      ) : report.students.length === 0 ? (
        <EmptyState>No students have joined this course yet.</EmptyState>
      ) : (
        <div className="space-y-6">
          <Card
            title="Sessions"
            description={`${report.sessions.length} sessions held. P checked in, P* added by a lecturer, A absent. Open a session from its date to see times and reasons. Students below ${threshold}% are marked.`}
          >
            <ReportGrid
              columns={report.sessions.map((session) => ({
                key: session.id,
                label: (
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    title={formatDateTime(session.startsAt)}
                    className="leading-tight hover:text-accent hover:underline"
                  >
                    {shortDay.format(new Date(session.startsAt))}
                    <br />
                    {formatTime(session.startsAt)}
                  </Link>
                ),
              }))}
              totals={["Attended", "%", "Marks"]}
              rows={report.students.map((student) => ({
                key: student.id,
                name: (
                  <span>
                    {student.name}
                    {student.schoolNumber ? <span className="ml-2 font-mono text-xs text-muted">{student.schoolNumber}</span> : null}
                  </span>
                ),
                cells: report.sessions.map((session) => {
                  const method = student.sessions[session.id];
                  return { key: session.id, value: method === "manual" ? "P*" : method ? "P" : "A", tone: method ? "P" : "A" };
                }),
                totals: [
                  `${student.attended} of ${student.held}`,
                  student.rate === null ? (
                    ""
                  ) : (
                    <Badge key="rate" tone={isBelow(student.rate, threshold) ? "danger" : "neutral"}>
                      {student.rate}%
                    </Badge>
                  ),
                  student.rewardMarks,
                ],
              }))}
            />
            {below.length > 0 ? (
              <p className="mt-3 text-sm text-muted">
                {below.length} {below.length === 1 ? "student is" : "students are"} below {threshold}%.
              </p>
            ) : null}
          </Card>
        </div>
      )}
    </>
  );
}
