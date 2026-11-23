"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState, Notice, formatDateTime } from "@/components/ui";
import { markAllRead, removeNotifications } from "./actions";

export interface WebNotification {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
  /** Where the notification leads, if anywhere. */
  href: string | null;
}

export function NotificationList({ items: initial, failed }: { items: WebNotification[]; failed: boolean }) {
  const router = useRouter();
  // Removed here before the server confirms; null means all of them.
  const [removed, setRemoved] = useState<number[] | null>([]);
  const items = removed === null ? [] : initial.filter((item) => !removed.includes(item.id));
  const [error, setError] = useState<string | null>(null);
  const [confirm, dialog] = useConfirm();
  const hasUnread = initial.some((item) => item.unread);

  useEffect(() => {
    // Seen: clear the unread count in the menu.
    if (hasUnread) void markAllRead().then(() => router.refresh());
  }, [hasUnread, router]);

  async function remove(ids: number[] | null) {
    setError(null);
    const before = removed;
    setRemoved((current) => (ids === null || current === null ? null : [...current, ...ids]));
    const result = await removeNotifications(ids);
    if (result.error) {
      setRemoved(before);
      setError(result.error);
    }
  }

  if (failed) return <Notice tone="warning">RollCol could not load your notifications. Refresh the page to try again.</Notice>;

  return (
    <div className="space-y-3">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {items.length === 0 ? (
        <EmptyState>
          No notifications. You are told here, for example, when someone asks to move a workspace into your school, and
          whether your own request was approved.
        </EmptyState>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm font-medium text-accent hover:underline"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Clear all notifications?",
                    message: "They are removed here and in the app.",
                    confirmLabel: "Clear all",
                    tone: "danger",
                  })
                ) {
                  await remove(null);
                }
              }}
            >
              Clear all
            </button>
          </div>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${item.unread ? "bg-accent" : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {item.title}
                    {item.unread ? <span className="sr-only"> (new)</span> : null}
                  </p>
                  <p className="text-sm text-foreground/80">{item.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDateTime(item.createdAt)}
                    {item.href ? (
                      <>
                        {" · "}
                        <Link href={item.href} className="text-accent hover:underline">
                          Open
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove([item.id])}
                  className="shrink-0 rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
                  aria-label={`Remove: ${item.title}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {dialog}
    </div>
  );
}
