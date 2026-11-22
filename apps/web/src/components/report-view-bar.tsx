import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui";
import { type ReportView, mondayOf, todayIso, viewLabel, viewQuery } from "@/lib/report-view";

const tab = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`;

const arrow =
  "inline-flex size-9 items-center justify-center rounded-md border border-line text-muted hover:bg-surface-muted hover:text-foreground";

const dateInput = "rounded-md border border-line bg-surface px-3 py-1.5 text-sm";

/**
 * Week (with arrows to move a week at a time, like a calendar), All, or a
 * date range. Everything is in the address, so a view can be bookmarked and
 * the downloads use the same records.
 */
export function ReportViewBar({
  path,
  view,
  extra = {},
  allLabel,
  allNote,
}: {
  path: string;
  view: ReportView;
  /** Other parameters to keep, such as the term. */
  extra?: Record<string, string | undefined>;
  allLabel: string;
  /** Shown under the bar in All, for example the term chips. */
  allNote?: ReactNode;
}) {
  const href = (query: string) => `${path}?${query}`;
  const thisWeek = mondayOf(todayIso());
  const rangeFrom = view.mode === "all" ? "" : view.from;
  const rangeTo = view.mode === "all" ? "" : view.to;

  return (
    <div className="mb-5 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Show">
          <Link href={href(viewQuery({ mode: "week", week: thisWeek }, extra))} className={tab(view.mode === "week")}>
            Week
          </Link>
          <Link href={href(viewQuery({ mode: "all" }, extra))} className={tab(view.mode === "all")}>
            All
          </Link>
          <Link
            href={href(
              viewQuery(
                view.mode === "range" ? view : { mode: "range", from: view.mode === "week" ? view.from : thisWeek, to: todayIso() },
                extra,
              ),
            )}
            className={tab(view.mode === "range")}
          >
            Date range
          </Link>
        </div>

        {view.mode === "week" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href(viewQuery({ mode: "week", week: view.previous }, extra))} className={arrow} aria-label="Previous week">
              <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.5 4.5 7 10l5.5 5.5" />
              </svg>
            </Link>
            <Link href={href(viewQuery({ mode: "week", week: view.next }, extra))} className={arrow} aria-label="Next week">
              <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.5 4.5 13 10l-5.5 5.5" />
              </svg>
            </Link>
            {view.isThisWeek ? null : (
              <Link
                href={href(viewQuery({ mode: "week", week: thisWeek }, extra))}
                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
              >
                This week
              </Link>
            )}
            <span className="text-sm font-medium">{viewLabel(view, allLabel)}</span>
          </div>
        ) : null}

        {view.mode === "all" ? <span className="text-sm font-medium">{allLabel}</span> : null}
      </div>

      {view.mode === "range" ? (
        <form method="get" action={path} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="view" value="range" />
          {Object.entries(extra).map(([key, value]) => (value ? <input key={key} type="hidden" name={key} value={value} /> : null))}
          <label className="grid gap-1 text-sm">
            <span className="text-muted">From</span>
            <input type="date" name="from" defaultValue={rangeFrom} required className={dateInput} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">To</span>
            <input type="date" name="to" defaultValue={rangeTo} required className={dateInput} />
          </label>
          <button type="submit" className={buttonClass("primary", "sm")}>
            Show
          </button>
          <span className="pb-1.5 text-sm font-medium">{viewLabel(view, allLabel)}</span>
        </form>
      ) : null}

      {view.mode === "all" && allNote ? allNote : null}
    </div>
  );
}
