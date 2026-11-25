import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";

/** A labelled row of choices; one is picked at a time. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                { borderColor: selected ? palette.accent : palette.line, backgroundColor: selected ? palette.accentSoft : palette.surface },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? palette.accent : palette.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A labelled row of choices where several can be picked. */
export function MultiChoiceChips({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <View accessibilityLabel={label} style={styles.chips}>
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(selected ? values.filter((v) => v !== option.value) : [...values, option.value])}
              style={[
                styles.chip,
                { borderColor: selected ? palette.accent : palette.line, backgroundColor: selected ? palette.accentSoft : palette.surface },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? palette.accent : palette.text }]}>
                {selected ? "✓ " : ""}
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The next days from today (Ghana time, which is UTC), as YYYY-MM-DD with short labels. */
export function nextDays(today: string, count: number): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const value = d.toISOString().slice(0, 10);
    const short = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
    return { value, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : short };
  });
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 15, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: "600" },
});
