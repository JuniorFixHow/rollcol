import { z } from "zod";
import { STAFF_ROLES } from "../constants";
import { emailSchema, personNameSchema, schoolIdSchema } from "./school";

const uuid = z.uuid("Choose an option from the list.");

/** Empty select values arrive as "", which means "none". */
const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(uuid.nullable());

const isoDate = z.iso.date("Enter a valid date.");

export const staffInviteSchema = z.object({
  fullName: personNameSchema,
  email: emailSchema,
  schoolId: schoolIdSchema,
  role: z.enum(STAFF_ROLES),
});

export const staffUpdateSchema = z.object({
  fullName: personNameSchema,
  schoolId: schoolIdSchema,
  role: z.enum(STAFF_ROLES),
  active: z.boolean(),
});

export const academicPeriodSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name, for example First Term 2026/2027.").max(80),
    startsOn: isoDate,
    endsOn: isoDate,
  })
  .refine((period) => period.endsOn > period.startsOn, {
    message: "The end date must be after the start date.",
    path: ["endsOn"],
  });

export const classSchema = z.object({
  name: z.string().trim().min(1, "Enter the class name.").max(60),
  classTeacherId: optionalUuid,
});

export const subjectSchema = z.object({
  name: z.string().trim().min(2, "Enter the subject name.").max(80),
});

export const classSubjectSchema = z.object({
  subjectId: uuid,
  teacherId: optionalUuid,
});

/** Non-tertiary students are records that admins add (they have no accounts). */
export const studentRecordSchema = z.object({
  fullName: personNameSchema,
  schoolId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(schoolIdSchema.optional()),
  classId: optionalUuid,
});

export const programmeSchema = z.object({
  name: z.string().trim().min(2, "Enter the programme name.").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.string().regex(/^[A-Z0-9-]{1,20}$/, "Use letters, numbers and dashes only.").nullable()),
});

export const batchSchema = z.object({
  programmeId: uuid,
  name: z.string().trim().min(2, "Enter the batch name, for example 2025 intake.").max(80),
  entryYear: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(z.number().int().min(1990).max(2200).nullable()),
});

export const courseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z0-9 -]{2,20}$/, "Use a course code such as CSC 101.")),
  title: z.string().trim().min(2, "Enter the course title.").max(160),
});

export const courseRunSchema = z.object({
  courseId: uuid,
  academicPeriodId: uuid,
  lecturerId: optionalUuid,
});

export const guardianDelegationSchema = z.object({
  staffId: uuid,
  expiresOn: isoDate,
});
