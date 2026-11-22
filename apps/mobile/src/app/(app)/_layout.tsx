import { Stack } from "expo-router";
import { usePalette } from "@/components/theme";
import { PhoneProvider } from "@/lib/phone";
import { useSession } from "@/lib/session";

// A check-in link opens straight to the check-in screen; the tabs sit underneath it.
export const unstable_settings = { anchor: "(tabs)" };

export default function AppLayout() {
  const palette = usePalette();
  const { memberships } = useSession();
  // Students register their phone (check-in binding) and notifications.
  const isStudent = memberships.some((m) => m.kind === "student");

  return (
    <PhoneProvider isStudent={isStudent}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.text,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="schools" options={{ title: "Your schools" }} />
        <Stack.Screen name="checkin/[id]" options={{ title: "Check in", presentation: "fullScreenModal", headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ title: "Course" }} />
        <Stack.Screen name="course/new" options={{ title: "Add a course" }} />
        <Stack.Screen name="session/start" options={{ title: "Start a session" }} />
        <Stack.Screen name="session/[id]" options={{ title: "Session" }} />
        <Stack.Screen name="register/start" options={{ title: "Take register" }} />
        <Stack.Screen name="register/[id]" options={{ title: "Register" }} />
        <Stack.Screen name="report/[kind]/[id]" options={{ title: "Report" }} />
      </Stack>
    </PhoneProvider>
  );
}
