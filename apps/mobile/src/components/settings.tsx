import { Ionicons } from "@expo/vector-icons";
import { Children, Fragment, type ComponentProps, type ReactNode, isValidElement } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** The person at the top of an Account screen: initials (or an icon), name and details. */
export function ProfileHeader({ name, lines, icon }: { name: string; lines: (string | null | undefined)[]; icon?: IconName }) {
  const palette = usePalette();
  const initials = name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .map((word) => word[0]?.toUpperCase() ?? "")
    .filter(Boolean);
  const letters = (initials[0] ?? "") + (initials.length > 1 ? (initials[initials.length - 1] ?? "") : "");
  return (
    <View style={styles.profile}>
      <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
        {icon || !letters ? (
          <Ionicons name={icon ?? "person"} size={28} color={palette.accent} />
        ) : (
          <Text style={[styles.avatarText, { color: palette.accent }]}>{letters}</Text>
        )}
      </View>
      <View style={styles.profileText}>
        <Text style={[styles.profileName, { color: palette.text }]} numberOfLines={2}>
          {name}
        </Text>
        {lines.filter(Boolean).map((line) => (
          <Text key={line} style={[styles.profileLine, { color: palette.muted }]} numberOfLines={2}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** A titled group of rows in one rounded box, with an optional note under it. */
export function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const palette = usePalette();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {title ? <Text style={[styles.groupTitle, { color: palette.muted }]}>{title.toUpperCase()}</Text> : null}
      <View style={[styles.box, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: palette.line }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={[styles.groupFooter, { color: palette.muted }]}>{footer}</Text> : null}
    </View>
  );
}

/**
 * One row: an icon, a title (with an optional line under it), and on the right
 * a value, a control, or an arrow when it opens something.
 */
export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  right,
  onPress,
  danger = false,
  external = false,
  busy = false,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  /** Opens a web page: shows an "open" arrow instead of a chevron. */
  external?: boolean;
  busy?: boolean;
}) {
  const palette = usePalette();
  const tint = danger ? palette.danger : palette.accent;
  const body = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: danger ? "transparent" : palette.accentSoft }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: danger ? palette.danger : palette.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: palette.muted }]} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: palette.muted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {busy ? <ActivityIndicator color={tint} /> : null}
      {onPress && !right && !busy && !danger ? (
        <Ionicons name={external ? "open-outline" : "chevron-forward"} size={18} color={palette.muted} />
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: palette.line } : null]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.row}>{body}</View>
  );
}

/** Automatic, Light or Dark, as a row of three. */
export function ThemeChooser<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View accessibilityRole="radiogroup" style={[styles.segments, { backgroundColor: palette.background }]}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected ? { backgroundColor: palette.surface, borderColor: palette.line } : null]}
          >
            <Text style={[styles.segmentText, { color: selected ? palette.text : palette.muted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 4 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700" },
  profileText: { flex: 1, gap: 2 },
  profileName: { fontSize: 20, fontWeight: "700" },
  profileLine: { fontSize: 14 },
  group: { gap: 6 },
  groupTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginLeft: 4 },
  groupFooter: { fontSize: 13, lineHeight: 18, marginHorizontal: 4 },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 52 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSubtitle: { fontSize: 13, lineHeight: 18 },
  value: { fontSize: 15, maxWidth: "45%" },
  segments: { flexDirection: "row", borderRadius: 9, padding: 3, margin: 12, marginTop: 0 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent" },
  segmentText: { fontSize: 14, fontWeight: "600" },
});
