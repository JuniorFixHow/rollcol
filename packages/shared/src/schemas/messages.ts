import { z } from "zod";
import { getSmsSegmentInfo, sanitiseForSms } from "../sms/gsm";

/** Broadcasts and custom messages may use at most this many SMS segments each. */
export const MAX_MESSAGE_SEGMENTS = 3;

const messageBody = z
  .string()
  .trim()
  .min(5, "Write the message first.")
  .max(450, "Keep the message to 450 characters.");

export const smsSettingsSchema = z
  .object({
  smsName: z
    .string()
    .trim()
    .max(30, "Use at most 30 characters.")
    .refine((value) => value === "" || value.length >= 2, "Use at least 2 characters, or leave it empty.")
    .transform((value) => (value === "" ? null : value)),
  smsAbsenceAlerts: z.boolean(),
  smsPresentAlerts: z.boolean(),
  quietHours: z.boolean(),
  /** Only sent while quiet hours are on; otherwise the saved times are kept. */
  quietStart: z.string().optional(),
  quietEnd: z.string().optional(),
})
  .superRefine((value, context) => {
    if (!value.quietHours) return;
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(value.quietStart ?? "")) context.addIssue({ code: "custom", path: ["quietStart"], message: "Choose a time." });
    if (!time.test(value.quietEnd ?? "")) context.addIssue({ code: "custom", path: ["quietEnd"], message: "Choose a time." });
    if (value.quietStart && value.quietStart === value.quietEnd) {
      context.addIssue({ code: "custom", path: ["quietEnd"], message: "Start and end must be different times." });
    }
  });
export type SmsSettingsInput = z.infer<typeof smsSettingsSchema>;

export const broadcastSchema = z.object({
  body: messageBody,
  classIds: z.array(z.uuid()).max(100),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

export const studentMessageSchema = z.object({
  studentId: z.uuid(),
  body: messageBody,
});

export const smsCreditGrantSchema = z.object({
  schoolId: z.uuid(),
  amount: z.coerce
    .number()
    .int("Use a whole number.")
    .refine((value) => value !== 0, "Enter a number of credits.")
    .refine((value) => Math.abs(value) <= 1000000, "That is too many."),
  reason: z.string().trim().max(200, "Keep the note short."),
});

/** What a message will cost per recipient, with the school name added in front as the database does. */
export function messageCost(schoolName: string, body: string): { segments: number; characters: number } {
  const info = getSmsSegmentInfo(sanitiseForSms(`${schoolName}: ${body.trim()}`));
  return { segments: info.segments, characters: info.units };
}

export const SMS_KIND_LABELS = {
  attendance: "Attendance",
  system: "Guardian notice",
  broadcast: "Broadcast",
  custom: "Message",
} as const;

export const SMS_STATUS_LABELS = {
  queued: "Waiting",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  no_credit: "No credits",
  cancelled: "Cancelled",
  in_app: "In the app",
} as const;

/** How the school sends alerts and messages to a guardian. */
export const GUARDIAN_CHANNEL_LABELS = {
  app_first: "App first, SMS if needed",
  sms: "SMS only",
  app: "App only",
} as const;

/** What the phone network reported. Shown instead of "Sent" once a report arrives. */
export const SMS_DELIVERY_LABELS = {
  pending: "Sent, not yet confirmed",
  delivered: "Delivered",
  failed: "Not delivered",
  expired: "Not delivered (phone off too long)",
  rejected: "Rejected by the network",
} as const;

/** "Messages between 9:00pm and 7:00am wait until 7:00am", or null when the school has no quiet hours. */
export function quietHoursText(quiet: { on: boolean; start: string; end: string } | null): string | null {
  if (!quiet?.on) return null;
  const clock = (value: string) => {
    const [h = 0, m = 0] = value.slice(0, 5).split(":").map(Number);
    const suffix = h >= 12 ? "pm" : "am";
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${suffix}`;
  };
  return `Messages between ${clock(quiet.start)} and ${clock(quiet.end)} wait until ${clock(quiet.end)}.`;
}
