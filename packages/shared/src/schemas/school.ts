import { z } from "zod";
import { PASSWORD_MIN_LENGTH, REGISTER_MODES, SCHOOL_TYPES } from "../constants";
import { normalisePhone } from "../phone";

/** A phone number accepted from user input and normalised to E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (normalised === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number." });
      return z.NEVER;
    }
    return normalised;
  });

/** School IDs vary by school: numeric or letters followed by numbers, of varying length. */
export const schoolIdSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .min(3, "School ID is too short.")
      .max(32, "School ID is too long.")
      .regex(/^[A-Z0-9]+$/, "School ID can contain only letters and numbers."),
  );

/** The six-character code a school shares with its staff and students. */
export const schoolCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "School codes have six letters or numbers."));

export const personNameSchema = z
  .string()
  .trim()
  .min(2, "Enter the full name.")
  .max(120, "That name is too long.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(72, "Use at most 72 characters.");

/** Signing in with school code, school ID and password. */
export const schoolIdSignInSchema = z.object({
  schoolCode: schoolCodeSchema,
  schoolId: schoolIdSchema,
  password: z.string().min(1, "Enter your password."),
});

export const emailSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

/** The school part of sign-up, used again on the onboarding page after email confirmation. */
export const schoolDetailsSchema = z
  .object({
    name: z.string().trim().min(3, "Enter the school's full name.").max(120),
    type: z.enum(SCHOOL_TYPES, "Choose the type of school."),
    registerMode: z.enum(REGISTER_MODES).optional(),
    contactPhone: phoneSchema,
    adminFullName: personNameSchema,
    adminSchoolId: schoolIdSchema,
  })
  .refine((school) => school.type === "tertiary" || school.registerMode !== undefined, {
    message: "Choose how registers are taken.",
    path: ["registerMode"],
  });

export type SchoolDetailsInput = z.input<typeof schoolDetailsSchema>;
export type SchoolDetails = z.output<typeof schoolDetailsSchema>;

export const accountSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/** Tertiary students create accounts on the mobile app. */
export const studentSignUpSchema = z.object({
  schoolCode: schoolCodeSchema,
  schoolId: schoolIdSchema,
  fullName: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type StudentSignUpInput = z.input<typeof studentSignUpSchema>;

/** Stored in the auth user's metadata so joining can finish after email confirmation. */
export const pendingStudentJoinSchema = z.object({
  pending_join: z.object({
    school_code: schoolCodeSchema,
    school_id: schoolIdSchema,
    full_name: personNameSchema,
  }),
});

/** Stored in the auth user's metadata so school creation can finish after email confirmation. */
export const pendingSchoolSchema = z.object({
  pending_school: z.object({
    name: z.string(),
    type: z.enum(SCHOOL_TYPES),
    register_mode: z.enum(REGISTER_MODES).nullable(),
    contact_phone: z.string(),
    admin_full_name: z.string(),
    admin_school_id: z.string(),
  }),
});

export const schoolSettingsSchema = z.object({
  name: z.string().trim().min(3, "Enter the school's full name.").max(120),
  contactPhone: phoneSchema,
  registerMode: z.enum(REGISTER_MODES).optional(),
  studentApprovalRequired: z.boolean(),
  studentSelfSignup: z.boolean(),
  lowAttendancePercent: z.coerce
    .number({ error: "Enter a percentage." })
    .int("Enter a whole number.")
    .min(1, "Enter a percentage from 1 to 100.")
    .max(100, "Enter a percentage from 1 to 100."),
});

export const guardianSchema = z.object({
  fullName: personNameSchema,
  phone: phoneSchema,
  relationship: z.string().trim().max(40, "Keep the relationship short.").optional(),
});

export type GuardianInput = z.input<typeof guardianSchema>;
export type Guardian = z.output<typeof guardianSchema>;
