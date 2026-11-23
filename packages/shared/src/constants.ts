/**
 * Product wide constants. Values that schools can change live in the
 * database as settings; these are platform defaults and hard limits.
 */

/** Tertiary schools: students check themselves in. Non-tertiary: teachers mark registers. */
export const SCHOOL_TYPES = ["tertiary", "non_tertiary"] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

/** Non-tertiary register modes. Basic schools mark once a day; SHS may mark per period. */
export const REGISTER_MODES = ["daily", "per_period"] as const;
export type RegisterMode = (typeof REGISTER_MODES)[number];

/** Where a record came from. Stediis-synced records are read-only in RollCol. */
export const RECORD_SOURCES = ["rollcol", "stediis"] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "not_marked"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STAFF_ROLES = ["admin", "teacher"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Plans, per student per term (non-tertiary) or per semester (tertiary). */
export const PLANS = ["free", "alerts", "complete", "tertiary_standard"] as const;
export type Plan = (typeof PLANS)[number];

export const SESSION_LIMITS = {
  /** Smallest geofence radius a lecturer may set, because indoor GPS is rough. */
  minRadiusMetres: 50,
  maxRadiusMetres: 2000,
  /** Rotating QR token window. The server also accepts the previous window. */
  qrWindowSeconds: 15,
  /** Reminder before a session closes. */
  closingReminderMinutes: 5,
} as const;

export const DEVICE_POLICY = {
  /** A new device becomes active on its own after this cooldown, unless an admin approves sooner. */
  cooldownHours: 48,
  /** Changes allowed per semester before only an admin can approve. */
  maxChangesPerSemester: 2,
} as const;

export const SMS_POLICY = {
  /** Wait after a register closes before alerts go out, so teachers can fix mistakes. */
  gracePeriodMinutes: 15,
  /** Messages are held outside these hours (Africa/Accra, which is UTC+0). */
  quietHoursStart: 21,
  quietHoursEnd: 7,
  /** Most child names in one combined guardian message before it is summarised instead. */
  maxNamesPerCombinedMessage: 3,
  /** Guardians linked to more students than this are flagged to the admin. */
  guardianLinkFlagThreshold: 5,
} as const;

export const TIMEZONE = "Africa/Accra";

/**
 * Limits until the platform owner verifies a school. The database enforces these
 * (private.unverified_limit in supabase/migrations); keep the two in sync.
 */
/** Free plan students for a verified school (private.free_student_limit). Disabled students do not count. */
export const FREE_PLAN_STUDENTS = {
  non_tertiary: 100,
  tertiary: 200,
} as const;

/** Free students across all of one person's workspaces (private.workspace_student_limit). */
export const WORKSPACE_FREE_STUDENTS = 50;

export const UNVERIFIED_SCHOOL_LIMITS = {
  students: 10,
  staff: 10,
} as const;

/** School ID sign-in locks a school ID after this many failures in 15 minutes. */
export const SIGN_IN_LOCK = { maxFailures: 10, windowMinutes: 15 } as const;

export const PASSWORD_MIN_LENGTH = 8;

/** Placeholder until launch (build plan step 9). */
export const SUPPORT_EMAIL = "support@rollcol.app";

/** Apple's standard EULA is the Terms of Use on iOS. */
export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

/**
 * The public website. Check-in codes link here, so any camera or QR app can
 * open them. Change at launch when RollCol has its own domain.
 */
export const SITE_URL = "https://rollcol.vercel.app";

/** The app's own link scheme (app.json "scheme"). */
export const APP_SCHEME = "rollcol";
