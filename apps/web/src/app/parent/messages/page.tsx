import type { Metadata } from "next";
import Link from "next/link";
import { InlineAction } from "@/components/form";
import { Badge, EmptyState, Notice, PageHeader, formatDateTime } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { MESSAGE_KIND_LABEL } from "@/lib/parent";
import { deleteMessages } from "../actions";
import { MarkMessagesRead } from "./mark-read";

export const metadata: Metadata = { title: "Messages" };

/** The school's messages and attendance alerts sent to this number, newest first. */
export default async function MessagesPage() {
  const { supabase } = await requireParent();
  const { data, error } = await supabase.rpc("parent_messages", { p_limit: 100 });
  const messages = data ?? [];

  return (
    <>
      <PageHeader
        title="Messages"
        description="Attendance alerts, announcements and messages from your children's schools."
        actions={
          messages.length > 0 ? (
            <InlineAction
              action={deleteMessages}
              hidden={{ all: "true" }}
              label="Delete all"
              variant="secondary"
              confirm="Delete all messages? They are removed from your Messages. The school keeps its own record."
            />
          ) : null
        }
      />
      <MarkMessagesRead when={messages.some((m) => m.unread)} />
      {error ? <Notice tone="warning">RollCol could not load your messages. Refresh the page to try again.</Notice> : null}
      {!error && messages.length === 0 ? (
        <EmptyState>
          No messages yet. The SMS your child&apos;s school sends you (alerts, announcements and messages) also appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {messages.map((m) => (
            <li key={m.id}>
              <Link href={`/parent/messages/${m.id}`} className="flex gap-3 px-4 py-3 hover:bg-surface-muted">
                <span aria-hidden className={`mt-2 size-2 shrink-0 rounded-full ${m.unread ? "bg-accent" : "bg-transparent"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">
                      {m.school_name}
                      {m.unread ? <span className="sr-only"> (new)</span> : null}
                    </span>
                    <Badge tone={m.kind === "attendance" ? "accent" : "neutral"}>{MESSAGE_KIND_LABEL[m.kind] ?? "Message"}</Badge>
                  </span>
                  <span className="mt-1 line-clamp-2 text-sm break-words text-foreground/80">{m.body}</span>
                  <span className="mt-1 block text-xs text-muted">{formatDateTime(m.sent_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
