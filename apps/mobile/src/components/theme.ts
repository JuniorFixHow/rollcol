import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { currentTheme, subscribeTheme } from "@/lib/appearance";

/** Same calm palette as the web app. */
const light = {
  scheme: "light" as "light" | "dark",
  background: "#f7f8fa",
  surface: "#ffffff",
  surfaceMuted: "#f1f3f6",
  text: "#1b2430",
  muted: "#5b6676",
  line: "#e2e6ec",
  accent: "#0f6b62",
  accentSoft: "#e5f2f0",
  accentText: "#ffffff",
  danger: "#b42318",
  dangerSoft: "#fdecea",
  warning: "#8a5a00",
  warningSoft: "#fff4dc",
  success: "#1f7a3f",
  successSoft: "#e6f4ea",
  onStatus: "#ffffff",
  onWarning: "#ffffff",
};

export type Palette = typeof light;

const dark: Palette = {
  scheme: "dark",
  background: "#0f141a",
  surface: "#161d25",
  surfaceMuted: "#1d2630",
  text: "#e7ebf0",
  muted: "#9aa5b4",
  line: "#2a3542",
  accent: "#3fb3a5",
  accentSoft: "#15302d",
  accentText: "#0b1a18",
  danger: "#f97066",
  dangerSoft: "#3a1714",
  warning: "#f5c04a",
  warningSoft: "#33280f",
  success: "#5fcf88",
  successSoft: "#13301e",
  onStatus: "#0b1a12",
  onWarning: "#1f1600",
};

export function usePalette(): Palette {
  const system = useColorScheme();
  const choice = useSyncExternalStore(subscribeTheme, currentTheme);
  const scheme = choice === "system" ? system : choice;
  return scheme === "dark" ? dark : light;
}
