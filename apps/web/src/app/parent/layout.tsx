import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { Brand } from "@/components/brand";
import { PageSkeleton } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { ParentNav } from "./nav";

export const metadata: Metadata = { title: { template: "%s · RollCol", default: "Your children · RollCol" } };

/** Unread counts for the menu: notifications and school messages apart. */
async function Header() {
  const { supabase } = await requireParent();
  const [notifications, messages] = await Promise.all([
    supabase.from("push_outbox").select("id", { count: "exact", head: true }).is("data->smsId", null).is("read_at", null),
    supabase.from("push_outbox").select("id", { count: "exact", head: true }).not("data->smsId", "is", null).is("read_at", null),
  ]);
  return <ParentNav unreadNotifications={notifications.count ?? 0} unreadMessages={messages.count ?? 0} />;
}

/** The parent part of the website: the same as the parent screens in the app. */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Brand />
          <Suspense fallback={<div className="h-9 w-28" />}>
            <Header />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>
    </div>
  );
}
