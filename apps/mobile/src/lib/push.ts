import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { phoneSecret } from "./device";
import { supabase } from "./supabase";

// Show notifications while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return fromExtra ?? Constants.easConfig?.projectId;
}

export type PushPermission = "granted" | "denied" | "undetermined" | "unavailable";

/** Whether this phone lets RollCol show notifications, without asking. */
export async function pushPermission(): Promise<PushPermission> {
  if (!Device.isDevice) return "unavailable";
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  return current.canAskAgain ? "undetermined" : "denied";
}

/** This phone's Expo push token, asking permission once if needed. Null when notifications are off. */
async function expoPushToken(ask: boolean): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Classes and attendance",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#0f6b62",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && ask && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;

  const id = projectId();
  if (!id) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
  return token.data;
}

/**
 * Asks permission (once) and sends this phone's push token to RollCol, so the
 * student is told when a session opens, closes, or changes.
 * Returns false when notifications are off or unavailable.
 */
export async function registerForPush(): Promise<boolean> {
  const token = await expoPushToken(true);
  if (!token) return false;
  const { error } = await supabase.rpc("set_push_token", { p_secret: await phoneSecret(), p_token: token });
  return !error;
}

/**
 * Staff do not register a phone for check-in, but still get notifications
 * (for example about a workspace moving into their school).
 */
export async function registerStaffPush(): Promise<boolean> {
  const token = await expoPushToken(true);
  if (!token) return false;
  const { error } = await supabase.rpc("set_staff_push_token", { p_token: token });
  return !error;
}

/** Before signing out: this phone stops getting the account's notifications. */
export async function forgetThisPhonesPush(): Promise<void> {
  try {
    const token = await expoPushToken(false);
    if (token) await supabase.rpc("forget_push_token", { p_token: token });
  } catch {
    // Signing out must still work without a connection.
  }
}

/**
 * Tapping a notification about a session opens the Today tab; others open
 * Notifications (the parent screens have their own).
 */
export function useNotificationTaps(enabled: boolean, notifications: "/notifications" | "/parent/notifications" = "/notifications"): void {
  useEffect(() => {
    if (!enabled) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (data && typeof data.sessionId === "string") router.navigate("/");
      else if (data && data.smsId !== undefined && notifications === "/parent/notifications") router.navigate("/parent/messages");
      else if (response) router.navigate(notifications);
    };
    // The tap that opened the app from closed.
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [enabled, notifications]);
}
