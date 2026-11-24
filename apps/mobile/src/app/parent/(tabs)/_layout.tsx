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

function useUnreadCount(): number {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    const { count: unread } = await supabase.from("push_outbox").select("id", { count: "exact", head: true }).is("read_at", null);
    setCount(unread ?? 0);
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
  const unread = useUnreadCount();

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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
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
