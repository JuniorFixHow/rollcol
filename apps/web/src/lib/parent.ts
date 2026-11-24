type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

/** A day's mark as words and a colour, for a parent. */
export function markLabel(mark: string | null, held = true): { label: string; tone: Tone } {
  if (!held) return { label: "No register", tone: "neutral" };
  if (mark === "present") return { label: "Present", tone: "success" };
  if (mark === "late") return { label: "Late", tone: "warning" };
  if (mark === "absent") return { label: "Absent", tone: "danger" };
  return { label: "Not marked", tone: "neutral" };
}

/** What kind of message a school sent, in words. */
export const MESSAGE_KIND_LABEL: Record<string, string> = {
  attendance: "Attendance",
  broadcast: "Announcement",
  custom: "Message",
  system: "Notice",
};

/** Today in Ghana (the same as UTC), as YYYY-MM-DD. */
export function ghanaToday(): string {
  return new Date().toISOString().slice(0, 10);
}
