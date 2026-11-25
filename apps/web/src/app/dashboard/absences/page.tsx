import { ABSENCE_REASONS, isAbsenceReason } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, EmptyState, PageHeader, Table, Td, formatDateTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { ghanaToday } from "@/lib/parent";

export const metadata: Metadata = { title: "Absence reports" };

function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

/** Parents telling the school ahead that a child will be absent. */
export default async function AbsenceReportsPage() {
  const { supabase, member } = await requireStaff();
  if (member.school.type === "tertiary") redirect("/dashboard");
  const { data: reports } = await supabase.rpc("school_absence_reports", { p_school_id: member.school.id });
  const today = ghanaToday();

  return (
    <>
      <PageHeader
        title="Absence reports"
        description="Parents can tell you in RollCol that their child will be absent. The register shows it next to the child, and no absence alert is sent for those days. Reports from the past week are kept here."
      />
      {(reports ?? []).length === 0 ? (
        <EmptyState>No absence reports.</EmptyState>
      ) : (
        <Table headers={["Child", "Days", "Reason", "Reported"]} search="Search by child or class">
          {(reports ?? []).map((r) => (
            <tr key={r.id} className={r.status === "cancelled" ? "opacity-60" : ""}>
              <Td>
                <Link href={`/dashboard/students/${r.student_id}`} className="block font-medium hover:text-accent">
                  {r.student_name}
                </Link>
                {r.class_name ? <span className="block text-xs text-muted">{r.class_name}</span> : null}
              </Td>
              <Td className="text-sm">
                {r.from_date === r.to_date ? shortDay(r.from_date) : `${shortDay(r.from_date)} to ${shortDay(r.to_date)}`}
                {r.status === "cancelled" ? (
                  <span className="mt-1 block">
                    <Badge>Cancelled</Badge>
                  </span>
                ) : r.from_date <= today && r.to_date >= today ? (
                  <span className="mt-1 block">
                    <Badge tone="warning">Today</Badge>
                  </span>
                ) : null}
              </Td>
              <Td className="text-sm">
                {isAbsenceReason(r.reason) ? ABSENCE_REASONS[r.reason] : r.reason}
                {r.note ? <span className="block text-muted">{r.note}</span> : null}
              </Td>
              <Td className="text-sm">{formatDateTime(r.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
