import { describeDatabaseError } from "@rollcol/shared";
import * as LocalAuthentication from "expo-local-authentication";
import * as Location from "expo-location";
import { phoneSecret } from "./device";
import { supabase } from "./supabase";

export type StepResult<T> = { ok: true; value: T } | { ok: false; message: string; settings?: boolean };

/**
 * Face ID, fingerprint, or the phone's PIN, so nobody else can check in with
 * this phone. A phone with no screen lock at all cannot check in.
 */
export async function confirmItsYou(courseCode: string): Promise<StepResult<null>> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      ok: false,
      message: "Set a screen lock on this phone (fingerprint, face, PIN or passcode) to check in. It proves it is you.",
      settings: true,
    };
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: `Check in to ${courseCode}`,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  if (result.success) return { ok: true, value: null };
  if (result.error === "user_cancel" || result.error === "system_cancel" || result.error === "app_cancel") {
    return { ok: false, message: "Check-in cancelled." };
  }
  return { ok: false, message: "We could not confirm it is you. Try again." };
}

export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  mocked: boolean;
}

/** One precise reading of where the phone is, only while checking in. */
export async function currentPosition(): Promise<StepResult<Position>> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return {
      ok: false,
      message: "RollCol needs your location to check you in. Allow location for RollCol in Settings, then try again.",
      settings: true,
    };
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    return { ok: false, message: "Location is turned off on this phone. Turn it on, then try again.", settings: true };
  }
  try {
    const reading = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
    ]);
    if (!reading) {
      return { ok: false, message: "Finding your location took too long. Move near a window or outside, then try again." };
    }
    return {
      ok: true,
      value: {
        latitude: reading.coords.latitude,
        longitude: reading.coords.longitude,
        accuracy: reading.coords.accuracy ?? 9999,
        mocked: reading.mocked === true,
      },
    };
  } catch {
    return { ok: false, message: "We could not find your location. Try again." };
  }
}

export interface CheckedIn {
  checkedInAt: string;
  distance: number | null;
  courseCode: string;
  marks: number;
}

export async function sendCheckIn(input: {
  sessionId: string;
  position: Position | null;
  qrToken: string | null;
}): Promise<StepResult<CheckedIn>> {
  const { data, error } = await supabase.rpc("check_in", {
    p_session_id: input.sessionId,
    p_device_secret: await phoneSecret(),
    p_lat: input.position?.latitude ?? null,
    p_lng: input.position?.longitude ?? null,
    p_accuracy: input.position?.accuracy ?? null,
    p_mocked: input.position?.mocked ?? false,
    p_qr_token: input.qrToken,
  });
  if (error) return { ok: false, message: describeDatabaseError(error) };
  const row = data?.[0];
  if (!row) return { ok: false, message: "Something went wrong. Please try again." };
  return {
    ok: true,
    value: { checkedInAt: row.checked_in_at, distance: row.distance_m, courseCode: row.course_code, marks: row.reward_marks },
  };
}
