import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { usePalette } from "@/components/theme";
import { restoreTheme } from "@/lib/appearance";
import { initOutbox } from "@/lib/registers";
import { SessionProvider, useSession } from "@/lib/session";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { loading, session, member } = useSession();
  const palette = usePalette();
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    // Apply the saved light or dark choice before the splash screen goes.
    void restoreTheme().finally(() => setThemeReady(true));
  }, []);

  useEffect(() => {
    // Send register marks saved on the phone while offline.
    if (session) void initOutbox();
  }, [session]);

  const ready = !loading && themeReady;
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const signedIn = session !== null;
  const hasSchool = member !== null && member.kind !== "none";

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasSchool}>
        <Stack.Screen name="join" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasSchool}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
