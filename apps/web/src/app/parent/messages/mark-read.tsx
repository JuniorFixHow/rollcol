"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markMessagesRead } from "../actions";

/** Seen: clears the unread count in the menu (one message, or all of them). */
export function MarkMessagesRead({ smsId = null, when }: { smsId?: number | null; when: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (when) void markMessagesRead(smsId).then(() => router.refresh());
  }, [when, smsId, router]);
  return null;
}
