import { Ionicons } from "@expo/vector-icons";
import { Tabs, router, useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { type ComponentProps, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

type IconName = ComponentProps<typeof Ionicons>["name"];

function HeaderIcon({ icon, label, count, href }: { icon: IconName; label: string; count: number; href: "/parent/messages" | "/parent/notifications" | "/parent/account" }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${count} unread` : label}
      hitSlop={6}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.icon, pressed ? { opacity: 0.6 } : null]}
    >
      <Ionicons name={icon} size={24} color={palette.text} />
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: palette.danger, borderColor: palette.surface }]}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Messages, notifications and the account, at the top right of every tab. */
function HeaderIcons({ messages, notifications }: { messages: number; notifications: number }) {
  return (
    <View style={styles.icons}>
      <HeaderIcon icon="chatbubbles-outline" label="Messages" count={messages} href="/parent/messages" />
      <HeaderIcon icon="notifications-outline" label="Notifications" count={notifications} href="/parent/notifications" />
      <HeaderIcon icon="person-circle-outline" label="Account" count={0} href="/parent/account" />
    </View>
  );
}

export default function ParentTabsLayout() {
  const palette = usePalette();
  const unread = useUnreadCounts();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.text,
        headerShadowVisible: false,
        headerRight: () => <HeaderIcons messages={unread.messages} notifications={unread.notifications} />,
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
        name="pickups"
        options={{
          title: "Pickups",
          headerTitle: "Pickup codes",
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "key" : "key-outline"} size={24} color={tint(color)} />,
        }}
      />
      <Tabs.Screen
        name="absences"
        options={{
          title: "Absences",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={tint(color)} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 17, fontWeight: "700" },
  icons: { flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 16 },
  icon: { padding: 2 },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
});
