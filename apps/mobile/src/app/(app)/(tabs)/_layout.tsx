import { Ionicons } from "@expo/vector-icons";
import { Tabs, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { usePalette } from "@/components/theme";
import { Logo } from "@/components/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { onUnreadChange } from "@/lib/unread";

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

/** Unread notifications, for the tab badge. */
function useUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { count: unread } = await supabase
      .from("push_outbox")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    setCount(unread ?? 0);
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (!enabled) return;
    const subscription = Notifications.addNotificationReceivedListener(() => void load());
    const stop = onUnreadChange(() => void load());
    const timer = setInterval(() => void load(), 60000);
    return () => {
      subscription.remove();
      stop();
      clearInterval(timer);
    };
  }, [enabled, load]);
  return count;
}

/** Tab icons get a colour from the tab bar; fall back if it is missing. */
function tint(color: unknown): string {
  return typeof color === "string" ? color : "#5b6676";
}

export default function TabsLayout() {
  const palette = usePalette();
  const { member } = useSession();
  const isStudent = member?.kind === "student";
  const isLecturer = member?.kind === "staff" && member.school.type === "tertiary";
  const unread = useUnreadCount(isStudent);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.line },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          headerTitle: () => <HeaderBrand />,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "today" : "today-outline"} size={24} color={tint(color)} />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: "Courses",
          href: isStudent ? "/courses" : null,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "book" : "book-outline"} size={24} color={tint(color)} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: "Sessions",
          href: isLecturer ? "/sessions" : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "qr-code" : "qr-code-outline"} size={24} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          href: member?.kind === "staff" ? "/reports" : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={24} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          href: isStudent ? "/notifications" : null,
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: palette.danger, color: "#ffffff" },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={24} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={26} color={tint(color)} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 17, fontWeight: "700" },
});
