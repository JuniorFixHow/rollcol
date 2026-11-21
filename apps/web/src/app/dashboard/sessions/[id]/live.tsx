"use client";

import { sessionQrPayload } from "@rollcol/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { renderSVG } from "uqr";
import { buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { currentQr } from "../actions";

/** Reloads the page data when someone checks in, and when the session opens or closes. */
export function LiveRefresh({ sessionId, changesAt }: { sessionId: string; changesAt: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Many check-ins arrive together at the start of class; refresh at most once a second.
    const refreshSoon = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        router.refresh();
      }, 1000);
    };
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_checkins", filter: `session_id=eq.${sessionId}` },
        refreshSoon,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, router]);

  useEffect(() => {
    const timers = changesAt
      .map((value) => new Date(value).getTime() - Date.now() + 500)
      .filter((delay) => delay > 0 && delay < 2 ** 31 - 1)
      .map((delay) => setTimeout(() => router.refresh(), delay));
    return () => timers.forEach(clearTimeout);
  }, [changesAt, router]);

  return null;
}

function subscribeClock(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

/** "12:34 left", updated every second. */
export function Countdown({ endsAt }: { endsAt: string }) {
  const now = useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 1000),
    () => 0,
  );
  if (now === 0) return null;
  const left = Math.max(0, Math.floor(new Date(endsAt).getTime() / 1000) - now);
  const hours = Math.floor(left / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;
  const text = `${hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}` : minutes}:${String(seconds).padStart(2, "0")}`;
  return <span className="tabular-nums">{text} left</span>;
}

/** The code students scan. It changes every 15 seconds. */
export function RotatingQr({ sessionId }: { sessionId: string }) {
  const [qr, setQr] = useState<{ svg: string; expiresAt: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const result = await currentQr(sessionId).catch(() => null);
      if (cancelled) return;
      if (!result) {
        setFailed(true);
        timer = setTimeout(load, 5000);
        return;
      }
      setFailed(false);
      const expiresAt = new Date(result.expiresAt).getTime();
      setQr({
        svg: renderSVG(sessionQrPayload(sessionId, result.token), { border: 2, ecc: "M" }),
        expiresAt,
      });
      // Fetch the next code just after this one expires (a little early is fine: the old code still works).
      timer = setTimeout(load, Math.max(1000, expiresAt - Date.now() + 300));
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        className="mx-auto flex aspect-square w-full max-w-72 items-center justify-center rounded-lg bg-white p-2 [&:fullscreen]:max-w-none [&:fullscreen]:p-[6vmin] [&>div]:size-full [&_svg]:size-full"
      >
        {qr ? (
          <div aria-label="Check-in code" role="img" dangerouslySetInnerHTML={{ __html: qr.svg }} />
        ) : (
          <p className="text-sm text-neutral-500">{failed ? "Waiting for the session to open..." : "Loading..."}</p>
        )}
      </div>
      <div className="flex justify-center">
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          onClick={() => void boxRef.current?.requestFullscreen?.()}
        >
          Show full screen
        </button>
      </div>
    </div>
  );
}
