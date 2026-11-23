import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "@rollcol/shared";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy apps/mobile/.env.example to apps/mobile/.env.",
  );
}

/**
 * The session lives in AsyncStorage because Supabase sessions can exceed the
 * 2 KB limit of SecureStore. Device binding secrets (Part 5) go in SecureStore.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Without a lock, the start-up refresh and the foreground refresh can both
    // spend the same refresh token. Supabase treats that as token reuse and ends
    // the session, which signed people out between launches.
    lock: processLock,
  },
});

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

/** The RollCol website, for email links, the privacy policy and password resets. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://rollcol.app").replace(/\/$/, "");
