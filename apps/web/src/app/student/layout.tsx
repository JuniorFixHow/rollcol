import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { Brand } from "@/components/brand";
import { PageSkeleton } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { StudentNav } from "./nav";

export const metadata: Metadata = { title: { template: "%s · RollCol", default: "Your courses · RollCol" } };

async function Header() {
  const { supabase, student } = await requireStudent();
  const { count } = await supabase
    .from("push_outbox")
    .select("id", { count: "exact", head: true })
    .is("data->smsId", null)
    .is("read_at", null);
  return <StudentNav unread={count ?? 0} school={student.school.name} />;
}

/** The student part of the website: the app's student screens, without check-in. */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Brand />
          <Suspense fallback={<div className="h-9" />}>
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
