import type { Database } from "./database.types";

type Functions = Database["public"]["Functions"];
export type RegisterDayRow = Functions["class_register_days"]["Returns"][number];
export type CourseReportRow = Functions["course_run_report"]["Returns"][number];

export type DayMark = "present" | "late" | "absent";

/** Present and late both count as attending (the GES "Attendance X out of Y"). */
export function attendanceRate(attended: number, held: number): number | null {
  return held === 0 ? null : Math.round((attended / held) * 1000) / 10;
}

export function isBelow(rate: number | null, threshold: number): boolean {
  return rate !== null && rate < threshold;
}

/** One letter per mark for registers: P, L, A (blank when not marked). */
export function markLetter(mark: string | null): string {
  return mark === "present" ? "P" : mark === "late" ? "L" : mark === "absent" ? "A" : "";
}

export interface ClassReportStudent {
  id: string;
  name: string;
  schoolNumber: string | null;
  marks: Record<string, DayMark | null>;
  present: number;
  late: number;
  absent: number;
  attended: number;
  held: number;
  rate: number | null;
  rewardMarks: number;
}

export interface ClassReport {
  days: string[];
  students: ClassReportStudent[];
}

/** The term as a register: every child by every school day. */
export function buildClassReport(rows: readonly RegisterDayRow[]): ClassReport {
  const days = [...new Set(rows.map((row) => row.day))].sort();
  const byStudent = new Map<string, ClassReportStudent>();
  for (const row of rows) {
    let student = byStudent.get(row.student_id);
    if (!student) {
      student = {
        id: row.student_id,
        name: row.full_name,
        schoolNumber: row.school_number,
        marks: {},
        present: 0,
        late: 0,
        absent: 0,
        attended: 0,
        held: days.length,
        rate: null,
        rewardMarks: 0,
      };
      byStudent.set(row.student_id, student);
    }
    const mark = row.mark === "present" || row.mark === "late" || row.mark === "absent" ? row.mark : null;
    student.marks[row.day] = mark;
    if (mark) student[mark] += 1;
    student.rewardMarks += Number(row.marks ?? 0);
  }
  const students = [...byStudent.values()].map((student) => {
    const attended = student.present + student.late;
    return { ...student, attended, rate: attendanceRate(attended, student.held) };
  });
  return { days, students };
}

export interface CourseReportStudent {
  id: string;
  name: string;
  schoolNumber: string | null;
  /** Session id to the check-in method ("self" or "manual"), or null if missed. */
  sessions: Record<string, string | null>;
  attended: number;
  held: number;
  rate: number | null;
  rewardMarks: number;
}

export interface CourseReport {
  sessions: { id: string; startsAt: string }[];
  students: CourseReportStudent[];
}

/** The semester as sessions: every registered student by every session held. */
export function buildCourseReport(rows: readonly CourseReportRow[]): CourseReport {
  const sessionMap = new Map<string, string>();
  for (const row of rows) sessionMap.set(row.session_id, row.starts_at);
  const sessions = [...sessionMap.entries()]
    .map(([id, startsAt]) => ({ id, startsAt }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const byStudent = new Map<string, CourseReportStudent>();
  for (const row of rows) {
    let student = byStudent.get(row.student_id);
    if (!student) {
      student = {
        id: row.student_id,
        name: row.full_name,
        schoolNumber: row.school_number,
        sessions: {},
        attended: 0,
        held: sessions.length,
        rate: null,
        rewardMarks: 0,
      };
      byStudent.set(row.student_id, student);
    }
    student.sessions[row.session_id] = row.checked_in_at ? (row.method ?? "self") : null;
    if (row.checked_in_at) student.attended += 1;
    student.rewardMarks += Number(row.reward_marks ?? 0);
  }
  const students = [...byStudent.values()].map((student) => ({
    ...student,
    rate: attendanceRate(student.attended, student.held),
  }));
  return { sessions, students };
}

/** A CSV file's text (Excel opens it). Values with commas, quotes or line breaks are quoted. */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  const cell = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    // Values that start like a formula are made plain text, so a name cannot run as a formula in Excel.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

/** "Abena Mensah, 2025 intake" style safe file names: letters, numbers and dashes only. */
export function fileSlug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "report"
  );
}
