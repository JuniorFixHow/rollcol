import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { NotificationList, type WebNotification } from "./notification-list";
import { NotificationSettings } from "./notification-settings";

export const metadata: Metadata = { title: "Notifications" };

function moveIdOf(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const value = (data as Record<string, unknown>).moveId;
  return typeof value === "string" ? value : null;
}

/**
 * The same notifications the app shows, for staff on the website, with the
 * settings for which of them also reach their phone.
 */
export default async function NotificationsPage() {
  const { supabase } = await requireStaff();
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase
      .from("push_outbox")
      .select("id, title, body, data, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("notification_settings").select("kind, enabled"),
  ]);

  const items: WebNotification[] = (data ?? []).map((n) => {
    const moveId = moveIdOf(n.data);
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.created_at,
      unread: n.read_at === null,
      href: moveId ? `/dashboard/moves/${moveId}` : null,
    };
  });
  const moves = (settings ?? []).find((s) => s.kind === "moves")?.enabled ?? true;

  return (
    <>
      <PageHeader title="Notifications" description="What RollCol has told you. The same list appears in the app." />
      <div className="space-y-6">
        <Card>
          <NotificationList items={items} failed={Boolean(error)} />
        </Card>
        <Card
          title="Notification settings"
          description="Choose what is also sent to your phone when you are signed in to the RollCol app there. Everything still appears in this list, and the same settings are in the app."
        >
          <NotificationSettings initial={{ moves }} />
        </Card>
      </div>
    </>
  );
}
