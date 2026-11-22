import { periodWord, periodWordTitle } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { PeriodChips } from "@/components/period-chips";
import { Badge, Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { choosePeriod, lowAttendancePercent } from "@/lib/periods";

export const metadata: Metadata = { title: "Reports" };

function rateTone(rate: number | null, threshold: number) {
  if (rate === null) return "neutral" as const;
  return rate < threshold ? ("danger" as const) : rate < threshold + 10 ? ("warning" as const) : ("success" as const);
}

export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/reports">) {
  const params = await searchParams;
  const { supabase, member } = await requireStaff();
  const { school } = member;
  const tertiary = school.type === "tertiary";
  const isAdmin = member.role === "admin";
  const word = periodWord(school.type);

  const [{ periods, period }, threshold] = await Promise.all([
    choosePeriod(supabase, school.id, params.period),
    lowAttendancePercent(supabase, school.id),
  ]);
  const { data: rows, error } = period
    ? await supabase.rpc("attendance_overview", { p_school_id: school.id, p_period_id: period.id })
    : { data: [], error: null };
  if (error) throw new Error(error.message);

  const list = rows ?? [];
  const totalBelow = list.reduce((sum, row) => sum + row.below, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          tertiary
            ? `Attendance for each course this ${word}. Open a course to see every session and download it.`
            : `Attendance for each class this ${word}, counted by school days. Open a class for the register and each pupil's "Attendance X out of Y" for their report card.`
        }
      />
      {!period ? (
        <EmptyState>
          Add a {word} first.{" "}
          {isAdmin ? (
            <Link href="/dashboard/calendar" className="text-accent hover:underline">
              Go to {periodWordTitle(school.type)}s
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <Card title={period.name}>
          <PeriodChips periods={periods} currentId={period.id} href={(id) => `/dashboard/reports?period=${id}`} />
          <p className="mb-4 text-sm text-muted">
            Present and late both count as attended. Students below {threshold}% are counted in the last column
            {isAdmin ? (
              <>
                {" "}
                (change this in{" "}
                <Link href="/dashboard/settings" className="text-accent hover:underline">
                  Settings
                </Link>
                )
              </>
            ) : null}
            .{totalBelow > 0 ? ` ${totalBelow} in all.` : ""}
          </p>
          {list.length === 0 ? (
            <EmptyState>
              {tertiary
                ? isAdmin
                  ? `No courses this ${word}.`
                  : `You do not lecture any courses this ${word}.`
                : isAdmin
                  ? "No classes yet."
                  : "You do not teach any classes."}
            </EmptyState>
          ) : (
            <Table
              headers={[tertiary ? "Course" : "Class", "Students", tertiary ? "Sessions" : "School days", "Attendance", `Below ${threshold}%`]}
              search={tertiary ? "Search courses" : "Search classes"}
            >
              {list.map((row) => (
                <tr key={row.id}>
                  <Td>
                    <Link
                      href={`/dashboard/reports/${row.kind}/${row.id}${tertiary ? "" : `?period=${period.id}`}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.detail ? <span className="block text-xs text-muted">{row.detail}</span> : null}
                  </Td>
                  <Td>{row.students}</Td>
                  <Td>{row.held}</Td>
                  <Td>
                    {row.rate === null ? (
                      <span className="text-muted">Nothing yet</span>
                    ) : (
                      <Badge tone={rateTone(row.rate, threshold)}>{row.rate}%</Badge>
                    )}
                  </Td>
                  <Td>{row.below > 0 ? <Badge tone="danger">{row.below}</Badge> : <span className="text-muted">0</span>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
