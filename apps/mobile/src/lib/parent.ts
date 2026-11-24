import type { Database } from "@rollcol/shared";

export type ParentChild = Database["public"]["Functions"]["parent_children"]["Returns"][number];

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

/** A day's mark as words and a colour, for a parent. */
export function markLabel(mark: string | null, held = true): { label: string; tone: Tone } {
  if (!held) return { label: "No register", tone: "neutral" };
  if (mark === "present") return { label: "Present", tone: "success" };
  if (mark === "late") return { label: "Late", tone: "warning" };
  if (mark === "absent") return { label: "Absent", tone: "danger" };
  return { label: "Not marked", tone: "neutral" };
}

/** The first word of a name, for friendly headings. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** What kind of message a school sent, in words. */
export const KIND_LABEL: Record<string, string> = {
  attendance: "Attendance",
  broadcast: "Announcement",
  custom: "Message",
  system: "Notice",
};
