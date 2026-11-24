import { attendanceRate, type Database } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { markLabel } from "@/lib/parent";

export const metadata: Metadata = { title: "Your children" };

type Child = Database["public"]["Functions"]["parent_children"]["Returns"][number];
function ChildCard({ child }: { child: Child }) {
  if (!child.student_id || !child.full_name) {
    return (
      <Card title={child.school_name}>
        <p className="text-sm text-muted">Waiting for the school to confirm your link. You are told here as soon as it does.</p>
      </Card>
    );
  }
  const today = markLabel(child.today_mark, child.today_held);
  const rate = attendanceRate(child.attended, child.held);
  return (
    <Link
      href={`/parent/child/${child.student_id}`}
      className="block rounded-lg border border-line bg-surface p-5 shadow-sm transition hover:border-accent"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{child.full_name}</h2>
          <p className="text-sm text-muted">
            {child.class_name ? `${child.class_name} · ` : ""}
            {child.school_name}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-muted">Today</p>
          <Badge tone={today.tone}>{today.label}</Badge>
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        {child.held > 0 ? (
          <>
            <p className="font-semibold">
              Attendance {child.attended} out of {child.held}
              {rate === null ? "" : ` (${rate}%)`}
            </p>
            <p className="text-sm text-muted">
              {child.period_name ?? "So far"}
              {child.absent > 0 ? ` · ${child.absent} absent` : ""}
              {child.late > 0 ? ` · ${child.late} late` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">No registers yet{child.period_name ? ` in ${child.period_name}` : ""}.</p>
        )}
      </div>
    </Link>
  );
}

export default async function ChildrenPage() {
  const { supabase } = await requireParent();
  const [statusResult, childrenResult] = await Promise.all([supabase.rpc("parent_status"), supabase.rpc("parent_children")]);
  if (statusResult.error || childrenResult.error) {
    return <Notice tone="warning">RollCol could not load your children. Refresh the page to try again.</Notice>;
  }
  const status = statusResult.data[0] ?? { active: 0, pending: 0, unlinked: 0 };
  const children = childrenResult.data;
  const nothingLinked = status.active === 0 && status.pending === 0;

  return (
    <>
      <PageHeader title="Your children" description="Today's attendance and this term so far. Choose a child to see each week." />
      <div className="space-y-6">
        {nothingLinked && status.unlinked > 0 ? (
          <Card title="Welcome to RollCol">
            <p className="text-sm">
              Your number is on your child&apos;s school records. To see their attendance, type one of your child&apos;s names.
            </p>
            <LinkButton href="/parent/link" className="mt-4">
              Add your child
            </LinkButton>
          </Card>
        ) : null}
        {nothingLinked && status.unlinked === 0 ? (
          <EmptyState>
            No school in RollCol has your child with this number. Ask the school to add this number to your child&apos;s
            record, then refresh this page.
          </EmptyState>
        ) : null}
        {children.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {children.map((child) => (
              <ChildCard key={child.student_id ?? `pending-${child.school_id}`} child={child} />
            ))}
          </div>
        ) : null}
        {!nothingLinked && status.unlinked > 0 ? (
          <Notice title="Another school has your number">
            Add your child there with one of their names.{" "}
            <Link href="/parent/link" className="font-medium text-accent hover:underline">
              Add a child
            </Link>
          </Notice>
        ) : null}
      </div>
    </>
  );
}
