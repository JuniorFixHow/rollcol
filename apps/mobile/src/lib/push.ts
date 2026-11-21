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

/**
 * Asks permission (once) and sends this phone's push token to RollCol, so the
 * student is told when a session opens, closes, or changes.
 * Returns false when notifications are off or unavailable.
 */
export async function registerForPush(): Promise<boolean> {
  if (!Device.isDevice) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Classes and attendance",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#0f6b62",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  const id = projectId();
  if (!id) return false;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
  const { error } = await supabase.rpc("set_push_token", { p_secret: await phoneSecret(), p_token: token.data });
  return !error;
}

/** Tapping a notification about a session opens the Today tab. */
export function useNotificationTaps(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (data && typeof data.sessionId === "string") router.navigate("/");
      else if (response) router.navigate("/notifications");
    };
    // The tap that opened the app from closed.
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [enabled]);
}
