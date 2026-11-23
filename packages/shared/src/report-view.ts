/**
 * Which records a report shows: one week (moved with arrows, like a
 * calendar), everything, or a chosen date range. The same view decides what
 * the downloads contain. Dates are Ghana dates (UTC+0) as YYYY-MM-DD.
 */

export type ReportView =
  | { mode: "week"; from: string; to: string; previous: string; next: string; isThisWeek: boolean }
  | { mode: "all" }
  | { mode: "range"; from: string; to: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday of the week containing this date. */
export function mondayOf(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 Sunday
  return addDays(iso, weekday === 0 ? -6 : 1 - weekday);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type ReportQuery = Record<string, string | string[] | undefined>;

/** Reads the view from the address. The default is this week. */
export function parseView(query: ReportQuery): ReportView {
  const mode = first(query.view);
  if (mode === "all") return { mode: "all" };
  if (mode === "range") {
    const from = first(query.from);
    const to = first(query.to);
    if (isIsoDate(from) && isIsoDate(to)) return from <= to ? { mode: "range", from, to } : { mode: "range", from: to, to: from };
  }
  const week = first(query.week);
  const today = todayIso();
  const monday = mondayOf(isIsoDate(week) ? week : today);
  return {
    mode: "week",
    from: monday,
    to: addDays(monday, 6),
    previous: addDays(monday, -7),
    next: addDays(monday, 7),
    isThisWeek: monday === mondayOf(today),
  };
}

/** Whether a date (or the date part of a timestamp) is inside the view. */
export function inView(view: ReportView, isoDateOrTime: string): boolean {
  if (view.mode === "all") return true;
  const day = isoDateOrTime.slice(0, 10);
  return view.from <= day && day <= view.to;
}

/** The address's query for a view, keeping other parameters such as the term. */
export function viewQuery(view: ReportView | { mode: "week"; week: string }, extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  if (view.mode === "all") params.set("view", "all");
  else if (view.mode === "range") {
    params.set("view", "range");
    params.set("from", view.from);
    params.set("to", view.to);
  } else params.set("week", "week" in view ? view.week : view.from);
  return params.toString();
}

const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function date(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

/** "16 to 22 Nov 2026", "30 Nov to 6 Dec 2026", "28 Dec 2026 to 3 Jan 2027". */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return long.format(date(from));
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${long.format(date(from))} to ${long.format(date(to))}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))} to ${long.format(date(to))}`;
  return `${short.format(date(from))} to ${long.format(date(to))}`;
}

/** The line under a report's title and in its files. */
export function viewLabel(view: ReportView, allLabel: string): string {
  if (view.mode === "all") return allLabel;
  if (view.mode === "week") return `Week of ${rangeLabel(view.from, view.to)}`;
  return rangeLabel(view.from, view.to);
}

/** Monday to Friday of a week view, plus any weekend day that had a register or session. */
export function weekColumns(view: ReportView, heldDays: readonly string[]): string[] | null {
  if (view.mode !== "week") return null;
  const days = new Set(Array.from({ length: 5 }, (_, index) => addDays(view.from, index)));
  for (const day of heldDays) if (inView(view, day)) days.add(day.slice(0, 10));
  return [...days].sort();
}
