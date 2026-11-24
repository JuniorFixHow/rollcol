import { SMS_DELIVERY_LABELS, SMS_KIND_LABELS, SMS_STATUS_LABELS, formatPhoneForDisplay } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, formatDateTime } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { DELIVERY_TONE, STATUS_TONE } from "../labels";

export const metadata: Metadata = { title: "Message" };

/** One message in full, with who it went to and how. */
export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, member } = await requireStaff();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const { data: sms } = await supabase
    .from("sms_outbox")
    .select(
      "id, kind, status, delivery, to_phone, body, segments, credits, provider_id, error, created_at, sent_at, send_after, message_id, guardian:guardians(full_name)",
    )
    .eq("id", id)
    .eq("school_id", member.school.id)
    .maybeSingle();
  if (!sms) notFound();

  const { data: batch } = sms.message_id
    ? await supabase.from("sms_messages").select("audience, recipients").eq("id", sms.message_id).maybeSingle()
    : { data: null };

  const when = sms.sent_at ?? (sms.status === "queued" ? sms.send_after : sms.created_at);

  return (
    <>
      <PageHeader
        title={SMS_KIND_LABELS[sms.kind]}
        description={
          <Link href="/dashboard/messages" className="text-accent hover:underline">
            All messages
          </Link>
        }
      />
      <div className="space-y-6">
        <Card>
          <p className="text-[15px] leading-7 whitespace-pre-wrap">{sms.body}</p>
        </Card>
        <Card title="Details">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">To</dt>
            <dd>
              {sms.guardian?.full_name ?? "Guardian"} <span className="font-mono text-muted">{formatPhoneForDisplay(sms.to_phone)}</span>
            </dd>
            {batch ? (
              <>
                <dt className="text-muted">Sent to</dt>
                <dd>
                  {batch.audience} ({batch.recipients} {batch.recipients === 1 ? "guardian" : "guardians"})
                </dd>
              </>
            ) : null}
            <dt className="text-muted">Status</dt>
            <dd className="flex flex-wrap gap-2">
              {sms.status === "sent" && sms.delivery ? (
                <Badge tone={DELIVERY_TONE[sms.delivery]}>{SMS_DELIVERY_LABELS[sms.delivery]}</Badge>
              ) : (
                <Badge tone={STATUS_TONE[sms.status]}>{SMS_STATUS_LABELS[sms.status]}</Badge>
              )}
              {sms.status === "sent" && sms.provider_id === "test" ? <Badge>Test only</Badge> : null}
            </dd>
            <dt className="text-muted">{sms.sent_at ? "Sent" : sms.status === "queued" ? "Sends from" : "Created"}</dt>
            <dd>{formatDateTime(when)}</dd>
            <dt className="text-muted">Length</dt>
            <dd>
              {sms.status === "in_app"
                ? "Delivered in the RollCol app, no credits"
                : `${sms.segments} SMS${sms.credits > 0 ? `, ${sms.credits} ${sms.credits === 1 ? "credit" : "credits"}` : sms.kind === "system" ? ", free" : ""}`}
            </dd>
            {sms.error && sms.status !== "sent" ? (
              <>
                <dt className="text-muted">Problem</dt>
                <dd className="text-danger">{sms.error}</dd>
              </>
            ) : null}
          </dl>
        </Card>
      </div>
    </>
  );
}
