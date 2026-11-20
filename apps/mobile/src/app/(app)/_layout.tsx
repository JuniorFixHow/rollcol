import { Stack } from "expo-router";
import { usePalette } from "@/components/theme";

export default function AppLayout() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "RollCol" }} />
      <Stack.Screen name="account" options={{ title: "Your account" }} />
    </Stack>
  );
}
