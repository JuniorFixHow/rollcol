"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";

const KINDS = ["moves"] as const;
export type StaffNotificationKind = (typeof KINDS)[number];

function isKind(value: unknown): value is StaffNotificationKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

/** Seen on the website: clears the unread count (they stay listed until removed). */
export async function markAllRead(): Promise<void> {
  const { supabase } = await requireStaff();
  await supabase.rpc("mark_notifications_read", { p_ids: null });
  revalidatePath("/dashboard", "layout");
}

/** Removes one notification, or all of them when ids is null. */
export async function removeNotifications(ids: number[] | null): Promise<{ error: string | null }> {
  const { supabase } = await requireStaff();
  if (ids !== null && !ids.every((id) => Number.isInteger(id) && id > 0)) return { error: "Choose a notification." };
  const { error } = await supabase.rpc("dismiss_notifications", { p_ids: ids });
  revalidatePath("/dashboard", "layout");
  return { error: error ? "RollCol could not remove this. Please try again." : null };
}

/** Turns one kind of phone notification on or off for this person. */
export async function setNotificationSetting(kind: string, enabled: boolean): Promise<{ error: string | null }> {
  const { supabase } = await requireStaff();
  if (!isKind(kind)) return { error: "Choose a kind of notification." };
  const { error } = await supabase.rpc("set_notification_setting", { p_kind: kind, p_enabled: enabled });
  return { error: error ? "RollCol could not save this. Please try again." : null };
}
