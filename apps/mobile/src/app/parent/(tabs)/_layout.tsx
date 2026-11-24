import { Ionicons } from "@expo/vector-icons";
import { Tabs, useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Logo } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { onUnreadChange } from "@/lib/unread";

function HeaderBrand() {
  const palette = usePalette();
  return (
    <View style={styles.brand} accessibilityRole="header" accessibilityLabel="RollCol">
      <Logo size={26} />
      <Text style={[styles.brandText, { color: palette.text }]}>RollCol</Text>
    </View>
  );
}

/** Unread notifications, and unread messages (school messages and alerts), counted apart. */
function useUnreadCounts(): { notifications: number; messages: number } {
  const [count, setCount] = useState({ notifications: 0, messages: 0 });
  const load = useCallback(async () => {
    const [notifications, messages] = await Promise.all([
      supabase.from("push_outbox").select("id", { count: "exact", head: true }).is("data->smsId", null).is("read_at", null),
      supabase.from("push_outbox").select("id", { count: "exact", head: true }).not("data->smsId", "is", null).is("read_at", null),
    ]);
    setCount({ notifications: notifications.count ?? 0, messages: messages.count ?? 0 });
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => void load());
    const stop = onUnreadChange(() => void load());
    const timer = setInterval(() => void load(), 60000);
    return () => {
      subscription.remove();
      stop();
      clearInterval(timer);
    };
  }, [load]);
  return count;
}

function tint(color: unknown): string {
  return typeof color === "string" ? color : "#5b6676";
}

export default function ParentTabsLayout() {
  const palette = usePalette();
  const unread = useUnreadCounts();
  const badge = (n: number) => (n > 0 ? (n > 99 ? "99+" : n) : undefined);

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
          title: "Children",
          headerTitle: () => <HeaderBrand />,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "people" : "people-outline"} size={24} color={tint(color)} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge: badge(unread.messages),
          tabBarBadgeStyle: { backgroundColor: palette.danger, color: "#ffffff" },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarBadge: badge(unread.notifications),
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
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={tint(color)} />
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
