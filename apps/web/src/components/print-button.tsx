"use client";

import { buttonClass } from "@/components/ui";

/** Opens the browser's print window, where the report can also be saved as a PDF. */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "sm")}>
      {label}
    </button>
  );
}
