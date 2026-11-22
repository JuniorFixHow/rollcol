import { isBelow } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportDownloads } from "@/components/report-downloads";
import { ReportViewBar } from "@/components/report-view-bar";
import { Badge, Card, EmptyState, PageHeader, formatDateTime, formatTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { viewQuery } from "@/lib/report-view";
import { loadCourseReport } from "@/lib/reports";
import { PrintLandscape } from "../../print-landscape";
import { PrintReport } from "../../print-report";
import { ReportGrid } from "../../report-grid";

export const metadata: Metadata = { title: "Course report" };

const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Accra" });

function sessionMark(method: string | null | undefined) {
  return method === "manual" ? "P*" : method ? "P" : "A";
}

export default async function CourseReportPage({ params, searchParams }: PageProps<"/dashboard/reports/course/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, member } = await requireStaff();
  if (member.school.type !== "tertiary") redirect("/dashboard/reports");
  const data = await loadCourseReport(supabase, member, id, query);
  if (!data) notFound();
  const { run, code, title, view, threshold, report, heading } = data;
  const path = `/dashboard/reports/course/${run.id}`;
  const below = report.students.filter((s) => isBelow(s.rate, threshold));
  const empty =
    view.mode === "week"
      ? "No sessions were held for this course this week. Use the arrows to see other weeks."
      : view.mode === "range"
        ? "No sessions were held for this course between these dates."
        : "No sessions have been held for this course yet. Cancelled sessions are not counted.";

  return (
    <>
      <PrintLandscape />
      <div className="print:hidden">
        <PageHeader
          title={`${code} attendance`}
          description={
            <>
              {title}
              {run.period ? ` · ${run.period.name}` : null}
              {" · "}
              <Link href="/dashboard/reports" className="text-accent hover:underline">
                All reports
              </Link>
            </>
          }
          actions={report.sessions.length > 0 ? <ReportDownloads href={`${path}/export?${viewQuery(view)}`} /> : null}
        />
        <ReportViewBar path={path} view={view} allLabel={run.period ? `Whole semester: ${run.period.name}` : "Whole semester"} />

        {report.sessions.length === 0 ? (
          <EmptyState>{empty}</EmptyState>
        ) : report.students.length === 0 ? (
          <EmptyState>No students have joined this course yet.</EmptyState>
        ) : (
          <Card
            title="Sessions"
            description={`${report.sessions.length} ${report.sessions.length === 1 ? "session" : "sessions"} held. P checked in, P* added by a lecturer, A absent. Open a session from its date to see times and reasons. Students below ${threshold}% are marked.`}
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
                    {shortDay.format(new Date(session.startsAt)).replace(",", "")}
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
                  return { key: session.id, value: sessionMark(method), tone: method ? "P" : "A" };
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
        )}
      </div>

      {report.sessions.length > 0 && report.students.length > 0 ? (
        <PrintReport
          school={heading.school}
          title={heading.title}
          period={heading.period}
          tables={[
            {
              headers: [
                "Name",
                "School ID",
                ...report.sessions.map((s) => `${shortDay.format(new Date(s.startsAt)).replace(",", "")} ${formatTime(s.startsAt)}`),
                "Attended",
                "%",
                "Marks",
              ],
              centreFrom: 2,
              rows: report.students.map((s) => ({
                key: s.id,
                flag: isBelow(s.rate, threshold),
                cells: [
                  s.name,
                  s.schoolNumber ?? "",
                  ...report.sessions.map((session) => sessionMark(s.sessions[session.id])),
                  `${s.attended} of ${s.held}`,
                  s.rate === null ? "" : `${s.rate}%${isBelow(s.rate, threshold) ? " (low)" : ""}`,
                  String(s.rewardMarks),
                ],
              })),
            },
          ]}
          notes={[`P checked in, P* added by a lecturer, A absent. Cancelled sessions are not counted. "(low)" means below ${threshold}%.`]}
        />
      ) : null}
    </>
  );
}
