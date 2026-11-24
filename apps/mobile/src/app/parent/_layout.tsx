import { Stack } from "expo-router";
import { useEffect } from "react";
import { usePalette } from "@/components/theme";
import { registerStaffPush, useNotificationTaps } from "@/lib/push";

/** The parent part of the app: children, the school's messages, notifications. */
export default function ParentLayout() {
  const palette = usePalette();

  // Parents get notifications (a link confirmed or ended now; alerts in 9b).
  useEffect(() => {
    void registerStaffPush().catch(() => undefined);
  }, []);
  useNotificationTaps(true, "/parent/notifications");

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="link" options={{ title: "Add your child" }} />
      <Stack.Screen name="child/[id]" options={{ title: "Attendance" }} />
      <Stack.Screen name="notification-settings" options={{ title: "Notifications" }} />
    </Stack>
  );
}
