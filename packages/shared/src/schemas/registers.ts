import { z } from "zod";

/** Marks a teacher can give. A child without a mark is "not marked", never absent. */
export const ATTENDANCE_MARKS = ["present", "late", "absent"] as const;
export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export const ATTENDANCE_MARK_LABELS: Readonly<Record<AttendanceMark, { label: string; short: string }>> = {
  present: { label: "Present", short: "P" },
  late: { label: "Late", short: "L" },
  absent: { label: "Absent", short: "A" },
};

export function isAttendanceMark(value: unknown): value is AttendanceMark {
  return typeof value === "string" && (ATTENDANCE_MARKS as readonly string[]).includes(value);
}

/** Student ID to mark (null clears it). */
export type RegisterMarks = Record<string, AttendanceMark | null>;

/** Turns marks into the JSON that save_register_marks() expects. */
export function marksToPayload(marks: RegisterMarks): { student_id: string; mark: AttendanceMark | null }[] {
  return Object.entries(marks).map(([studentId, mark]) => ({ student_id: studentId, mark }));
}

/** Schools and classes can have up to this many periods in a day. */
export const MAX_PERIODS_PER_DAY = 20;

export const periodNumberSchema = z.coerce
  .number({ message: "Choose the period." })
  .int("Choose the period.")
  .min(1, "Choose the period.")
  .max(MAX_PERIODS_PER_DAY, `Periods go up to ${MAX_PERIODS_PER_DAY}.`);

export const periodsPerDaySchema = z.coerce
  .number({ message: "Enter the number of periods." })
  .int("Enter a whole number of periods.")
  .min(1, "A day has at least 1 period.")
  .max(MAX_PERIODS_PER_DAY, `Use at most ${MAX_PERIODS_PER_DAY} periods.`);

/** Blank means "use the school's number". */
export const classPeriodsSchema = z
  .union([z.literal(""), periodsPerDaySchema])
  .transform((value) => (value === "" ? null : value));

/** Optional marks every child marked present or late earns for this register. */
export const rewardMarksSchema = z
  .union([z.literal(""), z.coerce.number()])
  .transform((value) => (value === "" ? 0 : value))
  .pipe(
    z
      .number({ message: "Enter a number of marks." })
      .min(0, "Marks cannot be negative.")
      .max(100, "Use at most 100 marks.")
      .multipleOf(0.25, "Use whole marks, or quarters such as 0.5."),
  );

export const startRegisterSchema = z.object({
  classId: z.uuid("Choose a class."),
  classSubjectId: z.uuid().optional(),
  periodNumber: periodNumberSchema.optional(),
  rewardMarks: rewardMarksSchema,
});

/** "HH:MM" in 24-hour time. */
const timeOfDaySchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Enter a time such as 10:00.")
  .transform((value) => value.slice(0, 5));

export const registerTimingSchema = z.object({
  dailyRegisterClosesAt: timeOfDaySchema,
  periodRegisterMinutes: z.coerce
    .number({ message: "Enter the number of minutes." })
    .int("Enter whole minutes.")
    .min(10, "Use at least 10 minutes.")
    .max(240, "Use at most 240 minutes (4 hours)."),
  periodsPerDay: periodsPerDaySchema,
});

/** Formats a register's period, for example "Period 3". */
export function periodLabel(periodNumber: number | null | undefined): string {
  return periodNumber ? `Period ${periodNumber}` : "Daily register";
}

/** "1 mark", "2.5 marks". */
export function marksLabel(marks: number): string {
  return `${marks} ${marks === 1 ? "mark" : "marks"}`;
}

/** "10:00:00" from the database to "10:00". */
export function shortTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}
