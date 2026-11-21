import type { Database } from "@rollcol/shared";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/**
 * How RollCol knows a student's phone:
 * - A long random secret made on first sign-in, kept in the phone's secure
 *   storage (iPhone Keychain, Android Keystore) and never backed up to another
 *   phone. The server only keeps a scrambled copy (SHA-256).
 * - The phone's own app ID (Android ID; on iPhone, the ID for this developer's
 *   apps), so reinstalling the app on the same phone is not a "new phone".
 * The phone's name (for example "iPhone 12 Pro Max") is only a label for admins.
 */
const SECRET_KEY = "rollcol.deviceSecret";

type DeviceStatusEnum = Database["public"]["Enums"]["device_status"];

export interface PhoneStatus {
  status: DeviceStatusEnum | "unregistered";
  label: string;
  /** When a new phone becomes the check-in phone on its own. */
  activeFrom: string | null;
  /** A new phone that only an admin can approve. */
  needsAdmin: boolean;
  /** The current check-in phone, when this one is waiting. */
  activeLabel: string | null;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** This phone's secret, made once and kept in secure storage. */
export async function phoneSecret(): Promise<string> {
  const saved = await SecureStore.getItemAsync(SECRET_KEY);
  if (saved) return saved;
  const secret = toHex(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(SECRET_KEY, secret, {
    // Stays on this phone: not copied to a new phone from a backup.
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return secret;
}

async function hardwareId(): Promise<string | null> {
  try {
    if (Platform.OS === "android") return Application.getAndroidId();
    if (Platform.OS === "ios") return await Application.getIosIdForVendorAsync();
  } catch {
    // Not available (for example in a simulator): the secret alone is used.
  }
  return null;
}

function phoneLabel(): string {
  const name = Device.modelName ?? (Platform.OS === "ios" ? "iPhone" : "Android phone");
  return name.slice(0, 80);
}

/**
 * Registers this phone for the signed-in student (once per sign-in). The first
 * phone is active at once; a different phone waits 48 hours or for an admin.
 */
export async function registerThisPhone(): Promise<PhoneStatus> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return { status: "unregistered", label: "", activeFrom: null, needsAdmin: false, activeLabel: null };
  }
  const { error } = await supabase.rpc("register_device", {
    p_secret: await phoneSecret(),
    p_label: phoneLabel(),
    p_platform: Platform.OS,
    p_hardware_id: await hardwareId(),
  });
  if (error) throw error;
  return loadPhoneStatus();
}

export async function loadPhoneStatus(): Promise<PhoneStatus> {
  const { data, error } = await supabase.rpc("my_device", { p_secret: await phoneSecret() });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { status: "unregistered", label: phoneLabel(), activeFrom: null, needsAdmin: false, activeLabel: null };
  return {
    status: row.status,
    label: row.label,
    activeFrom: row.active_from,
    needsAdmin: row.needs_admin,
    activeLabel: row.active_label,
  };
}
