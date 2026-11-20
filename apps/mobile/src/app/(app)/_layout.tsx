import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Logo } from "@/components/ui";

/** The RollCol mark and name, as on the website. */
function HeaderBrand() {
  const palette = usePalette();
  return (
    <View style={styles.brand} accessibilityRole="header" accessibilityLabel="RollCol">
      <Logo size={26} />
      <Text style={[styles.brandText, { color: palette.text }]}>RollCol</Text>
    </View>
  );
}

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
      <Stack.Screen name="index" options={{ title: "RollCol", headerTitle: () => <HeaderBrand /> }} />
      <Stack.Screen name="account" options={{ title: "Your account" }} />
      <Stack.Screen name="schools" options={{ title: "Your schools" }} />
      <Stack.Screen name="register/start" options={{ title: "Take register" }} />
      <Stack.Screen name="register/[id]" options={{ title: "Register" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 17, fontWeight: "700" },
});
