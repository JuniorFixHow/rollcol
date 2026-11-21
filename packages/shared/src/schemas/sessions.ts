import { z } from "zod";
import { rewardMarksSchema } from "./registers";

const uuid = z.uuid("Choose an option from the list.");

/** Minutes a session can stay open. */
export const SESSION_MINUTES = { min: 5, max: 240, default: 30 } as const;
/** How often the rotating code changes, in seconds. */
export const QR_SECONDS = { min: 10, max: 60, default: 15 } as const;
/** Check-in radius in metres. */
export const SESSION_RADIUS = { min: 50, max: 1000, default: 75 } as const;

const latitude = z.coerce
  .number({ message: "Enter the latitude." })
  .min(-90, "Latitude is between -90 and 90.")
  .max(90, "Latitude is between -90 and 90.");
const longitude = z.coerce
  .number({ message: "Enter the longitude." })
  .min(-180, "Longitude is between -180 and 180.")
  .max(180, "Longitude is between -180 and 180.");
const radius = z.coerce
  .number({ message: "Enter a radius in metres." })
  .int("Use whole metres.")
  .min(SESSION_RADIUS.min, `At least ${SESSION_RADIUS.min} metres.`)
  .max(SESSION_RADIUS.max, `At most ${SESSION_RADIUS.max} metres.`);

export const venueSchema = z.object({
  name: z.string().trim().min(2, "Enter the venue's name.").max(80, "Keep the name under 80 characters."),
  latitude,
  longitude,
  radius,
});
export type VenueInput = z.infer<typeof venueSchema>;

/** Start a session from the web: a saved venue, or no location check. */
export const startSessionSchema = z
  .object({
    courseRunId: uuid,
    minutes: z.coerce
      .number({ message: "Enter the minutes." })
      .int("Use whole minutes.")
      .min(SESSION_MINUTES.min, `At least ${SESSION_MINUTES.min} minutes.`)
      .max(SESSION_MINUTES.max, "At most 4 hours (240 minutes)."),
    when: z.enum(["now", "later"]),
    /** Ghana time, as a datetime-local input sends it: "2026-11-27T09:00". */
    startsAt: z.string().optional(),
    /** A saved venue, "current" (this device's location) or "none" (no location check). */
    venueId: z.union([z.literal("none"), z.literal("current"), uuid], { message: "Choose where the class is." }),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    accuracy: z.string().optional(),
    radius: z.union([z.literal(""), radius]).optional(),
    rewardMarks: rewardMarksSchema,
    qrRequired: z.boolean(),
    qrSeconds: z.coerce
      .number({ message: "Enter the seconds." })
      .int("Use whole seconds.")
      .min(QR_SECONDS.min, `At least ${QR_SECONDS.min} seconds.`)
      .max(QR_SECONDS.max, `At most ${QR_SECONDS.max} seconds.`)
      .default(QR_SECONDS.default),
  })
  .superRefine((value, context) => {
    if (value.when === "later" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.startsAt ?? "")) {
      context.addIssue({ code: "custom", path: ["startsAt"], message: "Choose a date and time." });
    }
    if (value.venueId === "current") {
      const accuracy = Number(value.accuracy);
      if (!value.latitude || !value.longitude || !value.accuracy || Number.isNaN(accuracy)) {
        context.addIssue({ code: "custom", path: ["venueId"], message: "Your location was not found yet. Allow location and wait a moment." });
      } else if (accuracy > 100) {
        context.addIssue({
          code: "custom",
          path: ["venueId"],
          message: `This device's location is only accurate to about ${Math.round(accuracy)} metres (100 is needed). Laptops guess from Wi-Fi: choose a venue, or start the session from your phone.`,
        });
      }
    }
    if (value.venueId === "none" && value.radius !== undefined && value.radius !== "") {
      context.addIssue({ code: "custom", path: ["radius"], message: "A radius needs a venue." });
    }
    if (value.venueId === "none" && !value.qrRequired) {
      context.addIssue({
        code: "custom",
        path: ["qrRequired"],
        message: "Without a venue, use the rotating code, or students could check in from anywhere.",
      });
    }
  });
export type StartSessionInput = z.infer<typeof startSessionSchema>;

export const sessionReasonSchema = z
  .string()
  .trim()
  .min(3, "Give a reason.")
  .max(300, "Keep the reason under 300 characters.");

/** What is shown inside the rotating QR code. The app reads the session and the current token from it. */
export function sessionQrPayload(sessionId: string, token: string): string {
  return `rollcol:checkin:${sessionId}:${token}`;
}

export function parseSessionQr(text: string): { sessionId: string; token: string } | null {
  const match = /^rollcol:checkin:([0-9a-f-]{36}):([0-9a-f]{12})$/i.exec(text.trim());
  const [, sessionId, token] = match ?? [];
  return sessionId && token ? { sessionId: sessionId.toLowerCase(), token: token.toLowerCase() } : null;
}

export type SessionState = "scheduled" | "open" | "ended" | "void";

export function sessionState(session: { starts_at: string; ends_at: string; voided_at: string | null }, now = new Date()): SessionState {
  if (session.voided_at) return "void";
  if (new Date(session.starts_at) > now) return "scheduled";
  if (new Date(session.ends_at) > now) return "open";
  return "ended";
}

export const SESSION_STATE_LABELS: Readonly<Record<SessionState, string>> = {
  scheduled: "Scheduled",
  open: "Open",
  ended: "Ended",
  void: "Cancelled",
};

/** School rules for lecturers (Settings page). Admins can always correct sessions. */
export const sessionRulesSchema = z.object({
  lecturersAddVenues: z.boolean(),
  lecturersRemoveSelfCheckins: z.boolean(),
  lecturersAddAfterEnd: z.boolean(),
});
