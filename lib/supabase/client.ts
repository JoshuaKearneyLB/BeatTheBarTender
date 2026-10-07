import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, or null when env vars are absent — the app then
 * runs demo races only (local state, no persistence) so the UI is fully
 * explorable before a Supabase project exists.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

/** True when this build has a Supabase project to talk to. */
export const isLiveConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** The race id reserved for the demo; it never touches the database. */
export const DEMO_RACE_ID = "demo";

/**
 * Demo and live run side by side: the "demo" race is always local, so a
 * venue can still try the app on a live deployment. Every other race id is
 * real once Supabase is configured.
 */
export const isDemoRace = (raceId: string) => raceId === DEMO_RACE_ID || !isLiveConfigured();
