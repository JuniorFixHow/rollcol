import type { Json } from "./database.types";

export interface SchoolBreak {
  label: string;
  start: string;
  end: string;
}

export const WEEKDAYS = [
  { weekday: 1, name: "Monday" },
  { weekday: 2, name: "Tuesday" },
  { weekday: 3, name: "Wednesday" },
  { weekday: 4, name: "Thursday" },
  { weekday: 5, name: "Friday" },
  { weekday: 6, name: "Saturday" },
  { weekday: 7, name: "Sunday" },
] as const;

/** "07:30" or "07:30:00" as "7:30am". */
export function clockText(time: string | null | undefined): string {
  if (!time) return "";
  const [h = 0, m = 0] = time.slice(0, 5).split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
}

/** Breaks stored as JSON, checked. */
export function parseBreaks(value: Json | null | undefined): SchoolBreak[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const { label, start, end } = item;
    return typeof start === "string" && typeof end === "string"
      ? [{ label: typeof label === "string" && label ? label : "Break", start, end }]
      : [];
  });
}

/** One day in words, for parents: "7:30am to 3:00pm · Break 10:00am to 10:30am". */
export function schoolDayText(day: {
  opens_at: string | null;
  closes_at: string | null;
  breaks: Json;
  closed: boolean;
  note?: string | null;
}): string {
  if (day.closed) return `School closed${day.note ? `: ${day.note}` : ""}`;
  const times =
    day.opens_at && day.closes_at
      ? `${clockText(day.opens_at)} to ${clockText(day.closes_at)}`
      : day.closes_at
        ? `Closes ${clockText(day.closes_at)}`
        : day.opens_at
          ? `Opens ${clockText(day.opens_at)}`
          : "";
  const breaks = parseBreaks(day.breaks).map((b) => `${b.label} ${clockText(b.start)} to ${clockText(b.end)}`);
  return [times, ...breaks, day.note ?? ""].filter(Boolean).join(" · ");
}
