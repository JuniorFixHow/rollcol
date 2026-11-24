import "server-only";
import { cache } from "react";
import { getSession } from "@/lib/auth";

/** Unread notifications for the signed-in person, looked up once per request. */
export const getUnreadCount = cache(async (): Promise<number> => {
  const session = await getSession();
  if (!session) return 0;
  const { count } = await session.supabase
    .from("push_outbox")
    .select("id", { count: "exact", head: true })
    .is("data->smsId", null) // school messages are listed in Messages
    .is("read_at", null);
  return count ?? 0;
});
