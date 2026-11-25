/** Short day names and choices of the next days, for parents' forms (Ghana time, which is UTC). */
export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

export function nextDays(today: string, count: number): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { value: iso, label: i === 0 ? `Today, ${shortDay(iso)}` : i === 1 ? `Tomorrow, ${shortDay(iso)}` : shortDay(iso) };
  });
}
