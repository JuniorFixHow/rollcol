import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Palette, usePalette } from "@/components/theme";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

function toneColors(palette: Palette, tone: Tone) {
  return {
    neutral: { bg: palette.surfaceMuted, fg: palette.muted },
    success: { bg: palette.successSoft, fg: palette.success },
    warning: { bg: palette.warningSoft, fg: palette.warning },
    danger: { bg: palette.dangerSoft, fg: palette.danger },
    accent: { bg: palette.accentSoft, fg: palette.accent },
  }[tone];
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const palette = usePalette();
  const colors = toneColors(palette, tone);
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.fg }]}>{children}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.section, { color: palette.muted }]}>{children}</Text>;
}

export function Empty({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.empty, { borderColor: palette.line }]}>
      <Ionicons name={icon} size={28} color={palette.muted} />
      <Text style={[styles.emptyText, { color: palette.muted }]}>{children}</Text>
    </View>
  );
}

/** A tappable row with a title, a line under it, and something on the right. */
export function Row({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: palette.muted }]} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={palette.muted} /> : null}
    </>
  );
  const style = [styles.row, { backgroundColor: palette.surface, borderColor: palette.line }];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed ? { opacity: 0.7 } : null]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

const HINT_KEY = "rollcol.pullHintSeen";

/**
 * Many students do not know the pull-down gesture: a small hint until they
 * have refreshed once. Call markPulled() from onRefresh.
 */
export function usePullHint(): { show: boolean; markPulled: () => void } {
  const [show, setShow] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(HINT_KEY).then((value) => setShow(value === null));
  }, []);
  return {
    show,
    markPulled: () => {
      if (!show) return;
      setShow(false);
      void AsyncStorage.setItem(HINT_KEY, "1");
    },
  };
}

export function PullHint({ show }: { show: boolean }) {
  const palette = usePalette();
  if (!show) return null;
  return (
    <View style={styles.hint} accessibilityRole="text">
      <Ionicons name="arrow-down" size={14} color={palette.muted} />
      <Text style={[styles.hintText, { color: palette.muted }]}>Pull down to refresh</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  section: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, padding: 20, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 14, lineHeight: 20 },
  hint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  hintText: { fontSize: 13 },
});
