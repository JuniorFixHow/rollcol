"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import { inputClass } from "@/components/ui";

/** Plain text for matching: lower case, accents and extra spaces removed. */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * A search box above a table: rows that do not contain every typed word are
 * hidden as you type. Works on what is on the page.
 */
export function ListSearch({ placeholder, children }: { placeholder: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ shown: number; total: number } | null>(null);

  const filter = (value: string) => {
    setQuery(value);
    const words = normalise(value).split(" ").filter(Boolean);
    const rows = [...(ref.current?.querySelectorAll<HTMLTableRowElement>("tbody > tr") ?? [])];
    let shown = 0;
    for (const row of rows) {
      const text = normalise(row.textContent ?? "");
      const match = words.every((word) => text.includes(word));
      row.hidden = !match;
      if (match) shown++;
    }
    setResult(words.length === 0 ? null : { shown, total: rows.length });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor={id} className="sr-only">
          {placeholder}
        </label>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13.5 13.5 17 17" />
        </svg>
        <input
          id={id}
          type="search"
          value={query}
          onChange={(event) => filter(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={`${inputClass} pl-9`}
        />
      </div>
      <div ref={ref}>{children}</div>
      {result ? (
        <p role="status" className="text-xs text-muted">
          {result.shown === 0 ? `Nothing matches "${query.trim()}".` : `Showing ${result.shown} of ${result.total}.`}
        </p>
      ) : null}
    </div>
  );
}
