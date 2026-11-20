"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type ThemeChoice = "system" | "light" | "dark";

const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the theme.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(readChoice());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

function chooseTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage can be blocked; the choice still applies until the page reloads.
  }
  applyTheme(choice);
  for (const listener of listeners) listener();
}

/** Light, dark, or follow the device. Remembered in this browser. */
export function ThemePicker({ className = "" }: { className?: string }) {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as const);

  return (
    <div role="radiogroup" aria-label="Theme" className={`inline-flex rounded-md border border-line bg-surface p-0.5 text-xs ${className}`}>
      {(["system", "light", "dark"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={choice === option}
          onClick={() => chooseTheme(option)}
          className={`rounded px-2.5 py-1 font-medium capitalize ${
            choice === option ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          {option === "system" ? "Auto" : option}
        </button>
      ))}
    </div>
  );
}
