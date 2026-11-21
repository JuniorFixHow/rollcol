/** Ghana is UTC+0 all year, so times are shown in UTC. */
const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "9:05am" */
export function formatTime(iso: string): string {
  return time.format(new Date(iso)).replace(/\s/g, "").toLowerCase();
}

/** "Mon 24 Nov" */
export function formatDay(iso: string): string {
  return day.format(new Date(iso)).replace(",", "");
}

/** "Mon 24 Nov, 9:05am" */
export function formatDayTime(iso: string): string {
  return `${formatDay(iso)}, ${formatTime(iso)}`;
}

/** "12 min", "1 h 5 min", for a duration in milliseconds. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Today's date in Ghana as YYYY-MM-DD. */
export function ghanaDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
