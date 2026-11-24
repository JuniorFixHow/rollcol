import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineAction } from "@/components/form";
import { Badge, Card, PageHeader, formatDateTime } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { MESSAGE_KIND_LABEL } from "@/lib/parent";
import { deleteMessages } from "../../actions";
import { MarkMessagesRead } from "../mark-read";

export const metadata: Metadata = { title: "Message" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireParent();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const { data } = await supabase.rpc("parent_messages", { p_id: id, p_limit: 1 });
  const message = data?.[0];
  if (!message) notFound();

  return (
    <>
      <PageHeader
        title={message.school_name}
        description={
          <Link href="/parent/messages" className="text-accent hover:underline">
            All messages
          </Link>
        }
        actions={
          <InlineAction
            action={deleteMessages}
            hidden={{ messageId: String(message.id) }}
            label="Delete"
            variant="secondary"
            confirm="Delete this message? It is removed from your Messages. The school keeps its own record."
          />
        }
      />
      <MarkMessagesRead smsId={message.id} when={message.unread} />
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          <Badge tone={message.kind === "attendance" ? "accent" : "neutral"}>{MESSAGE_KIND_LABEL[message.kind] ?? "Message"}</Badge>
          {formatDateTime(message.sent_at)}
        </div>
        <p className="text-[15px] leading-7 whitespace-pre-wrap">{message.body}</p>
      </Card>
    </>
  );
}
