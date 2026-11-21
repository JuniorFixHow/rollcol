import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { OpenInApp } from "./open-in-app";

export const metadata: Metadata = { title: "Check in", robots: { index: false } };

/**
 * Where a check-in code leads when it is scanned with a phone's camera or any
 * QR app. It hands over to the RollCol app, which does the check-in.
 */
export default function CheckinLinkPage({ params, searchParams }: PageProps<"/checkin/[id]">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12">
      <Brand href="/" />
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 text-center">
        {/* The code is only known when the link is opened, so it is read inside Suspense. */}
        <Suspense fallback={<p className="text-sm text-muted">Opening RollCol...</p>}>
          <CheckinLink params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function CheckinLink({ params, searchParams }: Pick<PageProps<"/checkin/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === "string" && /^[0-9a-f]{12}$/i.test(t) ? t.toLowerCase() : null;
  const sessionId = /^[0-9a-f-]{36}$/i.test(id) ? id.toLowerCase() : null;

  if (!sessionId || !token) {
    return (
      <>
        <h1 className="text-lg font-semibold">This code is not complete</h1>
        <p className="text-sm text-muted">Scan the code on your lecturer&rsquo;s screen again.</p>
      </>
    );
  }
  return <OpenInApp sessionId={sessionId} token={token} />;
}
