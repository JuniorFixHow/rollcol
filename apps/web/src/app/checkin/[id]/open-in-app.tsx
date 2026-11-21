"use client";

import { APP_SCHEME, appCheckinLink } from "@rollcol/shared";
import { useEffect, useSyncExternalStore } from "react";

const ANDROID_PACKAGE = "com.teqxa.rollcol";

function subscribeNothing() {
  return () => undefined;
}

/** "android", "ios" or "other", read from the browser. */
function usePlatform(): "android" | "ios" | "other" {
  return useSyncExternalStore(
    subscribeNothing,
    () => {
      const agent = navigator.userAgent;
      if (/android/i.test(agent)) return "android";
      if (/iphone|ipad|ipod/i.test(agent) || (agent.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
      return "other";
    },
    () => "other",
  );
}

export function OpenInApp({ sessionId, token }: { sessionId: string; token: string }) {
  const platform = usePlatform();
  const appLink = appCheckinLink(sessionId, token);
  // On Android, Chrome opens the app straight from an intent link.
  const androidLink = `intent://checkin/${sessionId}?t=${token}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};end`;
  const href = platform === "android" ? androidLink : appLink;

  // Try to open the app at once. Some browsers ask first, or need the button.
  useEffect(() => {
    if (platform === "other") return;
    window.location.href = href;
  }, [platform, href]);

  return (
    <>
      <h1 className="text-lg font-semibold">Check in with RollCol</h1>
      <p className="text-sm text-muted">
        {platform === "other"
          ? "Scan this code with your phone. Check-in only works in the RollCol app on your own phone."
          : "The RollCol app should open now. If it does not, tap the button. Do it quickly: the code changes every few seconds."}
      </p>
      {platform !== "other" ? (
        <a
          href={href}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:opacity-90"
        >
          Open RollCol to check in
        </a>
      ) : null}
      <p className="text-xs text-muted">
        Don&rsquo;t have the app yet? Get RollCol from the App Store or Google Play, sign in, then scan the code again.
      </p>
    </>
  );
}
