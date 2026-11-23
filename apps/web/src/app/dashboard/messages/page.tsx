import {
  DatabaseConstants,
  type Enums,
  SMS_DELIVERY_LABELS,
  SMS_KIND_LABELS,
  SMS_STATUS_LABELS,
  formatPhoneForDisplay,
  quietHoursText,
} from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td, formatDateTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { sendBroadcast } from "./actions";
import { type ClassAudience, MessageComposer } from "./message-composer";

export const metadata: Metadata = { title: "Messages" };

type Kind = Enums<"sms_kind">;
type Status = Enums<"sms_status">;
type Delivery = Enums<"sms_delivery">;

const DELIVERY_TONE: Record<Delivery, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  delivered: "success",
  failed: "danger",
  expired: "danger",
  rejected: "danger",
};

const STATUS_TONE: Record<Status, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  queued: "neutral",
  sending: "accent",
  sent: "success",
  failed: "danger",
  no_credit: "warning",
  cancelled: "neutral",
};

function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (DatabaseConstants.public.Enums.sms_kind as readonly string[]).includes(value);
}

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const { supabase, member } = await requireStaff();
  const { school } = member;
  if (school.type === "tertiary" || school.isWorkspace) notFound();
  const isAdmin = member.role === "admin";
  const verified = school.status === "verified";
  const kindParam = (await searchParams).kind;
  const kind = isKind(kindParam) ? kindParam : null;

  let outboxQuery = supabase
    .from("sms_outbox")
    .select("id, kind, status, delivery, to_phone, body, segments, credits, provider_id, error, created_at, sent_at, send_after, guardian:guardians(full_name)")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (kind) outboxQuery = outboxQuery.eq("kind", kind);

  const [{ data: outbox }, { data: settings }, balance, audiences] = await Promise.all([
    outboxQuery,
    supabase.from("school_settings").select("sms_name, sms_quiet_hours, sms_quiet_start, sms_quiet_end").eq("school_id", school.id).single(),
    isAdmin ? supabase.rpc("sms_credit_balance", { p_school_id: school.id }).then((r) => r.data ?? 0) : Promise.resolve(null),
    isAdmin && verified ? loadAudiences(supabase, school.id) : Promise.resolve({ classes: [], all: 0 }),
  ]);
  const smsName = settings?.sms_name ?? school.name;
  const quietNote = settings
    ? quietHoursText({ on: settings.sms_quiet_hours, start: settings.sms_quiet_start, end: settings.sms_quiet_end })
    : null;
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Messages"
        description={
          isAdmin
            ? "Every SMS RollCol sends for your school: attendance alerts, guardian notices, broadcasts and messages from teachers."
            : "Messages you have sent to guardians. To message a student's guardians, open the student."
        }
      />

      <div className="space-y-6">
        {!verified ? (
          <Notice tone="warning" title="SMS starts after verification">
            RollCol calls your school to confirm it before any SMS goes out. Until then, registers work as normal but no
            guardian is texted.
          </Notice>
        ) : null}

        {isAdmin ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-muted">SMS credits</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{balance}</p>
              <p className="mt-1 text-xs text-muted">One credit sends one SMS of up to 160 characters.</p>
            </Card>
            <Card className="sm:col-span-2">
              <p className="text-sm font-medium">What uses credits</p>
              <p className="mt-1 text-sm text-muted">
                Attendance alerts, broadcasts and messages to guardians. Notices that tell a guardian they were added or
                removed, their number changed, or alerts were turned off or on are free. Change what is sent in{" "}
                <Link href="/dashboard/settings" className="text-accent hover:underline">
                  Settings
                </Link>
                .
              </p>
            </Card>
          </div>
        ) : null}

        {isAdmin && verified ? (
          <Card title="Send a broadcast" description="For example, a PTA meeting or a closing time. Guardians who asked not to get broadcasts are left out.">
            {audiences.all === 0 ? (
              <EmptyState>No guardians get broadcasts yet. Add guardians on the students&rsquo; pages.</EmptyState>
            ) : (
              <MessageComposer
                action={sendBroadcast}
                schoolName={smsName}
                balance={balance}
                classes={audiences.classes}
                allGuardians={audiences.all}
                placeholder="PTA meeting on Saturday at 9am in the school hall."
                sendLabel="Send broadcast"
                quietNote={quietNote}
              />
            )}
          </Card>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Sent and waiting</h2>
            <nav aria-label="Filter messages" className="flex flex-wrap gap-1 text-sm">
              <FilterLink href="/dashboard/messages" active={kind === null}>
                All
              </FilterLink>
              {DatabaseConstants.public.Enums.sms_kind.map((k) => (
                <FilterLink key={k} href={`/dashboard/messages?kind=${k}`} active={kind === k}>
                  {SMS_KIND_LABELS[k]}
                </FilterLink>
              ))}
            </nav>
          </div>

          {(outbox ?? []).length === 0 ? (
            <EmptyState>No messages yet. Alerts appear here 15 minutes after a register is submitted or closes.</EmptyState>
          ) : (
            <Table search="Search by guardian, phone or message" headers={["To", "Message", "Status", "When"]}>
              {(outbox ?? []).map((sms) => (
                <tr key={sms.id}>
                  <Td className="text-sm">
                    <span className="block font-medium">{sms.guardian?.full_name ?? "Guardian"}</span>
                    <span className="block font-mono text-xs text-muted">{formatPhoneForDisplay(sms.to_phone)}</span>
                  </Td>
                  <Td className="max-w-md text-sm">
                    <span className="block text-xs text-muted">
                      {SMS_KIND_LABELS[sms.kind]} · {sms.segments} SMS
                      {sms.credits > 0 ? ` · ${sms.credits} ${sms.credits === 1 ? "credit" : "credits"}` : sms.kind === "system" ? " · free" : ""}
                    </span>
                    <span className="block whitespace-pre-wrap">{sms.body}</span>
                    {sms.error && sms.status !== "sent" ? <span className="block text-xs text-danger">{sms.error}</span> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      {sms.status === "sent" && sms.delivery ? (
                        <Badge tone={DELIVERY_TONE[sms.delivery]}>{SMS_DELIVERY_LABELS[sms.delivery]}</Badge>
                      ) : (
                        <Badge tone={STATUS_TONE[sms.status]}>{SMS_STATUS_LABELS[sms.status]}</Badge>
                      )}
                      {sms.status === "sent" && sms.provider_id === "test" ? <Badge>Test only</Badge> : null}
                    </div>
                  </Td>
                  <Td className="text-sm whitespace-nowrap text-muted">
                    {sms.sent_at
                      ? formatDateTime(sms.sent_at)
                      : sms.status === "queued" && new Date(sms.send_after) > now
                        ? `From ${formatDateTime(sms.send_after)}`
                        : formatDateTime(sms.created_at)}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          {isAdmin ? (
            <p className="text-xs text-muted">
              &ldquo;Test only&rdquo; means RollCol is in test mode: the message was recorded but not sent to the phone.
              &ldquo;No credits&rdquo; messages were not sent; add credits and they are not resent. &ldquo;Not delivered&rdquo;
              usually means the number is wrong or the phone was off for days: check the guardian&rsquo;s number.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2.5 py-1 ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}
    >
      {children}
    </Link>
  );
}

type Client = Awaited<ReturnType<typeof requireStaff>>["supabase"];

/** Classes with the guardians in each who accept broadcasts, for the broadcast picker. */
async function loadAudiences(supabase: Client, schoolId: string): Promise<{ classes: ClassAudience[]; all: number }> {
  const [{ data: classes }, { data: links }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("school_id", schoolId).is("archived_at", null).order("name"),
    supabase
      .from("guardian_links")
      .select("guardian_id, guardian:guardians!inner(broadcasts_enabled), student:students!inner(class_id, status)")
      .eq("school_id", schoolId)
      .eq("guardian.broadcasts_enabled", true)
      .eq("student.status", "active"),
  ]);

  const byClass = new Map<string, Set<string>>();
  const all = new Set<string>();
  for (const link of links ?? []) {
    all.add(link.guardian_id);
    const classId = link.student?.class_id;
    if (!classId) continue;
    const set = byClass.get(classId) ?? new Set<string>();
    set.add(link.guardian_id);
    byClass.set(classId, set);
  }
  const audiences = (classes ?? [])
    .map((c) => ({ id: c.id, name: c.name, guardianIds: [...(byClass.get(c.id) ?? [])] }))
    .filter((c) => c.guardianIds.length > 0);
  return { classes: audiences, all: all.size };
}
