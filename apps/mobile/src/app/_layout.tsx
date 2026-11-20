import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { usePalette } from "@/components/theme";
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

  useEffect(() => {
    if (!loading) SplashScreen.hide();
  }, [loading]);

  if (loading) return null;

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
