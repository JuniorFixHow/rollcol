"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";

/** Goes back a page, or home when this page was opened directly. */
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={buttonClass("secondary")}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      Go back
    </button>
  );
}
