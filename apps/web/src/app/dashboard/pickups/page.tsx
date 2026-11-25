import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, PageHeader, Table, Td, formatDateTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { CodeCheck } from "./code-check";

export const metadata: Metadata = { title: "Pickups" };

const STATUS: Record<string, { label: string; tone: "accent" | "success" | "neutral" }> = {
  active: { label: "Waiting", tone: "accent" },
  used: { label: "Released", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Checking a collector's pickup code, and today's pickups. */
export default async function PickupsPage() {
  const { supabase, member } = await requireStaff();
  if (member.school.type === "tertiary") redirect("/dashboard");
  const { data: pickups } = await supabase.rpc("school_pickups", { p_school_id: member.school.id });

  return (
    <>
      <PageHeader
        title="Pickups"
        description="When someone other than a parent collects a child, the parent makes a code in RollCol and gives it to them. Type the code to see the child and who may take them."
      />
      <div className="space-y-6">
        <Card title="Check a code">
          <CodeCheck />
        </Card>
        <Card title="Today" description="Codes parents made for today. The codes themselves are only shown to the parent.">
          {(pickups ?? []).length === 0 ? (
            <EmptyState>No pickup codes for today.</EmptyState>
          ) : (
            <Table headers={["Child", "Collected by", "Status"]}>
              {(pickups ?? []).map((p) => (
                <tr key={p.id}>
                  <Td>
                    <span className="block font-medium">{p.student_name}</span>
                    {p.class_name ? <span className="block text-xs text-muted">{p.class_name}</span> : null}
                  </Td>
                  <Td>{p.collector_name}</Td>
                  <Td>
                    <Badge tone={(STATUS[p.status] ?? STATUS.cancelled)?.tone}>{(STATUS[p.status] ?? STATUS.cancelled)?.label}</Badge>
                    {p.used_at ? (
                      <span className="block text-xs text-muted">
                        {formatDateTime(p.used_at)}
                        {p.released_by_name ? ` by ${p.released_by_name}` : ""}
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
