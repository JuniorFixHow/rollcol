import type { Metadata } from "next";
import { NotificationList, type WebNotification } from "@/app/dashboard/notifications/notification-list";
import { PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifications" };

/** Notices about the parent's account and links (school messages are in Messages). */
export default async function ParentNotificationsPage() {
  const { supabase } = await requireParent();
  const { data, error } = await supabase
    .from("push_outbox")
    .select("id, title, body, created_at, read_at")
    .is("data->smsId", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const items: WebNotification[] = (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    unread: n.read_at === null,
    href: null,
  }));

  return (
    <>
      <PageHeader title="Notifications" description="Notices about your account and your links to schools. The same list appears in the app." />
      <NotificationList
        items={items}
        failed={Boolean(error)}
        emptyText="No notifications. You are told here, for example, when a school confirms your link or changes how it sends you alerts."
      />
    </>
  );
}
