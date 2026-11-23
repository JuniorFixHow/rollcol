import { Ionicons } from "@expo/vector-icons";
import { addDays, mondayOf } from "@rollcol/shared";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Button } from "@/components/ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function firstOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(iso: string, months: number) {
  const date = new Date(`${firstOfMonth(iso)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/**
 * RollCol's own date picker: a month at a time, Monday first. Dates are
 * Ghana dates (YYYY-MM-DD). Days outside min and max cannot be chosen.
 */
export function CalendarDialog({
  visible,
  title,
  value,
  min,
  max,
  onChoose,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: string;
  min?: string;
  max?: string;
  onChoose: (date: string) => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const [month, setMonth] = useState(firstOfMonth(value));
  useEffect(() => {
    if (visible) setMonth(firstOfMonth(value));
  }, [visible, value]);

  // Six rows of seven days, starting on the Monday on or before the 1st.
  const start = mondayOf(month);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.center} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => setMonth(shiftMonth(month, -1))}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              hitSlop={8}
              style={[styles.arrow, { borderColor: palette.line }]}
            >
              <Ionicons name="chevron-back" size={18} color={palette.text} />
            </Pressable>
            <Text style={[styles.month, { color: palette.text }]}>{monthTitle.format(new Date(`${month}T00:00:00Z`))}</Text>
            <Pressable
              onPress={() => setMonth(shiftMonth(month, 1))}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              hitSlop={8}
              style={[styles.arrow, { borderColor: palette.line }]}
            >
              <Ionicons name="chevron-forward" size={18} color={palette.text} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {WEEKDAYS.map((name) => (
              <Text key={name} style={[styles.weekday, { color: palette.muted }]}>
                {name}
              </Text>
            ))}
            {days.map((day) => {
              const inMonth = day.slice(0, 7) === month.slice(0, 7);
              const chosen = day === value;
              const enabled = allowed(day);
              return (
                <Pressable
                  key={day}
                  disabled={!enabled}
                  onPress={() => onChoose(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chosen, disabled: !enabled }}
                  accessibilityLabel={day}
                  style={[styles.day, chosen ? { backgroundColor: palette.accent } : null]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: chosen ? palette.accentText : palette.text },
                      !inMonth || !enabled ? { opacity: chosen ? 1 : 0.3 } : null,
                    ]}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  center: { flex: 1, justifyContent: "center", padding: 20 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 12, maxWidth: 420, width: "100%", alignSelf: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: { fontSize: 16, fontWeight: "600" },
  arrow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontWeight: "600", paddingVertical: 4 },
  day: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  dayText: { fontSize: 15, fontWeight: "500" },
});
