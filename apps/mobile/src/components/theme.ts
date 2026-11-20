import { useColorScheme } from "react-native";

/** Same calm palette as the web app. */
const light = {
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
};

export type Palette = typeof light;

const dark: Palette = {
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
};

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
