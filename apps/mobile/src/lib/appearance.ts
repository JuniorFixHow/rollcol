import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "rollcol.theme";

/**
 * The person's light or dark choice. The app's colours read it directly (see
 * usePalette), so switching works on every phone. It is also passed to the
 * system, so native parts such as alerts and the keyboard match.
 */
let current: ThemeChoice = "system";
const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentTheme(): ThemeChoice {
  return current;
}

function apply(choice: ThemeChoice) {
  current = choice;
  try {
    Appearance.setColorScheme(choice === "system" ? "unspecified" : choice);
  } catch {
    // Older phones may not support it; the app's own colours still switch.
  }
  for (const listener of listeners) listener();
}

/** Applies the saved choice. Call once when the app starts. */
export async function restoreTheme(): Promise<ThemeChoice> {
  const stored = await AsyncStorage.getItem(KEY);
  const choice: ThemeChoice = stored === "light" || stored === "dark" ? stored : "system";
  apply(choice);
  return choice;
}

export async function setTheme(choice: ThemeChoice): Promise<void> {
  apply(choice);
  if (choice === "system") await AsyncStorage.removeItem(KEY);
  else await AsyncStorage.setItem(KEY, choice);
}

export async function getTheme(): Promise<ThemeChoice> {
  return current;
}
